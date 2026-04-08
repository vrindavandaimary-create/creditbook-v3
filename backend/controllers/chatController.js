const Category    = require('../models/Category');
const Party       = require('../models/Party');
const Transaction = require('../models/Transaction');
const fetch       = require('node-fetch');

const chat = async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message required.' });

    const uid = req.user._id;

    /* ── Fix P1: no limit on transactions for monthly summary ── */
    const [categories, parties, recentTx, monthlyAgg] = await Promise.all([
      Category.find({ userId: uid }).lean(),
      Party.find({ userId: uid, isActive: true }).lean(),
      Transaction.find({ userId: uid }).populate('partyId','name').sort({ date:-1 }).limit(15).lean(),
      /* MongoDB aggregation for accurate monthly stats */
      Transaction.aggregate([
        { $match: { userId: uid } },
        { $group: {
          _id: { year: { $year: '$date' }, month: { $month: '$date' }, type: '$type' },
          total: { $sum: '$amount' },
        }},
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
    ]);

    /* Build 6-month summary from aggregation */
    const now = new Date();
    const monthlySummary = [];
    for (let i = 5; i >= 0; i--) {
      const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year  = d.getFullYear();
      const month = d.getMonth() + 1;
      const label = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      const rec   = monthlyAgg.find(r => r._id.year===year && r._id.month===month && r._id.type==='got');
      const giv   = monthlyAgg.find(r => r._id.year===year && r._id.month===month && r._id.type==='gave');
      monthlySummary.push({ label, received: +(rec?.total||0).toFixed(2), given: +(giv?.total||0).toFixed(2) });
    }

    const totalToGet  = parties.filter(p=>p.balance>0).reduce((s,p)=>s+p.balance,0);
    const totalToGive = parties.filter(p=>p.balance<0).reduce((s,p)=>s+Math.abs(p.balance),0);
    const netBalance  = totalToGet - totalToGive;
    const topDebtors  = [...parties].filter(p=>p.balance>0).sort((a,b)=>b.balance-a.balance).slice(0,10);
    const topCreditors= [...parties].filter(p=>p.balance<0).sort((a,b)=>a.balance-b.balance).slice(0,10);

    const categoryStats = categories.map(c => {
      const ps = parties.filter(p => p.categoryId.toString() === c._id.toString());
      const toGet  = ps.filter(p=>p.balance>0).reduce((s,p)=>s+p.balance,0);
      const toGive = ps.filter(p=>p.balance<0).reduce((s,p)=>s+Math.abs(p.balance),0);
      return { name: c.name, icon: c.icon, count: ps.length, toGet: +toGet.toFixed(2), toGive: +toGive.toFixed(2) };
    });

    const partyList = parties.slice(0,50).map(p => {
      const cat = categories.find(c => c._id.toString() === p.categoryId.toString());
      return `${p.name}[${cat?.name||'?'}]:₹${p.balance.toFixed(0)}`;
    }).join(', ');

    const systemPrompt = `You are CreditBot, an advanced AI business assistant for CreditBook.
Today: ${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
Owner: ${req.user.name} | Business: ${req.user.businessName}

═══ LIVE BUSINESS DATA ═══
💰 Total to GET: ₹${totalToGet.toFixed(2)}
💸 Total to GIVE: ₹${totalToGive.toFixed(2)}
📊 Net Balance: ₹${netBalance.toFixed(2)} (${netBalance>=0?'POSITIVE':'NEGATIVE'})
👤 Total Parties: ${parties.length} across ${categories.length} categories
📋 Categories: ${categoryStats.map(c=>`${c.icon}${c.name}(${c.count} parties, GET:₹${c.toGet}, GIVE:₹${c.toGive})`).join(' | ')||'none'}
👤 All Parties: ${partyList||'none'}
🏆 Top debtors: ${topDebtors.map(p=>`${p.name}:₹${p.balance.toFixed(0)}`).join(', ')||'none'}
📤 Top creditors: ${topCreditors.map(p=>`${p.name}:₹${Math.abs(p.balance).toFixed(0)}`).join(', ')||'none'}
📅 Monthly trend (accurate): ${monthlySummary.map(m=>`${m.label}(in:₹${m.received},out:₹${m.given})`).join(', ')}
🕐 Recent txns: ${recentTx.slice(0,8).map(t=>`${t.partyId?.name}: ${t.type==='got'?'+':'-'}₹${t.amount}${t.note?'('+t.note+')':''}`).join(', ')||'none'}

═══ ACTIONS ═══
<action>{"intent":"add_transaction","party":"PartyName","amount":500,"type":"gave","note":"optional"}</action>
<action>{"intent":"create_party","name":"PartyName","category":"CategoryName"}</action>
<action>{"intent":"create_category","name":"CategoryName"}</action>

═══ CHARTS ═══
<chart>{"type":"bar","title":"Title","labels":["A","B"],"datasets":[{"label":"Amount","data":[100,200],"color":"#1a4fd6"}]}</chart>
<chart>{"type":"line","title":"Title","labels":["Jan","Feb"],"datasets":[{"label":"Received","data":[100,200],"color":"#1a9e5c"},{"label":"Given","data":[50,80],"color":"#e53935"}]}</chart>
<chart>{"type":"pie","title":"Title","labels":["A","B"],"datasets":[{"label":"Balance","data":[100,200],"colors":["#1a4fd6","#1a9e5c"]}]}</chart>

RULES: Be concise, use ₹, give business insights, never fabricate data.`;

    const GROQ_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_KEY || GROQ_KEY.includes('your_groq'))
      return res.json({ success: true, data: { reply: smartFallback(message, { categories, parties, totalToGet, totalToGive, topDebtors, recentTx, user: req.user }), action: null, chart: null } });

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 800,
        temperature: 0.4,
        messages: [
          { role:'system', content: systemPrompt },
          ...history.slice(-12).map(m => ({ role: m.role, content: m.content })),
          { role:'user', content: message },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Groq error:', err);
      return res.json({ success: true, data: { reply: smartFallback(message, { categories, parties, totalToGet, totalToGive, topDebtors, recentTx, user: req.user }), action: null, chart: null } });
    }

    const groqData = await response.json();
    let reply = groqData.choices?.[0]?.message?.content || 'Sorry, no response.';

    let chart = null;
    const chartMatch = reply.match(/<chart>([\s\S]*?)<\/chart>/);
    if (chartMatch) {
      try { chart = JSON.parse(chartMatch[1].trim()); reply = reply.replace(/<chart>[\s\S]*?<\/chart>/, '').trim(); }
      catch(e) { console.error('Chart parse error:', e); }
    }

    let action = null;
    const actionMatch = reply.match(/<action>([\s\S]*?)<\/action>/);
    if (actionMatch) {
      try {
        const intent = JSON.parse(actionMatch[1].trim());
        action = await executeIntent(intent, uid, parties, categories);
        reply  = reply.replace(/<action>[\s\S]*?<\/action>/, '').trim();
        if (action?.message) reply = (reply ? reply + '\n\n' : '') + action.message;
      } catch(e) { console.error('Intent exec error:', e); }
    }

    res.json({ success: true, data: { reply, action, chart } });
  } catch(e) {
    console.error('Chat error:', e);
    res.json({ success: true, data: { reply: '🤖 AI unavailable. Check your GROQ_API_KEY on Render.', action: null, chart: null } });
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
      const type  = ['gave','got'].includes(intent.type) ? intent.type : 'gave';
      const delta = type === 'gave' ? +amount : -amount;
      /* ── Fix: atomic $inc here too ── */
      const updated = await require('../models/Party').findByIdAndUpdate(
        party._id, { $inc: { balance: delta } }, { new: true }
      );
      await require('../models/Transaction').create({ userId, partyId: party._id, type, amount: +amount.toFixed(2), note: intent.note||'', date: new Date(), balanceAfter: +updated.balance.toFixed(2) });
      const b = updated.balance;
      const balText = b>0?`to get: ₹${b.toFixed(2)}`:b<0?`to give: ₹${Math.abs(b).toFixed(2)}`:'settled';
      return { message: `✅ ₹${amount} ${type==='gave'?'given to':'received from'} ${party.name}. Balance: ${balText}`, success: true, refresh: true };
    }
    if (intent.intent === 'create_party') {
      if (!intent.name?.trim()) return null;
      let cat = categories.find(c => c.name.toLowerCase() === intent.category?.toLowerCase?.());
      if (!cat && intent.category) {
        cat = await require('../models/Category').create({ userId, name: intent.category.trim(), color:'#1a4fd6', icon:'🏷️' });
        categories.push(cat);
      }
      if (!cat) return { message: `❌ Category "${intent.category}" not found.`, success: false };
      const p = await require('../models/Party').create({ userId, categoryId: cat._id, name: intent.name.trim() });
      return { message: `✅ Party "${p.name}" created under ${cat.name}!`, success: true, refresh: true };
    }
    if (intent.intent === 'create_category') {
      if (!intent.name?.trim()) return null;
      const cat = await require('../models/Category').create({ userId, name: intent.name.trim(), color:'#1a4fd6', icon:'🏷️' });
      return { message: `✅ Category "${cat.name}" created!`, success: true, refresh: true };
    }
    return null;
  } catch(e) {
    console.error('Intent error:', e);
    return { message: '❌ Action failed. Try manually.', success: false };
  }
}

function smartFallback(message, { categories, parties, totalToGet, totalToGive, topDebtors, recentTx, user }) {
  const msg = message.toLowerCase();
  if (msg.match(/hi|hello|hey/))
    return `👋 Hello ${user.name}! Ask me about your balances, parties, or trends.`;
  if (msg.match(/balance|summary|total/))
    return `📊 To GET: ₹${totalToGet.toFixed(2)} | To GIVE: ₹${totalToGive.toFixed(2)}\n${categories.length} categories · ${parties.length} parties`;
  if (msg.match(/who owe|owes|debtor/))
    return topDebtors.length ? topDebtors.map((p,i)=>`${i+1}. ${p.name}: ₹${p.balance.toFixed(2)}`).join('\n') : '✅ No outstanding dues!';
  return `🤖 Ask about your business!\n💡 Add GROQ_API_KEY on Render for full AI.`;
}

module.exports = { chat };
