const Party       = require('../models/Party');
const Transaction = require('../models/Transaction');
const Category    = require('../models/Category');

const getDashboard = async (req, res) => {
  try {
    const uid = req.user._id;
    const [categories, parties, recentTx] = await Promise.all([
      Category.find({ userId: uid }).lean(),
      Party.find({ userId: uid, isActive: true }).lean(),
      Transaction.find({ userId: uid }).populate('partyId','name').sort({ date:-1 }).limit(10).lean()
    ]);

    const totalToGet  = parties.filter(p=>p.balance>0).reduce((s,p)=>s+p.balance,0);
    const totalToGive = parties.filter(p=>p.balance<0).reduce((s,p)=>s+Math.abs(p.balance),0);

    // group parties by category
    const grouped = categories.map(c => {
      const ps = parties.filter(p => p.categoryId.toString() === c._id.toString());
      return {
        category: c,
        parties: ps,
        toGet:  +ps.filter(p=>p.balance>0).reduce((s,p)=>s+p.balance,0).toFixed(2),
        toGive: +ps.filter(p=>p.balance<0).reduce((s,p)=>s+Math.abs(p.balance),0).toFixed(2)
      };
    });

    res.json({
      success: true,
      data: {
        grouped,
        totalToGet:   +totalToGet.toFixed(2),
        totalToGive:  +totalToGive.toFixed(2),
        partyCount:   parties.length,
        categoryCount:categories.length,
        recentTransactions: recentTx
      }
    });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

module.exports = { getDashboard };
