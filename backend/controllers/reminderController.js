/**
 * reminderController.js
 *
 * Handles:
 *  - CRUD for reminders (per party)
 *  - Snooze / dismiss
 *  - On-demand check that fires pending reminders
 *  - Automatic firing triggered by transaction events
 *
 * PRODUCTION FIXES applied:
 *  - payment_due / follow_up: 12-hour cooldown so polling the endpoint
 *    every 60 s does not spam duplicate notifications
 *  - balance_milestone: 6-hour cooldown between re-fires
 *  - fireTransactionNotifications: only called on new transactions (not edits)
 */

const Reminder     = require('../models/Reminder');
const Notification = require('../models/Notification');
const Party        = require('../models/Party');
const Transaction  = require('../models/Transaction');

/* ─────────────────────────────────────────
   Internal helper
───────────────────────────────────────── */
async function createNotification({ userId, type, title, body, icon, partyId, reminderId, transactionId }) {
  try {
    return await Notification.create({
      userId, type, title, body, icon: icon || '🔔',
      partyId, reminderId, transactionId,
    });
  } catch (e) {
    console.error('createNotification error:', e.message);
    return null;
  }
}

/* ─────────────────────────────────────────
   GET /api/reminders?partyId=&type=&active=
───────────────────────────────────────── */
const getReminders = async (req, res) => {
  try {
    const { partyId, type, active } = req.query;
    const q = { userId: req.user._id };
    if (partyId) q.partyId = partyId;
    if (type)    q.type    = type;
    if (active !== undefined) q.isActive = active === 'true';

    const data = await Reminder.find(q)
      .populate('partyId', 'name phone balance')
      .sort({ dueDate: 1, createdAt: -1 })
      .lean();

    res.json({ success: true, count: data.length, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

/* ─────────────────────────────────────────
   POST /api/reminders
───────────────────────────────────────── */
const createReminder = async (req, res) => {
  try {
    const { partyId, type, title, message, dueDate, followUpDays, thresholdAmount, recurringUnit } = req.body;

    if (!partyId || !type || !title?.trim())
      return res.status(400).json({ success: false, message: 'partyId, type and title are required.' });

    const validTypes = ['payment_due', 'follow_up', 'balance_milestone', 'recurring'];
    if (!validTypes.includes(type))
      return res.status(400).json({ success: false, message: `type must be one of: ${validTypes.join(', ')}.` });

    const party = await Party.findOne({ _id: partyId, userId: req.user._id, isActive: true });
    if (!party) return res.status(404).json({ success: false, message: 'Party not found.' });

    if (type === 'payment_due' && !dueDate)
      return res.status(400).json({ success: false, message: 'dueDate is required for payment_due reminders.' });
    if (type === 'follow_up' && (!followUpDays || followUpDays < 1))
      return res.status(400).json({ success: false, message: 'followUpDays (≥1) is required for follow_up reminders.' });
    if (type === 'balance_milestone' && (!thresholdAmount || thresholdAmount < 1))
      return res.status(400).json({ success: false, message: 'thresholdAmount (≥1) is required for balance_milestone reminders.' });
    if (type === 'recurring' && !['weekly', 'monthly'].includes(recurringUnit))
      return res.status(400).json({ success: false, message: 'recurringUnit must be weekly or monthly.' });

    const reminder = await Reminder.create({
      userId: req.user._id, partyId,
      type, title: title.trim(), message: message?.trim() || '',
      dueDate:         dueDate         ? new Date(dueDate)        : undefined,
      followUpDays:    followUpDays    ? Number(followUpDays)     : undefined,
      thresholdAmount: thresholdAmount ? Number(thresholdAmount)  : undefined,
      recurringUnit:   recurringUnit   || undefined,
    });

    const populated = await Reminder.findById(reminder._id).populate('partyId', 'name phone balance');
    res.status(201).json({ success: true, data: populated });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

/* ─────────────────────────────────────────
   PUT /api/reminders/:id
───────────────────────────────────────── */
const updateReminder = async (req, res) => {
  try {
    const allowed = ['title', 'message', 'dueDate', 'followUpDays', 'thresholdAmount', 'recurringUnit', 'isActive'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    if (updates.dueDate) updates.dueDate = new Date(updates.dueDate);

    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      updates,
      { new: true }
    ).populate('partyId', 'name phone balance');

    if (!reminder) return res.status(404).json({ success: false, message: 'Reminder not found.' });
    res.json({ success: true, data: reminder });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

/* ─────────────────────────────────────────
   DELETE /api/reminders/:id
───────────────────────────────────────── */
const deleteReminder = async (req, res) => {
  try {
    const r = await Reminder.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!r) return res.status(404).json({ success: false, message: 'Reminder not found.' });
    res.json({ success: true, message: 'Reminder deleted.' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

/* ─────────────────────────────────────────
   POST /api/reminders/:id/snooze
   body: { hours: 24 }
───────────────────────────────────────── */
const snoozeReminder = async (req, res) => {
  try {
    const hours = Math.max(1, Math.min(168, Number(req.body.hours) || 24));
    const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000);

    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isSnoozed: true, snoozeUntil },
      { new: true }
    ).populate('partyId', 'name phone balance');

    if (!reminder) return res.status(404).json({ success: false, message: 'Reminder not found.' });
    res.json({ success: true, data: reminder, snoozeUntil });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

/* ─────────────────────────────────────────
   POST /api/reminders/:id/dismiss
───────────────────────────────────────── */
const dismissReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isActive: false, dismissedAt: new Date(), isSnoozed: false },
      { new: true }
    );
    if (!reminder) return res.status(404).json({ success: false, message: 'Reminder not found.' });
    res.json({ success: true, message: 'Reminder dismissed.' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

/* ─────────────────────────────────────────
   GET /api/reminders/check
   On-demand: evaluate active reminders and create Notification
   docs for any that are due. Called by the frontend bell on load
   and every POLL_INTERVAL_MS.

   DEDUPLICATION: each type uses a per-reminder cooldown stored in
   firedAt, so calling this endpoint repeatedly never creates duplicate
   notifications within the cooldown window.
───────────────────────────────────────── */
const COOLDOWN_12H = 12 * 60 * 60 * 1000;

const checkReminders = async (req, res) => {
  try {
    const userId = req.user._id;
    const now    = new Date();
    const fired  = [];

    const notFiredRecentlyFilter = (cooldownMs) => ({
      $or: [
        { firedAt: { $exists: false } },
        { firedAt: null },
        { firedAt: { $lte: new Date(now.getTime() - cooldownMs) } },
      ],
    });

    const notSnoozedFilter = {
      $or: [{ isSnoozed: false }, { snoozeUntil: { $lte: now } }],
    };

    /* ── 1. payment_due ── */
    const warningMs = 3 * 24 * 60 * 60 * 1000;
    const dueReminders = await Reminder.find({
      userId, type: 'payment_due', isActive: true,
      dueDate: { $lte: new Date(now.getTime() + warningMs) },
      ...notSnoozedFilter,
      ...notFiredRecentlyFilter(COOLDOWN_12H),
    }).populate('partyId', 'name balance');

    for (const r of dueReminders) {
      if (!r.partyId || r.partyId.balance <= 0) continue;
      const isOverdue = r.dueDate <= now;
      const daysLeft  = Math.ceil((r.dueDate - now) / (24 * 60 * 60 * 1000));
      const icon      = isOverdue ? '🚨' : '⏰';
      const timeLabel = isOverdue
        ? `${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} overdue`
        : daysLeft === 0 ? 'due today' : `due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;

      const notif = await createNotification({
        userId, type: 'reminder_due',
        title: `${icon} ${r.partyId.name} – Payment ${timeLabel}`,
        body:  r.message || `Outstanding: ₹${r.partyId.balance.toLocaleString('en-IN')}`,
        icon, partyId: r.partyId._id, reminderId: r._id,
      });
      await Reminder.findByIdAndUpdate(r._id, {
        firedAt: now, isSnoozed: false, notificationId: notif?._id,
      });
      fired.push({ reminderId: r._id, type: 'payment_due' });
    }

    /* ── 2. follow_up ── */
    const followUpReminders = await Reminder.find({
      userId, type: 'follow_up', isActive: true,
      ...notSnoozedFilter,
      ...notFiredRecentlyFilter(COOLDOWN_12H),
    }).populate('partyId', 'name balance');

    for (const r of followUpReminders) {
      if (!r.partyId || r.partyId.balance <= 0) continue;
      const cutoff = new Date(now.getTime() - r.followUpDays * 24 * 60 * 60 * 1000);
      const recentTx = await Transaction.findOne({
        partyId: r.partyId._id, date: { $gte: cutoff },
      });
      if (recentTx) continue;

      const notif = await createNotification({
        userId, type: 'reminder_due',
        title: `🔔 Follow up with ${r.partyId.name}`,
        body:  r.message || `No activity in ${r.followUpDays} day${r.followUpDays !== 1 ? 's' : ''}. Outstanding: ₹${r.partyId.balance.toLocaleString('en-IN')}`,
        icon: '🔔', partyId: r.partyId._id, reminderId: r._id,
      });
      await Reminder.findByIdAndUpdate(r._id, { firedAt: now, notificationId: notif?._id });
      fired.push({ reminderId: r._id, type: 'follow_up' });
    }

    /* ── 3. recurring ── */
    const recurringReminders = await Reminder.find({
      userId, type: 'recurring', isActive: true,
      ...notSnoozedFilter,
    }).populate('partyId', 'name balance');

    for (const r of recurringReminders) {
      if (!r.partyId) continue;
      const intervalMs = r.recurringUnit === 'weekly'
        ? 7  * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;
      if (r.firedAt && (now - r.firedAt) < intervalMs) continue;

      const notif = await createNotification({
        userId, type: 'recurring_checkin',
        title: `📅 ${r.recurringUnit === 'weekly' ? 'Weekly' : 'Monthly'} check-in: ${r.partyId.name}`,
        body:  r.message || `Current balance: ₹${Math.abs(r.partyId.balance).toLocaleString('en-IN')} ${r.partyId.balance > 0 ? 'due' : 'advance'}`,
        icon: '📅', partyId: r.partyId._id, reminderId: r._id,
      });
      await Reminder.findByIdAndUpdate(r._id, { firedAt: now, notificationId: notif?._id });
      fired.push({ reminderId: r._id, type: 'recurring' });
    }

    res.json({ success: true, fired: fired.length, data: fired });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

/* ─────────────────────────────────────────
   Exported helper — called ONLY from addTransaction (not updateTransaction).
   Fires event-based notifications: settled, large tx, balance milestone.

   balance_milestone: 6-hour cooldown so rapidly entering multiple large
   transactions doesn't flood the user.
───────────────────────────────────────── */
const MILESTONE_COOLDOWN = 6 * 60 * 60 * 1000;

const fireTransactionNotifications = async ({ userId, party, transaction }) => {
  try {
    const now = new Date();

    /* Balance settled (only when a payment is received) */
    if (party.balance === 0 && transaction.type === 'got') {
      await createNotification({
        userId, type: 'balance_settled',
        title: `✅ ${party.name} has fully paid up!`,
        body:  'All dues cleared. Balance is now ₹0.',
        icon: '✅', partyId: party._id, transactionId: transaction._id,
      });
    }

    /* Large transaction alert (≥ ₹10,000) */
    if (transaction.amount >= 10000) {
      await createNotification({
        userId, type: 'large_transaction',
        title: `💰 Large transaction with ${party.name}`,
        body:  `₹${transaction.amount.toLocaleString('en-IN')} ${transaction.type === 'gave' ? 'given' : 'received'}.`,
        icon: '💰', partyId: party._id, transactionId: transaction._id,
      });
    }

    /* Balance milestone — with 6-hour cooldown per reminder */
    const milestoneReminders = await Reminder.find({
      userId, partyId: party._id, type: 'balance_milestone', isActive: true,
      $or: [
        { firedAt: { $exists: false } },
        { firedAt: null },
        { firedAt: { $lte: new Date(now.getTime() - MILESTONE_COOLDOWN) } },
      ],
    });
    for (const r of milestoneReminders) {
      if (Math.abs(party.balance) >= r.thresholdAmount) {
        await createNotification({
          userId, type: 'balance_milestone',
          title: `⚠️ Balance alert: ${party.name}`,
          body:  r.message || `Outstanding has reached ₹${Math.abs(party.balance).toLocaleString('en-IN')} (threshold: ₹${r.thresholdAmount.toLocaleString('en-IN')})`,
          icon: '⚠️', partyId: party._id, reminderId: r._id, transactionId: transaction._id,
        });
        await Reminder.findByIdAndUpdate(r._id, { firedAt: now });
      }
    }
  } catch (e) {
    console.error('fireTransactionNotifications error:', e.message);
  }
};

module.exports = {
  getReminders, createReminder, updateReminder, deleteReminder,
  snoozeReminder, dismissReminder, checkReminders,
  fireTransactionNotifications,
};
