const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { optionalUserToken } = require('../middleware/auth');

// POST /api/adopt - Submit adoption application
router.post(
  '/',
  optionalUserToken,
  [
    body('cat_id').isInt().withMessage('Valid Cat ID required'),
    body('cat_name').trim().notEmpty().escape(),
    body('applicant_name').trim().notEmpty().withMessage('Your name is required').escape(),
    body('email')
      .if((value, { req }) => !req.user)
      .trim()
      .notEmpty()
      .withMessage('Valid email address required')
      .isEmail()
      .withMessage('Valid email address required')
      .normalizeEmail(),
    body('phone').trim().notEmpty().withMessage('Phone number is required').escape(),
    body('housing_type').trim().notEmpty().withMessage('Housing type required').escape(),
    body('experience').trim().notEmpty().withMessage('Pet experience required').escape(),
    body('message').optional({ checkFalsy: true }).trim().escape()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { cat_id, applicant_name, phone, housing_type, experience, message } = req.body;
    const applicantEmail = req.user?.email || req.body.email;

    if (!applicantEmail) {
      return res.status(400).json({ success: false, error: 'Email address is required' });
    }

    // Check if cat exists and is still available before accepting an application.
    db.get('SELECT * FROM cats WHERE id = ?', [cat_id], (err, cat) => {
      if (err || !cat) {
        return res.status(404).json({ success: false, error: 'Cat not found or unavailable' });
      }
      if (cat.status !== 'Available') {
        return res.status(409).json({ success: false, error: `${cat.name} is no longer available for adoption` });
      }

      const sql = `
        INSERT INTO applications (cat_id, cat_name, applicant_name, email, phone, housing_type, experience, message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.run(sql, [cat_id, cat.name, applicant_name, applicantEmail, phone, housing_type, experience, message || ''], function (err) {
        if (err) {
          console.error('Error saving adoption application:', err);
          return res.status(500).json({ success: false, error: 'Failed to record application' });
        }

        // Optionally update cat status to Pending if requested
        res.status(201).json({
          success: true,
          message: `Application submitted for ${cat.name}! Our shelter team will contact you soon.`,
          application_id: this.lastID
        });
      });
    });
  }
);

module.exports = router;
