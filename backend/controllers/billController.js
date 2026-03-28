const Bill        = require('../models/Bill');
const Party       = require('../models/Party');
const Transaction = require('../models/Transaction');
const path        = require('path');
const fs          = require('fs');

const getBills = async (req, res) => {
  try {
    const { partyId, status, limit = 50, page = 1 } = req.query;
    const q = { userId: req.user._id };
    if (partyId) q.partyId = partyId;
    if (status)  q.status  = status;
    const skip = (Number(page)-1)*Number(limit);
    const [data, total] = await Promise.all([
      Bill.find(q).populate('partyId','name').sort({ date:-1 }).limit(Number(limit)).skip(skip).lean(),
      Bill.countDocuments(q)
    ]);
    res.json({ success: true, count: data.length, total, data });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

const getBill = async (req, res) => {
  try {
    const bill = await Bill.findOne({ _id: req.params.id, userId: req.user._id })
      .populate({ path: 'partyId', select: 'name phone address', populate: { path: 'categoryId', select: 'name' } });
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found.' });
    res.json({ success: true, data: bill });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

const createBill = async (req, res) => {
  try {
    const { partyId, items: itemsRaw, discount = 0, notes, date, billNumber } = req.body;
    const receiptImage = req.file ? `/uploads/${req.file.filename}` : '';

    if (!partyId) return res.status(400).json({ success: false, message: 'partyId required.' });

    let items;
    try { items = typeof itemsRaw === 'string' ? JSON.parse(itemsRaw) : itemsRaw; }
    catch { return res.status(400).json({ success: false, message: 'Invalid items format.' }); }

    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ success: false, message: 'At least one item required.' });

    const party = await Party.findOne({ _id: partyId, userId: req.user._id, isActive: true });
    if (!party) return res.status(404).json({ success: false, message: 'Party not found.' });

    const validItems = items.map((it, i) => {
      if (!it.name?.trim()) throw new Error(`Item ${i+1} missing name.`);
      const qty   = Number(it.qty);
      const price = Number(it.price);
      if (qty <= 0)  throw new Error(`Item "${it.name}" qty must be > 0.`);
      if (price < 0) throw new Error(`Item "${it.name}" price cannot be negative.`);
      return { name: it.name.trim(), qty: +qty.toFixed(3), price: +price.toFixed(2), total: +(qty*price).toFixed(2) };
    });

    const subtotal = +validItems.reduce((s,i)=>s+i.total,0).toFixed(2);
    const disc     = +Math.min(Number(discount)||0, subtotal).toFixed(2);
    const total    = +(subtotal - disc).toFixed(2);

    const count = await Bill.countDocuments({ userId: req.user._id });
    const num   = billNumber?.trim() || `BILL-${String(count+1).padStart(4,'0')}`;

    const bill = await Bill.create({
      userId: req.user._id, partyId,
      billNumber: num, items: validItems,
      subtotal, discount: disc, total,
      notes: notes?.trim() || '',
      date: date ? new Date(date) : new Date(),
      receiptImage
    });

    const populated = await Bill.findById(bill._id).populate('partyId','name');
    res.status(201).json({ success: true, data: populated });
  } catch(e) {
    if (req.file) fs.unlink(req.file.path, ()=>{});
    if (e.message.includes('Item')) return res.status(400).json({ success: false, message: e.message });
    res.status(500).json({ success: false, message: e.message });
  }
};

const updateBillStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['unpaid','paid','partial'].includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    const bill = await Bill.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { status }, { new: true })
      .populate('partyId','name');
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found.' });
    res.json({ success: true, data: bill });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

const saveBillAsTransaction = async (req, res) => {
  try {
    const bill = await Bill.findOne({ _id: req.params.id, userId: req.user._id });
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found.' });
    if (bill.savedAsTransaction) return res.status(400).json({ success: false, message: 'Already saved as transaction.' });

    const party = await Party.findOne({ _id: bill.partyId, userId: req.user._id, isActive: true });
    if (!party) return res.status(404).json({ success: false, message: 'Party not found.' });

    party.balance = +(party.balance + bill.total).toFixed(2);
    await party.save();

    const tx = await Transaction.create({
      userId: req.user._id, partyId: bill.partyId,
      type: 'gave', amount: bill.total,
      note: `Bill ${bill.billNumber}`,
      date: bill.date, balanceAfter: party.balance
    });

    bill.savedAsTransaction = true;
    bill.transactionId = tx._id;
    await bill.save();

    res.json({ success: true, message: 'Saved as transaction.', data: { bill, transaction: tx, party } });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

const deleteBill = async (req, res) => {
  try {
    const bill = await Bill.findOne({ _id: req.params.id, userId: req.user._id });
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found.' });

    if (bill.savedAsTransaction && bill.transactionId) {
      const tx = await Transaction.findById(bill.transactionId);
      if (tx) {
        const party = await Party.findById(bill.partyId);
        if (party) { party.balance = +(party.balance - bill.total).toFixed(2); await party.save(); }
        await Transaction.findByIdAndDelete(bill.transactionId);
      }
    }
    if (bill.receiptImage) {
      const imgPath = path.join(__dirname, '..', bill.receiptImage);
      fs.unlink(imgPath, ()=>{});
    }
    await Bill.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Bill deleted.' });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

module.exports = { getBills, getBill, createBill, updateBillStatus, saveBillAsTransaction, deleteBill };
