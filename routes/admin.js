const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { verifyAdminToken, JWT_SECRET } = require('../middleware/auth');

// POST /api/admin/login - Authenticate admin
router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('Username required').escape(),
    body('password').trim().notEmpty().withMessage('Password required')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { username, password } = req.body;

    db.get('SELECT * FROM admins WHERE username = ?', [username], (err, admin) => {
      if (err || !admin) {
        return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
      }

      const match = bcrypt.compareSync(password, admin.password_hash);
      if (!match) {
        return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
      }

      const token = jwt.sign(
        { id: admin.id, username: admin.username },
        JWT_SECRET,
        { expiresIn: '12h' }
      );

      res.cookie('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 12 * 60 * 60 * 1000 // 12 hours
      });

      res.json({
        success: true,
        message: 'Admin authenticated successfully',
        token,
        username: admin.username
      });
    });
  }
);

// POST /api/admin/logout
router.post('/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/admin/me - Check current admin session
router.get('/me', verifyAdminToken, (req, res) => {
  res.json({ success: true, admin: req.admin });
});

// GET /api/admin/stats - Quick stats counter
router.get('/stats', verifyAdminToken, (req, res) => {
  const stats = {};
  db.get('SELECT COUNT(*) as total FROM cats', [], (err, r1) => {
    stats.totalCats = r1 ? r1.total : 0;
    db.get("SELECT COUNT(*) as available FROM cats WHERE status = 'Available'", [], (err, r2) => {
      stats.availableCats = r2 ? r2.available : 0;
      db.get("SELECT COUNT(*) as pending FROM cats WHERE status = 'Pending'", [], (err, r3) => {
        stats.pendingCats = r3 ? r3.pending : 0;
        db.get("SELECT COUNT(*) as adopted FROM cats WHERE status = 'Adopted'", [], (err, r4) => {
          stats.adoptedCats = r4 ? r4.adopted : 0;
          db.get('SELECT COUNT(*) as totalApps FROM applications', [], (err, r5) => {
            stats.totalApplications = r5 ? r5.totalApps : 0;
            res.json({ success: true, stats });
          });
        });
      });
    });
  });
});

// GET /api/admin/applications - List adoption inquiries
router.get('/applications', verifyAdminToken, (req, res) => {
  db.all('SELECT * FROM applications ORDER BY submitted_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: 'Database error' });
    res.json({ success: true, data: rows });
  });
});

// PUT /api/admin/applications/:id - Update application status (Pending/Approved/Rejected)
router.put('/applications/:id', verifyAdminToken, (req, res) => {
  const { status } = req.body;
  if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid application status' });
  }

  db.run('UPDATE applications SET status = ? WHERE id = ?', [status, req.params.id], function (err) {
    if (err) return res.status(500).json({ success: false, error: 'Failed to update application status' });
    res.json({ success: true, message: `Application status updated to ${status}` });
  });
});

// GET /api/admin/db - View raw database state
router.get('/db', verifyAdminToken, (req, res) => {
  res.json({
    success: true,
    blobUrl: db.getBlobUrl(),
    data: db.getState(),
  });
});

module.exports = router;
