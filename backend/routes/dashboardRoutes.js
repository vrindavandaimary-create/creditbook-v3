const r = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const c = require('../controllers/dashboardController');
r.use(protect);
r.get('/', c.getDashboard);
module.exports = r;
