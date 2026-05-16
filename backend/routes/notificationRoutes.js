const r = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const c = require('../controllers/notificationController');

r.use(protect);

r.get('/',              c.getNotifications);
r.post('/read-all',     c.markAllRead);
r.delete('/',           c.clearRead);            // DELETE / — clear all read
r.post('/:id/read',     c.markRead);
r.delete('/:id',        c.deleteNotification);

module.exports = r;
