const mongoose = require('mongoose');

const partySchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true, index: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  name:       { type: String, required: true, trim: true },
  phone:      { type: String, default: '', trim: true },
  email:      { type: String, default: '', trim: true, lowercase: true },
  address:    { type: String, default: '', trim: true },
  notes:      { type: String, default: '' },
  balance:    { type: Number, default: 0 },
  isActive:   { type: Boolean, default: true }
}, { timestamps: true });

partySchema.index({ userId: 1, categoryId: 1 });

module.exports = mongoose.model('Party', partySchema);
