const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  phone:        { type: String, required: true, unique: true, trim: true },
  email:        { type: String, trim: true, lowercase: true, default: '' },
  businessName: { type: String, default: 'My Business', trim: true },
  isActive:     { type: Boolean, default: true },
  lastLogin:    { type: Date },
}, { timestamps: true });

userSchema.set('toJSON', { transform: (_d, ret) => { delete ret.__v; return ret; } });

module.exports = mongoose.model('User', userSchema);
