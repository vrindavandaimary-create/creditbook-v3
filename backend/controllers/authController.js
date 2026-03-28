const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const twilio = require('twilio');
const User   = require('../models/User');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const genToken = id =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });

/* In-memory OTP store: phone -> { otp, expiresAt, attempts, pendingUser? } */
const otpStore = new Map();
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 min
const MAX_ATTEMPTS  = 5;

/* ── shared OTP sender ── */
const sendTwilioOtp = async (phone, otp) => {
  await client.messages.create({
    body: `Your CreditBook OTP is: ${otp}. Valid for 5 minutes. Do not share.`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to:   phone,
  });
};

/* ── POST /api/auth/send-otp  { phone }  — LOGIN flow ── */
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

    const existing = otpStore.get(cleaned);
    if (existing && (Date.now() - (existing.expiresAt - OTP_EXPIRY_MS)) < 30000)
      return res.status(429).json({ success: false, message: 'Please wait 30 seconds before requesting a new OTP.' });

    const otp = crypto.randomInt(100000, 999999).toString();
    otpStore.set(cleaned, { otp, expiresAt: Date.now() + OTP_EXPIRY_MS, attempts: 0 });

    await sendTwilioOtp(cleaned, otp);
    res.json({ success: true, message: 'OTP sent successfully.' });
  } catch (e) {
    console.error('sendOtp error:', e.message);
    if (e.code === 21608)
      return res.status(400).json({ success: false, message: 'This number is not verified in Twilio trial. Verify it at twilio.com/console.' });
    res.status(500).json({ success: false, message: 'Failed to send OTP. Try again.' });
  }
};

/* ── POST /api/auth/send-register-otp  { phone, name, businessName } — REGISTER flow ── */
const sendRegisterOtp = async (req, res) => {
  try {
    const { phone, name, businessName } = req.body;
    if (!phone?.trim())  return res.status(400).json({ success: false, message: 'Phone required.' });
    if (!name?.trim())   return res.status(400).json({ success: false, message: 'Name required.' });

    const cleaned = phone.trim();
    if (!/^\+\d{10,15}$/.test(cleaned))
      return res.status(400).json({ success: false, message: 'Invalid phone. Use +91XXXXXXXXXX' });

    const existing = await User.findOne({ phone: cleaned });
    if (existing)
      return res.status(400).json({ success: false, message: 'Phone already registered. Please login instead.' });

    const prev = otpStore.get(cleaned);
    if (prev && (Date.now() - (prev.expiresAt - OTP_EXPIRY_MS)) < 30000)
      return res.status(429).json({ success: false, message: 'Please wait 30 seconds before requesting a new OTP.' });

    const otp = crypto.randomInt(100000, 999999).toString();
    otpStore.set(cleaned, {
      otp,
      expiresAt: Date.now() + OTP_EXPIRY_MS,
      attempts: 0,
      pendingUser: {
        name: name.trim(),
        businessName: businessName?.trim() || 'My Business',
      },
    });

    await sendTwilioOtp(cleaned, otp);
    res.json({ success: true, message: 'OTP sent. Please verify to complete registration.' });
  } catch (e) {
    console.error('sendRegisterOtp error:', e.message);
    if (e.code === 21608)
      return res.status(400).json({ success: false, message: 'This number is not verified in Twilio trial. Verify it at twilio.com/console.' });
    res.status(500).json({ success: false, message: 'Failed to send OTP. Try again.' });
  }
};

/* ── POST /api/auth/verify-otp  { phone, otp } — LOGIN verify ── */
const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone?.trim() || !otp?.trim())
      return res.status(400).json({ success: false, message: 'Phone and OTP required.' });

    const cleaned = phone.trim();
    const record  = otpStore.get(cleaned);

    if (!record)
      return res.status(400).json({ success: false, message: 'No OTP found. Please request a new one.' });
    if (Date.now() > record.expiresAt) {
      otpStore.delete(cleaned);
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
    }

    record.attempts += 1;
    if (record.attempts > MAX_ATTEMPTS) {
      otpStore.delete(cleaned);
      return res.status(429).json({ success: false, message: 'Too many attempts. Request a new OTP.' });
    }

    if (record.otp !== otp.trim())
      return res.status(400).json({ success: false, message: `Wrong OTP. ${MAX_ATTEMPTS - record.attempts} attempts left.` });

    otpStore.delete(cleaned);

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

/* ── POST /api/auth/verify-register-otp  { phone, otp } — REGISTER verify + create user ── */
const verifyRegisterOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone?.trim() || !otp?.trim())
      return res.status(400).json({ success: false, message: 'Phone and OTP required.' });

    const cleaned = phone.trim();
    const record  = otpStore.get(cleaned);

    if (!record || !record.pendingUser)
      return res.status(400).json({ success: false, message: 'No registration OTP found. Please start again.' });
    if (Date.now() > record.expiresAt) {
      otpStore.delete(cleaned);
      return res.status(400).json({ success: false, message: 'OTP expired. Please start again.' });
    }

    record.attempts += 1;
    if (record.attempts > MAX_ATTEMPTS) {
      otpStore.delete(cleaned);
      return res.status(429).json({ success: false, message: 'Too many attempts. Please start again.' });
    }

    if (record.otp !== otp.trim())
      return res.status(400).json({ success: false, message: `Wrong OTP. ${MAX_ATTEMPTS - record.attempts} attempts left.` });

    otpStore.delete(cleaned);

    /* Double-check phone not taken (race condition) */
    const existing = await User.findOne({ phone: cleaned });
    if (existing)
      return res.status(400).json({ success: false, message: 'Phone already registered. Please login.' });

    /* Create user */
    const user = await User.create({
      phone:        cleaned,
      name:         record.pendingUser.name,
      businessName: record.pendingUser.businessName,
      isActive:     true,
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
