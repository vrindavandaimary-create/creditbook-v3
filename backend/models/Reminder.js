const mongoose = require('mongoose');

/**
 * Reminder Model
 * Inspired by KhataBook / OkCredit reminder features:
 *  - Payment due reminders  (remind party to pay by a due date)
 *  - Follow-up reminders    (generic follow-up after X days of no activity)
 *  - Balance milestone      (fire when outstanding crosses a threshold)
 *  - Recurring reminders    (weekly / monthly check-ins)
 */
const reminderSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true, index: true },
  partyId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },

  type: {
    type: String,
    enum: ['payment_due', 'follow_up', 'balance_milestone', 'recurring'],
    required: true,
  },

  title:   { type: String, required: true, trim: true },
  message: { type: String, default: '',    trim: true },

  /* When to fire */
  dueDate:         { type: Date },                     // for payment_due
  followUpDays:    { type: Number, min: 1 },           // for follow_up  (fire N days after last tx)
  thresholdAmount: { type: Number, min: 1 },           // for balance_milestone
  recurringUnit:   { type: String, enum: ['weekly', 'monthly'] }, // for recurring

  /* State */
  isActive:   { type: Boolean, default: true,  index: true },
  isSnoozed:  { type: Boolean, default: false },
  snoozeUntil:{ type: Date },
  firedAt:    { type: Date },   // last time this reminder was triggered
  dismissedAt:{ type: Date },

  /* In-app notification (created when reminder fires) */
  notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification' },
}, { timestamps: true });

reminderSchema.index({ userId: 1, partyId: 1 });
reminderSchema.index({ userId: 1, isActive: 1, dueDate: 1 });

module.exports = mongoose.model('Reminder', reminderSchema);
