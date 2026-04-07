const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const User   = require('../models/User');

/* ── Startup guards ── */
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set.');

/* ── Lazy Twilio client ── */
let _twilioClient = null;
const getTwilioClient = () => {
  if (_twilioClient) return _twilioClient;
  if (!process.env.TWILIO_ACCOUNT_SID) throw new Error('TWILIO_ACCOUNT_SID not set.');
  if (!process.env.TWILIO_AUTH_TOKEN)  throw new Error('TWILIO_AUTH_TOKEN not set.');
  _twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return _twilioClient;
};

const genToken = id =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });

/* ── OTP store in MongoDB (TTL-based, survives restarts) ── */
const mongoose = require('mongoose');
const otpSchema = new mongoose.Schema({
  phone:       { type: String, required: true, unique: true },
  otp:         { type: String, required: true },
  attempts:    { type: Number, default: 0 },
  pendingUser: { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt:   { type: Date, default: Date.now, expires: 300 }, // auto-delete after 5 min
});
const OtpRecord = mongoose.models.OtpRecord || mongoose.model('OtpRecord', otpSchema);

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS  = 5;

const sendTwilioOtp = async (phone, otp) => {
  await getTwilioClient().messages.create({
    body: `Your CreditBook OTP is: ${otp}. Valid for 5 minutes. Do not share.`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to:   phone,
  });
};

/* ── POST /api/auth/send-otp — LOGIN ── */
const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone?.trim())
      return res.status(400).json({ success: false, message: 'Phone number required.' });
    const cleaned = phone.trim();
    if (!/^\+\d{10,15}$/.test(cleaned))
      return res.status(400).json({ success: false, message: 'Invalid phone. Use +91XXXXXXXXXX' });

    const user = await User.findOne({ phone: cleaned });
    if (!user)
      return res.status(404).json({ success: false, message: 'No account found. Please register first.' });
    if (!user.isActive)
      return res.status(401).json({ success: false, message: 'Account deactivated.' });

    const existing = await OtpRecord.findOne({ phone: cleaned });
    if (existing && (Date.now() - existing.createdAt.getTime()) < 30000)
      return res.status(429).json({ success: false, message: 'Please wait 30 seconds before requesting a new OTP.' });

    const otp = crypto.randomInt(100000, 999999).toString();
    await OtpRecord.findOneAndUpdate(
      { phone: cleaned },
      { otp, attempts: 0, pendingUser: null, createdAt: new Date() },
      { upsert: true, new: true }
    );
    await sendTwilioOtp(cleaned, otp);
    res.json({ success: true, message: 'OTP sent successfully.' });
  } catch (e) {
    console.error('sendOtp error:', e.message);
    if (e.code === 21608)
      return res.status(400).json({ success: false, message: 'This number is not verified in Twilio trial. Verify at twilio.com/console.' });
    res.status(500).json({ success: false, message: 'Failed to send OTP. Try again.' });
  }
};

/* ── POST /api/auth/send-register-otp — REGISTER ── */
const sendRegisterOtp = async (req, res) => {
  try {
    const { phone, name, businessName } = req.body;
    if (!phone?.trim()) return res.status(400).json({ success: false, message: 'Phone required.' });
    if (!name?.trim())  return res.status(400).json({ success: false, message: 'Name required.' });
    const cleaned = phone.trim();
    if (!/^\+\d{10,15}$/.test(cleaned))
      return res.status(400).json({ success: false, message: 'Invalid phone. Use +91XXXXXXXXXX' });

    const existing = await User.findOne({ phone: cleaned });
    if (existing)
      return res.status(400).json({ success: false, message: 'Phone already registered. Please login instead.' });

    const prev = await OtpRecord.findOne({ phone: cleaned });
    if (prev && (Date.now() - prev.createdAt.getTime()) < 30000)
      return res.status(429).json({ success: false, message: 'Please wait 30 seconds before requesting a new OTP.' });

    const otp = crypto.randomInt(100000, 999999).toString();
    await OtpRecord.findOneAndUpdate(
      { phone: cleaned },
      { otp, attempts: 0, pendingUser: { name: name.trim(), businessName: businessName?.trim() || 'My Business' }, createdAt: new Date() },
      { upsert: true, new: true }
    );
    await sendTwilioOtp(cleaned, otp);
    res.json({ success: true, message: 'OTP sent. Please verify to complete registration.' });
  } catch (e) {
    console.error('sendRegisterOtp error:', e.message);
    if (e.code === 21608)
      return res.status(400).json({ success: false, message: 'This number is not verified in Twilio trial.' });
    res.status(500).json({ success: false, message: 'Failed to send OTP. Try again.' });
  }
};

/* ── POST /api/auth/verify-otp — LOGIN verify ── */
const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone?.trim() || !otp?.trim())
      return res.status(400).json({ success: false, message: 'Phone and OTP required.' });
    const cleaned = phone.trim();
    const record  = await OtpRecord.findOne({ phone: cleaned });

    if (!record)
      return res.status(400).json({ success: false, message: 'No OTP found. Please request a new one.' });

    record.attempts += 1;
    if (record.attempts > MAX_ATTEMPTS) {
      await OtpRecord.deleteOne({ phone: cleaned });
      return res.status(429).json({ success: false, message: 'Too many attempts. Request a new OTP.' });
    }
    await record.save();

    if (record.otp !== otp.trim())
      return res.status(400).json({ success: false, message: `Wrong OTP. ${MAX_ATTEMPTS - record.attempts} attempts left.` });

    await OtpRecord.deleteOne({ phone: cleaned });

    const user = await User.findOne({ phone: cleaned });
    if (!user || !user.isActive)
      return res.status(401).json({ success: false, message: 'Account not found or deactivated.' });

    await User.findByIdAndUpdate(user._id, { lastLogin: Date.now() });
    res.json({ success: true, message: 'Login successful!', token: genToken(user._id), user });
  } catch (e) {
    console.error('verifyOtp error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ── POST /api/auth/verify-register-otp — REGISTER verify ── */
const verifyRegisterOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone?.trim() || !otp?.trim())
      return res.status(400).json({ success: false, message: 'Phone and OTP required.' });
    const cleaned = phone.trim();
    const record  = await OtpRecord.findOne({ phone: cleaned });

    if (!record || !record.pendingUser)
      return res.status(400).json({ success: false, message: 'No registration OTP found. Please start again.' });

    record.attempts += 1;
    if (record.attempts > MAX_ATTEMPTS) {
      await OtpRecord.deleteOne({ phone: cleaned });
      return res.status(429).json({ success: false, message: 'Too many attempts. Please start again.' });
    }
    await record.save();

    if (record.otp !== otp.trim())
      return res.status(400).json({ success: false, message: `Wrong OTP. ${MAX_ATTEMPTS - record.attempts} attempts left.` });

    await OtpRecord.deleteOne({ phone: cleaned });

    const existing = await User.findOne({ phone: cleaned });
    if (existing)
      return res.status(400).json({ success: false, message: 'Phone already registered. Please login.' });

    const user = await User.create({
      phone: cleaned,
      name:  record.pendingUser.name,
      businessName: record.pendingUser.businessName,
      isActive: true,
    });

    res.status(201).json({ success: true, message: 'Account created!', token: genToken(user._id), user });
  } catch (e) {
    console.error('verifyRegisterOtp error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

const getMe = async (req, res) => {
  try { res.json({ success: true, user: req.user }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

const updateProfile = async (req, res) => {
  try {
    const { name, businessName } = req.body;
    const updates = {};
    if (name)         updates.name         = name.trim();
    if (businessName) updates.businessName = businessName.trim();
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ success: true, user });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

module.exports = { sendOtp, sendRegisterOtp, verifyOtp, verifyRegisterOtp, getMe, updateProfile };
