const Transaction = require('../models/Transaction');
const Party       = require('../models/Party');

// Balance semantics (universal):
//   gave = you gave money → party balance += amount  (they owe you more)
//   got  = you received   → party balance -= amount  (they paid back)
//   balance > 0 = you will GET this amount
//   balance < 0 = you will GIVE this amount

const addTransaction = async (req, res) => {
  try {
    const { partyId, type, amount, note, date } = req.body;
    if (!partyId || !type || !amount)
      return res.status(400).json({ success: false, message: 'partyId, type, amount required.' });
    if (!['gave','got'].includes(type))
      return res.status(400).json({ success: false, message: 'type must be gave or got.' });
    const n = Number(amount);
    if (isNaN(n) || n <= 0)
      return res.status(400).json({ success: false, message: 'Amount must be a positive number.' });

    const party = await Party.findOne({ _id: partyId, userId: req.user._id, isActive: true });
    if (!party) return res.status(404).json({ success: false, message: 'Party not found.' });

    const delta = type === 'gave' ? +n : -n;
    party.balance = +(party.balance + delta).toFixed(2);
    await party.save();

    const tx = await Transaction.create({
      userId: req.user._id, partyId, type,
      amount: +n.toFixed(2),
      note: note?.trim() || '',
      date: date ? new Date(date) : new Date(),
      balanceAfter: party.balance
    });

    res.status(201).json({ success: true, data: { transaction: tx, party } });
  } catch(e) { console.error(e); res.status(500).json({ success: false, message: e.message }); }
};

const getTransactions = async (req, res) => {
  try {
    const { partyId, type, startDate, endDate, limit = 100, page = 1 } = req.query;
    const q = { userId: req.user._id };
    if (partyId)   q.partyId = partyId;
    if (type)      q.type    = type;
    if (startDate || endDate) {
      q.date = {};
      if (startDate) q.date.$gte = new Date(startDate);
      if (endDate)   { const e = new Date(endDate); e.setHours(23,59,59,999); q.date.$lte = e; }
    }
    const skip = (Number(page)-1)*Number(limit);
    const [data, total] = await Promise.all([
      Transaction.find(q).populate('partyId','name').sort({ date:-1 }).limit(Number(limit)).skip(skip).lean(),
      Transaction.countDocuments(q)
    ]);
    res.json({ success: true, count: data.length, total, data });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

const deleteTransaction = async (req, res) => {
  try {
    const tx = await Transaction.findOne({ _id: req.params.id, userId: req.user._id });
    if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found.' });

    const party = await Party.findById(tx.partyId);
    if (party) {
      const delta = tx.type === 'gave' ? -tx.amount : +tx.amount;
      party.balance = +(party.balance + delta).toFixed(2);
      await party.save();
    }
    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted.', data: { party } });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

module.exports = { addTransaction, getTransactions, deleteTransaction };
