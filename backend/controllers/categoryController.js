const Category    = require('../models/Category');
const Party       = require('../models/Party');
const Transaction = require('../models/Transaction');

const getCategories = async (req, res) => {
  try {
    const cats = await Category.find({ userId: req.user._id }).sort({ createdAt: 1 }).lean();
    // Attach party count and balance sum to each category
    const withStats = await Promise.all(cats.map(async (c) => {
      const parties = await Party.find({ userId: req.user._id, categoryId: c._id, isActive: true }).lean();
      const toGet  = parties.filter(p => p.balance > 0).reduce((s, p) => s + p.balance, 0);
      const toGive = parties.filter(p => p.balance < 0).reduce((s, p) => s + Math.abs(p.balance), 0);
      return { ...c, partyCount: parties.length, toGet: +toGet.toFixed(2), toGive: +toGive.toFixed(2) };
    }));
    res.json({ success: true, data: withStats });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

const createCategory = async (req, res) => {
  try {
    const { name, color, icon } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Category name is required.' });
    const existing = await Category.findOne({ userId: req.user._id, name: { $regex: `^${name.trim()}$`, $options: 'i' } });
    if (existing) return res.status(400).json({ success: false, message: 'Category name already exists.' });
    const cat = await Category.create({
      userId: req.user._id,
      name: name.trim(),
      color: color || '#1a4fd6',
      icon: icon || '👥'
    });
    res.status(201).json({ success: true, data: { ...cat.toObject(), partyCount: 0, toGet: 0, toGive: 0 } });
  } catch(e) {
    if (e.code === 11000) return res.status(400).json({ success: false, message: 'Category already exists.' });
    res.status(500).json({ success: false, message: e.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { name, color, icon } = req.body;
    const cat = await Category.findOne({ _id: req.params.id, userId: req.user._id });
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found.' });
    if (name?.trim()) {
      const dup = await Category.findOne({ userId: req.user._id, name: { $regex: `^${name.trim()}$`, $options: 'i' }, _id: { $ne: req.params.id } });
      if (dup) return res.status(400).json({ success: false, message: 'Category name already exists.' });
      cat.name = name.trim();
    }
    if (color) cat.color = color;
    if (icon)  cat.icon  = icon;
    await cat.save();
    res.json({ success: true, data: cat });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

const deleteCategory = async (req, res) => {
  try {
    const { action, moveToCategoryId } = req.body; // action: 'delete_parties' | 'move_parties'
    const cat = await Category.findOne({ _id: req.params.id, userId: req.user._id });
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found.' });

    const parties = await Party.find({ userId: req.user._id, categoryId: req.params.id });

    if (action === 'move_parties') {
      if (!moveToCategoryId) return res.status(400).json({ success: false, message: 'moveToCategoryId required.' });
      const target = await Category.findOne({ _id: moveToCategoryId, userId: req.user._id });
      if (!target) return res.status(404).json({ success: false, message: 'Target category not found.' });
      await Party.updateMany({ userId: req.user._id, categoryId: req.params.id }, { categoryId: moveToCategoryId });
    } else {
      // delete all parties and their transactions
      for (const p of parties) {
        await Transaction.deleteMany({ partyId: p._id });
      }
      await Party.deleteMany({ userId: req.user._id, categoryId: req.params.id });
    }

    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Category deleted.' });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
