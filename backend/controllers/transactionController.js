const Transaction = require('../models/Transaction');
const Party       = require('../models/Party');
const { fireTransactionNotifications } = require('./reminderController');

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
    if (n > 900000)
      return res.status(400).json({ success: false, message: 'Amount cannot exceed ₹9,00,000.' });

    const existing = await Party.findOne({ _id: partyId, userId: req.user._id, isActive: true });
    if (!existing) return res.status(404).json({ success: false, message: 'Party not found.' });

    /* ── Atomic balance update — fixes race condition ── */
    const delta = type === 'gave' ? +n : -n;
    const party = await Party.findByIdAndUpdate(
      partyId,
      { $inc: { balance: delta } },
      { new: true }
    );

    const tx = await Transaction.create({
      userId: req.user._id, partyId, type,
      amount: +n.toFixed(2),
      note:   note?.trim() || '',
      date:   date ? (() => {
        // If it's a full ISO string, use as-is
        if (date.includes('T')) return new Date(date);
        // Date-only (YYYY-MM-DD): combine with current local time to preserve exact moment
        const now = new Date();
        const [y,m,d] = date.split('-').map(Number);
        return new Date(y, m-1, d, now.getHours(), now.getMinutes(), now.getSeconds());
      })() : new Date(),
      balanceAfter: +party.balance.toFixed(2),
    });

    // Fire event-based notifications (balance milestone, large tx, settled)
    fireTransactionNotifications({ userId: req.user._id, party, transaction: tx }).catch(() => {});

    res.status(201).json({ success: true, data: { transaction: tx, party } });
  } catch(e) { console.error(e); res.status(500).json({ success: false, message: e.message }); }
};

const getTransactions = async (req, res) => {
  try {
    const { partyId, type, startDate, endDate, limit = 500, page = 1 } = req.query;
    const q = { userId: req.user._id };
    if (partyId) q.partyId = partyId;
    if (type)    q.type    = type;
    if (startDate || endDate) {
      q.date = {};
      if (startDate) q.date.$gte = new Date(startDate);
      if (endDate)   { const e = new Date(endDate); e.setHours(23,59,59,999); q.date.$lte = e; }
    }
    const skip = (Number(page)-1) * Number(limit);
    const [data, total] = await Promise.all([
      Transaction.find(q).populate('partyId','name').sort({ date:-1 }).limit(Number(limit)).skip(skip).lean(),
      Transaction.countDocuments(q),
    ]);
    res.json({ success: true, count: data.length, total, data });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

const deleteTransaction = async (req, res) => {
  try {
    const tx = await Transaction.findOne({ _id: req.params.id, userId: req.user._id });
    if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found.' });

    /* ── Atomic balance reversal ── */
    const delta = tx.type === 'gave' ? -tx.amount : +tx.amount;
    const party = await Party.findByIdAndUpdate(
      tx.partyId,
      { $inc: { balance: delta } },
      { new: true }
    );

    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted.', data: { party } });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};


/* ── PUT /api/transactions/:id — edit amount, type, note, date ── */
const updateTransaction = async (req, res) => {
  try {
    const { amount, type, note, date } = req.body;
    /* Find tx AND verify it belongs to this user in one query */
    const tx = await Transaction.findOne({ _id: req.params.id, userId: req.user._id });
    if (!tx) return res.status(404).json({ success:false, message:'Transaction not found.' });

    /* Get the party */
    const party = await Party.findOne({ _id: tx.partyId, userId: req.user._id });
    if (!party) return res.status(403).json({ success:false, message:'Not authorised.' });

    const oldAmount = tx.amount;
    const oldType   = tx.type;

    const newN    = Number(amount) || oldAmount;
    const newType = type || oldType;
    if (newN > 1000000000)
      return res.status(400).json({ success:false, message:'Amount cannot exceed ₹10,00,00,000.' });

    /* Balance direction matches addTransaction exactly:
       gave = party owes us more  → balance +n
       got  = party paid us       → balance -n
       To update: reverse old effect, apply new effect */
    const oldDelta = oldType === 'gave' ? +oldAmount : -oldAmount;
    const newDelta = newType === 'gave' ? +newN      : -newN;
    const balanceDiff = newDelta - oldDelta;

    await Party.findByIdAndUpdate(party._id, { $inc: { balance: balanceDiff } });

    /* Update transaction */
    tx.amount = newN;
    tx.type   = newType;
    if (note !== undefined) tx.note = note;
    if (date) {
      tx.date = date.includes('T') ? new Date(date) : (() => {
        const now = new Date();
        const [y,m,d2] = date.split('-').map(Number);
        return new Date(y, m-1, d2, now.getHours(), now.getMinutes(), now.getSeconds());
      })();
    }
    await tx.save();

    const updatedParty = await Party.findById(party._id);
    res.json({ success:true, data:{ transaction:tx, party:updatedParty } });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

module.exports = { addTransaction, getTransactions, deleteTransaction, updateTransaction };
