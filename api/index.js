const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config({ quiet: true });
const db = require('../db/database');

// Initialize database (sync for file, kicks off async for Vercel Blob)
db.ready().catch(err => console.error('DB init error:', err));

const app = express();

// Security Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 15,
  message: { success: false, error: 'Too many login attempts. Please try again in 15 minutes.' }
});
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5,
  message: { success: false, error: 'Too many verification requests. Please try again later.' }
});
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { success: false, error: 'Too many verification attempts. Please try again later.' }
});
const adoptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { success: false, error: 'Too many application submissions. Please wait before submitting again.' }
});

// Import routes
const catsRouter = require('../routes/cats');
const applicationsRouter = require('../routes/applications');
const adminRouter = require('../routes/admin');
const authRouter = require('../routes/auth');

// Apply rate limiting
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

// POST /api/contact
app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ success: false, error: 'Name, email, and message are required.' });
  }
  db.addContactInquiry({ name, email, subject: subject || 'General Inquiry', message });
  res.json({ success: true, message: 'Message received. Our team will get back to you soon.' });
});

// Serve static files from /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// HTML page routes
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'about.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'contact.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// Catch-all
app.get('/{*splat}', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ success: false, error: 'Internal Server Error' });
});

module.exports = app;
