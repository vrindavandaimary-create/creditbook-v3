const Party       = require('../models/Party');
const Category    = require('../models/Category');
const Transaction = require('../models/Transaction');

const getParties = async (req, res) => {
  try {
    const { categoryId, search } = req.query;
    const q = { userId: req.user._id, isActive: true };
    if (categoryId) q.categoryId = categoryId;
    if (search)     q.name = { $regex: search, $options: 'i' };
    const data = await Party.find(q).populate('categoryId','name color icon').sort({ updatedAt: -1 }).lean();
    res.json({ success: true, count: data.length, data });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

const getParty = async (req, res) => {
  try {
    const party = await Party.findOne({ _id: req.params.id, userId: req.user._id }).populate('categoryId','name color icon');
    if (!party) return res.status(404).json({ success: false, message: 'Party not found.' });
    const transactions = await Transaction.find({ partyId: req.params.id, userId: req.user._id }).sort({ date: -1 }).lean();
    res.json({ success: true, data: { party, transactions } });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

const createParty = async (req, res) => {
  try {
    const { name, categoryId, phone, email, address, notes } = req.body;
    if (!name?.trim())  return res.status(400).json({ success: false, message: 'Name is required.' });
    if (!categoryId)    return res.status(400).json({ success: false, message: 'Category is required.' });
    const cat = await Category.findOne({ _id: categoryId, userId: req.user._id });
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found.' });
    const party = await Party.create({
      userId: req.user._id, categoryId,
      name: name.trim(), phone: phone?.trim() || '', email: email?.trim() || '',
      address: address?.trim() || '', notes: notes?.trim() || ''
    });
    const populated = await Party.findById(party._id).populate('categoryId','name color icon');
    res.status(201).json({ success: true, data: populated });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

const updateParty = async (req, res) => {
  try {
    const allowed = ['name','categoryId','phone','email','address','notes'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    if (updates.name) updates.name = updates.name.trim();
    if (updates.categoryId) {
      const cat = await Category.findOne({ _id: updates.categoryId, userId: req.user._id });
      if (!cat) return res.status(404).json({ success: false, message: 'Category not found.' });
    }
    const party = await Party.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, updates, { new: true })
      .populate('categoryId','name color icon');
    if (!party) return res.status(404).json({ success: false, message: 'Party not found.' });
    res.json({ success: true, data: party });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

const deleteParty = async (req, res) => {
  try {
    const party = await Party.findOne({ _id: req.params.id, userId: req.user._id });
    if (!party) return res.status(404).json({ success: false, message: 'Party not found.' });
    await Transaction.deleteMany({ partyId: req.params.id });
    await Party.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Party deleted.' });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

module.exports = { getParties, getParty, createParty, updateParty, deleteParty };
