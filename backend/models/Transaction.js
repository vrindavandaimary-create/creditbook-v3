const mongoose = require('mongoose');

const txSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true, index: true },
  partyId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
  type:        { type: String, enum: ['gave','got'], required: true },
  amount:      { type: Number, required: true, min: 0.01 },
  note:        { type: String, default: '', trim: true },
  date:        { type: Date, default: Date.now, index: true },
  balanceAfter:{ type: Number, default: 0 }
}, { timestamps: true });

txSchema.index({ userId: 1, partyId: 1, date: -1 });

module.exports = mongoose.model('Transaction', txSchema);
