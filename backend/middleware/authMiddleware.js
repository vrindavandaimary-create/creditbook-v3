const jwt  = require('jsonwebtoken');
const User = require('../models/User');

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set.');

const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer '))
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    const token   = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id);
    if (!user || !user.isActive)
      return res.status(401).json({ success: false, message: 'User not found or inactive.' });
    req.user = user;
    next();
  } catch(e) {
    res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

module.exports = { protect };
