const Category    = require('../models/Category');
const Party       = require('../models/Party');
const Transaction = require('../models/Transaction');
const fetch       = require('node-fetch');

const chat = async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message required.' });

    const uid = req.user._id;
    const [categories, parties, recentTx] = await Promise.all([
      Category.find({ userId: uid }).lean(),
      Party.find({ userId: uid, isActive: true }).lean(),
      Transaction.find({ userId: uid }).populate('partyId','name').sort({ date:-1 }).limit(15).lean()
    ]);

    const totalToGet  = parties.filter(p=>p.balance>0).reduce((s,p)=>s+p.balance,0);
    const totalToGive = parties.filter(p=>p.balance<0).reduce((s,p)=>s+Math.abs(p.balance),0);

    const partyList = parties.slice(0,30).map(p=>{
      const cat = categories.find(c=>c._id.toString()===p.categoryId.toString());
      return `${p.name}[${cat?.name||'?'}]:₹${p.balance.toFixed(0)}`;
    }).join(', ');

    const topDebtors = [...parties].filter(p=>p.balance>0).sort((a,b)=>b.balance-a.balance).slice(0,5);

    const systemPrompt = `You are CreditBot, an AI assistant for CreditBook — a business ledger app.
Today: ${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
Owner: ${req.user.name} | Business: ${req.user.businessName}

LIVE DATA:
Categories(${categories.length}): ${categories.map(c=>c.name).join(', ')||'none'}
Parties(${parties.length}): ${partyList||'none'}
Total to GET: ₹${totalToGet.toFixed(2)} | Total to GIVE: ₹${totalToGive.toFixed(2)}
Top debtors: ${topDebtors.map(p=>`${p.name}:₹${p.balance.toFixed(0)}`).join(', ')||'none'}
Recent txns: ${recentTx.slice(0,5).map(t=>`${t.partyId?.name}: ${t.type==='got'?'+':'-'}₹${t.amount}`).join(', ')||'none'}

ACTIONS YOU CAN TRIGGER:
When user asks to perform an action, include a JSON block wrapped in <action></action> tags like:
<action>{"intent":"add_transaction","party":"PartyName","amount":500,"type":"gave","note":"optional"}</action>
<action>{"intent":"create_party","name":"PartyName","category":"CategoryName"}</action>
<action>{"intent":"show_party","party":"PartyName"}</action>
<action>{"intent":"create_category","name":"CategoryName"}</action>

Valid intents: add_transaction, create_party, show_party, create_category
For add_transaction: type = "gave" (you gave to them) or "got" (you received from them)

RULES: Max 150 words, use ₹ symbol, bullet points for lists, never make up data not in context.`;

    const GROQ_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_KEY || GROQ_KEY.includes('your_groq')) {
      return res.json({ success: true, data: { reply: smartFallback(message, { categories, parties, totalToGet, totalToGive, topDebtors, recentTx, user: req.user }), action: null } });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 400,
        temperature: 0.5,
        messages: [
          { role:'system', content: systemPrompt },
          ...history.slice(-6).map(m=>({ role:m.role, content:m.content })),
          { role:'user', content: message }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Groq error:', err);
      return res.json({ success: true, data: { reply: smartFallback(message, { categories, parties, totalToGet, totalToGive, topDebtors, recentTx, user: req.user }), action: null } });
    }

    const groqData = await response.json();
    let reply = groqData.choices?.[0]?.message?.content || 'Sorry, no response.';

    // Extract and execute action if present
    let action = null;
    const actionMatch = reply.match(/<action>([\s\S]*?)<\/action>/);
    if (actionMatch) {
      try {
        const intent = JSON.parse(actionMatch[1].trim());
        action = await executeIntent(intent, uid, parties, categories);
        reply = reply.replace(/<action>[\s\S]*?<\/action>/, '').trim();
        if (action?.message) reply = (reply ? reply + '\n\n' : '') + action.message;
      } catch(e) { console.error('Intent exec error:', e); }
    }

    res.json({ success: true, data: { reply, action } });
  } catch(e) {
    console.error('Chat error:', e);
    res.json({ success: true, data: { reply: '🤖 AI unavailable. Add GROQ_API_KEY to backend/.env (free at groq.com)', action: null } });
  }
};

async function executeIntent(intent, userId, parties, categories) {
  try {
    if (intent.intent === 'add_transaction') {
      const name = intent.party?.toLowerCase?.();
      if (!name) return null;
      const party = parties.find(p => p.name.toLowerCase().includes(name) || name.includes(p.name.toLowerCase()));
      if (!party) return { message: `❌ Party "${intent.party}" not found.`, success: false };
      const amount = Number(intent.amount);
      if (!amount || amount <= 0) return { message: '❌ Invalid amount.', success: false };
      const type = ['gave','got'].includes(intent.type) ? intent.type : 'gave';
      const delta = type === 'gave' ? +amount : -amount;
      const newBal = +(party.balance + delta).toFixed(2);
      await require('../models/Party').findByIdAndUpdate(party._id, { balance: newBal });
      await require('../models/Transaction').create({ userId, partyId: party._id, type, amount: +amount.toFixed(2), note: intent.note||'', date: new Date(), balanceAfter: newBal });
      const balText = newBal>0?`to get: ₹${newBal.toFixed(2)}`:newBal<0?`to give: ₹${Math.abs(newBal).toFixed(2)}`:'settled';
      return { message: `✅ ₹${amount} ${type==='gave'?'given to':'received from'} ${party.name}. Balance: ${balText}`, success: true, refresh: true };
    }
    if (intent.intent === 'create_party') {
      if (!intent.name?.trim()) return null;
      let cat = categories.find(c => c.name.toLowerCase() === intent.category?.toLowerCase?.());
      if (!cat && intent.category) {
        cat = await require('../models/Category').create({ userId, name: intent.category.trim(), color:'#1a4fd6', icon:'👥' });
        categories.push(cat);
      }
      if (!cat) return { message: `❌ Category "${intent.category}" not found.`, success: false };
      const existing = await require('../models/Party').findOne({ userId, name: { $regex:`^${intent.name.trim()}$`,$options:'i' }, isActive: true });
      if (existing) return { message: `ℹ️ Party "${intent.name}" already exists.`, success: false };
      const p = await require('../models/Party').create({ userId, categoryId: cat._id, name: intent.name.trim() });
      return { message: `✅ Party "${p.name}" created under ${cat.name}!`, success: true, refresh: true };
    }
    if (intent.intent === 'create_category') {
      if (!intent.name?.trim()) return null;
      const cat = await require('../models/Category').create({ userId, name: intent.name.trim(), color:'#1a4fd6', icon:'👥' });
      return { message: `✅ Category "${cat.name}" created!`, success: true, refresh: true };
    }
    return null;
  } catch(e) {
    console.error('Intent error:', e);
    return { message: '❌ Action failed. Try manually.', success: false };
  }
}

function smartFallback(message, ctx) {
  const msg = message.toLowerCase();
  const { categories, parties, totalToGet, totalToGive, topDebtors, recentTx, user } = ctx;
  if (msg.match(/hi|hello|hey|namaste/))
    return `👋 Hello ${user.name}! I'm CreditBot.\n\nI can help with:\n• 📊 Balances & dues\n• 👥 Party info by category\n• 💸 Recent transactions\n\n💡 Add GROQ_API_KEY to backend/.env for full AI!`;
  if (msg.match(/balance|summary|total|overview/))
    return `📊 *Business Summary*\n\n💼 Total to GET: ₹${totalToGet.toFixed(2)}\n💸 Total to GIVE: ₹${totalToGive.toFixed(2)}\n\n📂 Categories: ${categories.map(c=>c.name).join(', ')||'none'}\n👥 Total parties: ${parties.length}`;
  if (msg.match(/who owe|owes|debtor|due/))
    return topDebtors.length ? `📞 *Top Debtors*\n\n${topDebtors.map((p,i)=>`${i+1}. ${p.name}: ₹${p.balance.toFixed(2)}`).join('\n')}` : '✅ No outstanding dues!';
  if (msg.match(/categor/))
    return `📂 *Your Categories* (${categories.length})\n\n${categories.map(c=>{const ps=parties.filter(p=>p.categoryId.toString()===c._id.toString());return `• ${c.icon} ${c.name}: ${ps.length} parties`;}).join('\n')||'No categories yet.'}`;
  if (msg.match(/recent|transaction|history/))
    return `📋 *Recent Transactions*\n\n${recentTx.slice(0,5).map(t=>`• ${t.partyId?.name||'?'}: ${t.type==='got'?'+':'-'}₹${t.amount}`).join('\n')||'No transactions yet.'}`;
  return `🤖 Ask me about:\n• "What's my balance?"\n• "Who owes me money?"\n• "Show my categories"\n• "Recent transactions"\n\n💡 Add GROQ_API_KEY for AI actions!`;
}

module.exports = { chat };
