const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { JWT_SECRET, verifyUserToken } = require('../middleware/auth');
const { sendEmailOtp, checkEmailOtp } = require('../services/birdVerify');

const BCRYPT_ROUNDS = 12;
const PENDING_TTL_MS = 15 * 60 * 1000;

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function validationFailed(res, errors) {
  return res.status(400).json({ success: false, errors: errors.array() });
}

function signUserToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, type: 'user' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function setUserSessionCookie(res, token) {
  res.cookie('user_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

// POST /api/auth/register/send-otp — validate email, check uniqueness, send OTP
// Password is NOT stored yet — only accepted after OTP verification
router.post(
  '/register/send-otp',
  [
    body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[a-zA-Z]/)
      .withMessage('Password must contain at least one letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number'),
    body('password_confirm')
      .trim()
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationFailed(res, errors);
    }

    const email = normalizeEmail(req.body.email);

    try {
      const existing = await db.findUserByEmail(email);
      if (existing) {
        return res.status(409).json({ success: false, error: 'An account with this email already exists' });
      }

      const expiresAt = new Date(Date.now() + PENDING_TTL_MS).toISOString();

      // Store only email + expiry — NO password data until OTP is verified
      await db.upsertPendingRegistration({ email, expires_at: expiresAt });

      await sendEmailOtp(email);

      res.json({
        success: true,
        message: 'Verification code sent to your email. It expires in 15 minutes.'
      });
    } catch (err) {
      console.error('register/send-otp:', err.message);
      res.status(502).json({ success: false, error: 'Could not send verification email. Try again later.' });
    }
  }
);

// POST /api/auth/register/verify — OTP must pass before password is hashed and stored
router.post(
  '/register/verify',
  [
    body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
    body('code')
      .trim()
      .matches(/^\d{6}$/)
      .withMessage('Verification code must be exactly 6 digits'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[a-zA-Z]/)
      .withMessage('Password must contain at least one letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationFailed(res, errors);
    }

    const email = normalizeEmail(req.body.email);
    const { code, password } = req.body;

    try {
      const pending = await db.getPendingRegistration(email);
      if (!pending) {
        return res.status(400).json({
          success: false,
          error: 'No pending registration for this email. Request a new code first.'
        });
      }

      if (new Date(pending.expires_at).getTime() < Date.now()) {
        await db.deletePendingRegistration(email);
        return res.status(400).json({
          success: false,
          error: 'Verification expired. Request a new code.'
        });
      }

      const existing = await db.findUserByEmail(email);
      if (existing) {
        await db.deletePendingRegistration(email);
        return res.status(409).json({ success: false, error: 'An account with this email already exists' });
      }

      // Step 1: Verify OTP — throws if wrong or expired
      await checkEmailOtp(email, code);

      // Step 2: OTP verified — now hash password and create user
      const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);

      const user = await db.createUser({
        email,
        password_hash: passwordHash,
        email_verified: true
      });

      await db.deletePendingRegistration(email);

      const token = signUserToken(user);
      setUserSessionCookie(res, token);

      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        user: { id: user.id, email: user.email },
        token
      });
    } catch (err) {
      if (err.status === 404 || err.status === 400 || err.status === 422) {
        return res.status(400).json({ success: false, error: 'Invalid or expired verification code' });
      }
      console.error('register/verify:', err.message);
      res.status(400).json({ success: false, error: 'Invalid or expired verification code' });
    }
  }
);

// POST /api/auth/login — only verified accounts
router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationFailed(res, errors);
    }

    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    try {
      const user = await db.findUserByEmail(email);
      if (!user || !user.email_verified) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }

      const match = bcrypt.compareSync(password, user.password_hash);
      if (!match) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }

      const token = signUserToken(user);
      setUserSessionCookie(res, token);

      res.json({
        success: true,
        message: 'Logged in successfully',
        user: { id: user.id, email: user.email },
        token
      });
    } catch (err) {
      console.error('login:', err);
      res.status(500).json({ success: false, error: 'Login failed' });
    }
  }
);

router.post('/logout', (req, res) => {
  res.clearCookie('user_token');
  res.json({ success: true, message: 'Logged out successfully' });
});

router.get('/me', verifyUserToken, (req, res) => {
  res.json({
    success: true,
    user: { id: req.user.id, email: req.user.email }
  });
});

// GET /api/auth/applications — applications belonging to the signed-in user
router.get('/applications', verifyUserToken, async (req, res) => {
  try {
    const applications = await db.findApplicationsByEmail(req.user.email);
    res.json({ success: true, data: applications });
  } catch (err) {
    console.error('auth/applications:', err.message);
    res.status(500).json({ success: false, error: 'Could not load your adoption applications' });
  }
});

module.exports = router;
