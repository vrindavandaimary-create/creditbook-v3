const r = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const c = require('../controllers/authController');

r.post('/send-otp',             c.sendOtp);
r.post('/verify-otp',           c.verifyOtp);
r.post('/send-register-otp',    c.sendRegisterOtp);
r.post('/verify-register-otp',  c.verifyRegisterOtp);
r.get('/me',                    protect, c.getMe);
r.put('/update',                protect, c.updateProfile);

module.exports = r;
