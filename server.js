const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config({ quiet: true });
const db = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: false // Disabled CSP for inline assets and Google Fonts compatibility
}));
app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiters for Security
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: { success: false, error: 'Too many login attempts. Please try again in 15 minutes.' }
});

const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many verification requests. Please try again later.' }
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many verification attempts. Please try again later.' }
});

const adoptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many application submissions. Please wait before submitting again.' }
});

// Import API routes
const catsRouter = require('./routes/cats');
const applicationsRouter = require('./routes/applications');
const adminRouter = require('./routes/admin');
const authRouter = require('./routes/auth');

// Apply rate limiting to specific routes
app.use('/api/admin/login', loginLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register/send-otp', otpSendLimiter);
app.use('/api/auth/register/verify', otpVerifyLimiter);
app.use('/api/adopt', adoptLimiter);

// Mount API routes
app.use('/api/cats', catsRouter);
app.use('/api/adopt', applicationsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/auth', authRouter);

// POST /api/contact - Store contact inquiries
app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ success: false, error: 'Name, email, and message are required.' });
  }
  db.addContactInquiry({ name, email, subject: subject || 'General Inquiry', message });
  res.json({ success: true, message: 'Message received. Our team will get back to you soon.' });
});

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Admin interface route redirect
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all route for SPA-style paths (Express 5 wildcard)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ success: false, error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  Whiskers & Haven Pet Adoption Center Server Running`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`  Admin Dashboard: http://localhost:${PORT}/admin`);
  console.log(`  Account Login: http://localhost:${PORT}/login`);
  console.log(`====================================================`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or run: PORT=3001 npm start`);
  } else {
    console.error('Failed to start server:', err.message);
  }
  process.exit(1);
});
