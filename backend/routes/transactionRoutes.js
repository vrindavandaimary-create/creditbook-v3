const r = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const c = require('../controllers/transactionController');
r.use(protect);
r.get('/',        c.getTransactions);
r.post('/',       c.addTransaction);
r.delete('/:id',  c.deleteTransaction);
module.exports = r;
