const express  = require('express');
const mongoose = require('mongoose');
const path     = require('path');
const cors     = require('cors');
require('dotenv').config();

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth',         require('./routes/authRoutes'));
app.use('/api/categories',   require('./routes/categoryRoutes'));
app.use('/api/parties',      require('./routes/partyRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/bills',        require('./routes/billRoutes'));
app.use('/api/dashboard',    require('./routes/dashboardRoutes'));
app.use('/api/chat',         require('./routes/chatRoutes'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date() }));

app.use((req, res) => res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` }));
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || 'Server error' });
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(e => { console.error('❌ MongoDB error:', e.message); process.exit(1); });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
module.exports = app;
