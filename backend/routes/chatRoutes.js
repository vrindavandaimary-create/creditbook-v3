const r = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const c = require('../controllers/chatController');
r.use(protect);
r.post('/', c.chat);
module.exports = r;
