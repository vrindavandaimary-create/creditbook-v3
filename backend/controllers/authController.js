const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const twilio = require('twilio');
const User   = require('../models/User');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const genToken = id =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });

/* In-memory OTP store: { phone: { otp, expiresAt, attempts } }
   For production scale, replace with Redis. Fine for single-instance Render. */
const otpStore = new Map();

const OTP_EXPIRY_MS  = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS   = 5;

/* POST /api/auth/send-otp  { phone: "+91XXXXXXXXXX" } */
const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone?.trim())
      return res.status(400).json({ success: false, message: 'Phone number required.' });

    const cleaned = phone.trim();
    if (!/^\+\d{10,15}$/.test(cleaned))
      return res.status(400).json({ success: false, message: 'Invalid phone format. Use +91XXXXXXXXXX' });

    /* Check user exists */
    const user = await User.findOne({ phone: cleaned });
    if (!user)
      return res.status(404).json({ success: false, message: 'No account found for this number. Contact admin.' });
    if (!user.isActive)
      return res.status(401).json({ success: false, message: 'Account deactivated.' });

    /* Rate limit: don't resend within 30s */
    const existing = otpStore.get(cleaned);
    if (existing && (Date.now() - (existing.expiresAt - OTP_EXPIRY_MS)) < 30000)
      return res.status(429).json({ success: false, message: 'Please wait 30 seconds before requesting a new OTP.' });

    /* Generate 6-digit OTP */
    const otp = crypto.randomInt(100000, 999999).toString();
    otpStore.set(cleaned, { otp, expiresAt: Date.now() + OTP_EXPIRY_MS, attempts: 0 });

    /* Send via Twilio */
    await client.messages.create({
      body: `Your CreditBook OTP is: ${otp}. Valid for 5 minutes. Do not share.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to:   cleaned,
    });

    console.log(`OTP sent to ${cleaned}`);
    res.json({ success: true, message: 'OTP sent successfully.' });
  } catch (e) {
    console.error('sendOtp error:', e.message);
    if (e.code === 21608)
      return res.status(400).json({ success: false, message: 'This number is not verified in Twilio trial. Please verify it first at twilio.com/console.' });
    if (e.code === 21211)
      return res.status(400).json({ success: false, message: 'Invalid phone number format.' });
    res.status(500).json({ success: false, message: 'Failed to send OTP. Try again.' });
  }
};

/* POST /api/auth/verify-otp  { phone, otp } */
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
      return res.status(400).json({ success: false, message: `Wrong OTP. ${MAX_ATTEMPTS - record.attempts} attempts remaining.` });

    /* OTP correct — clean up */
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

module.exports = { sendOtp, verifyOtp, getMe, updateProfile };
