const mongoose = require('mongoose');

/**
 * Notification Model
 * Stores in-app bell notifications surfaced to the user in the UI.
 * Generated when:
 *   - A Reminder fires (cron or on-demand check)
 *   - A large transaction is recorded
 *   - A party balance crosses zero (fully settled)
 */
const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  type: {
    type: String,
    enum: [
      'reminder_due',        // a payment-due or follow-up reminder fired
      'payment_received',    // party made a payment (balance reduced to 0 or went positive)
      'balance_settled',     // party balance exactly = 0
      'balance_milestone',   // outstanding exceeded threshold
      'large_transaction',   // single transaction > threshold (e.g. ₹5000)
      'recurring_checkin',   // weekly / monthly recurring nudge
    ],
    required: true,
  },

  title:   { type: String, required: true },
  body:    { type: String, default: '' },
  icon:    { type: String, default: '🔔' },

  /* Linked entities */
  partyId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Party' },
  reminderId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Reminder' },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },

  /* State */
  isRead:     { type: Boolean, default: false, index: true },
  readAt:     { type: Date },
}, { timestamps: true });

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
