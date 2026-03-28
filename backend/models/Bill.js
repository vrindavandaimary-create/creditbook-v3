const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name:  { type: String, required: true, trim: true },
  qty:   { type: Number, required: true, min: 0 },
  price: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 }
}, { _id: false });

const billSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true, index: true },
  partyId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
  billNumber: { type: String, default: '' },
  items:      { type: [itemSchema], default: [] },
  subtotal:   { type: Number, default: 0 },
  discount:   { type: Number, default: 0 },
  total:      { type: Number, default: 0 },
  notes:      { type: String, default: '' },
  date:       { type: Date, default: Date.now, index: true },
  status:     { type: String, enum: ['unpaid','paid','partial'], default: 'unpaid' },
  receiptImage: { type: String, default: '' },
  savedAsTransaction: { type: Boolean, default: false },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null }
}, { timestamps: true });

billSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('Bill', billSchema);
