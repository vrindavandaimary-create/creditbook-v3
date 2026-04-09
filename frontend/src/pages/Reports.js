const Category    = require('../models/Category');
const Party       = require('../models/Party');
const Transaction = require('../models/Transaction');
const Bill        = require('../models/Bill');

const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getCategories = async (req, res) => {
  try {
    const uid  = req.user._id;
    const cats = await Category.find({ userId: uid }).sort({ createdAt: 1 }).lean();
    const stats = await Party.aggregate([
      { $match: { userId: uid, isActive: true } },
      { $group: {
        _id:    '$categoryId',
        count:  { $sum: 1 },
        toGet:  { $sum: { $cond: [{ $gt: ['$balance', 0] }, '$balance', 0] } },
        toGive: { $sum: { $cond: [{ $lt: ['$balance', 0] }, { $abs: '$balance' }, 0] } },
      }},
    ]);
    const statsMap = {};
    stats.forEach(s => { statsMap[s._id.toString()] = s; });
    const withStats = cats.map(c => {
      const s = statsMap[c._id.toString()] || { count:0, toGet:0, toGive:0 };
      return { ...c, partyCount: s.count, toGet: +s.toGet.toFixed(2), toGive: +s.toGive.toFixed(2) };
    });
    res.json({ success: true, data: withStats });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

const createCategory = async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Category name is required.' });
    const escaped  = escapeRegex(name.trim());
    const existing = await Category.findOne({ userId: req.user._id, name: { $regex:`^${escaped}$`, $options:'i' } });
    if (existing)  return res.status(400).json({ success: false, message: 'Category name already exists.' });
    const cat = await Category.create({ userId: req.user._id, name: name.trim(), color: color || '#1a4fd6' });
    res.status(201).json({ success: true, data: { ...cat.toObject(), partyCount:0, toGet:0, toGive:0 } });
  } catch(e) {
    if (e.code === 11000) return res.status(400).json({ success: false, message: 'Category already exists.' });
    res.status(500).json({ success: false, message: e.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { name, color } = req.body;
    const cat = await Category.findOne({ _id: req.params.id, userId: req.user._id });
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found.' });
    if (name?.trim()) {
      const escaped = escapeRegex(name.trim());
      const dup = await Category.findOne({ userId: req.user._id, name: { $regex:`^${escaped}$`, $options:'i' }, _id: { $ne: req.params.id } });
      if (dup) return res.status(400).json({ success: false, message: 'Category name already exists.' });
      cat.name = name.trim();
    }
    if (color) cat.color = color;
    await cat.save();
    res.json({ success: true, data: cat });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

const deleteCategory = async (req, res) => {
  try {
    const { action, moveToCategoryId } = req.body;
    if (!action || !['delete_parties','move_parties'].includes(action))
      return res.status(400).json({ success: false, message: 'action required: delete_parties or move_parties.' });
    const cat = await Category.findOne({ _id: req.params.id, userId: req.user._id });
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found.' });
    const parties = await Party.find({ userId: req.user._id, categoryId: req.params.id });
    if (action === 'move_parties') {
      if (!moveToCategoryId) return res.status(400).json({ success: false, message: 'moveToCategoryId required.' });
      const target = await Category.findOne({ _id: moveToCategoryId, userId: req.user._id });
      if (!target) return res.status(404).json({ success: false, message: 'Target category not found.' });
      await Party.updateMany({ userId: req.user._id, categoryId: req.params.id }, { categoryId: moveToCategoryId });
    } else {
      const partyIds = parties.map(p => p._id);
      await Promise.all([
        Transaction.deleteMany({ partyId: { $in: partyIds } }),
        Bill.deleteMany({ partyId: { $in: partyIds } }),
      ]);
      await Party.deleteMany({ userId: req.user._id, categoryId: req.params.id });
    }
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Category deleted.' });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
