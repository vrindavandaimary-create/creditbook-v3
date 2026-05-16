const r = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const c = require('../controllers/reminderController');

r.use(protect);

r.get('/',           c.getReminders);
r.post('/',          c.createReminder);
r.get('/check',      c.checkReminders);          // on-demand fire check
r.put('/:id',        c.updateReminder);
r.delete('/:id',     c.deleteReminder);
r.post('/:id/snooze',  c.snoozeReminder);
r.post('/:id/dismiss', c.dismissReminder);

module.exports = r;
