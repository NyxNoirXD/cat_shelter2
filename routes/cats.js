const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { verifyAdminToken } = require('../middleware/auth');


const isVercel = !!process.env.VERCEL_ENV;

// Configure Multer for cat image uploads
let upload;
if (isVercel) {
  // On Vercel, accept file uploads into memory (no local disk writes)
  // The file will be uploaded to Vercel Blob if configured, or fall back to URL input
  upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|webp|gif/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      if (extname && mimetype) {
        cb(null, true);
      } else {
        cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed!'));
      }
    }
  });
} else {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, '../public/uploads'));
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname).toLowerCase() || '.png';
      cb(null, 'cat-' + uniqueSuffix + ext);
    }
  });

  upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|webp|gif/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      if (extname && mimetype) {
        cb(null, true);
      } else {
        cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed!'));
      }
    }
  });
}

async function resolveImageUrl(req) {
  const { image_url_input } = req.body;
  // If a file was uploaded on Vercel, try to upload to Vercel Blob
  if (req.file && isVercel) {
    try {
      const blobClient = require('@vercel/blob');
      const blob = await blobClient.put(
        `uploads/cat-${Date.now()}-${req.file.originalname}`,
        req.file.buffer,
        { access: 'public' }
      );
      return blob.url;
    } catch {
      // Blob not configured or failed — fall back to URL or default
      if (image_url_input && image_url_input.trim() !== '') {
        return image_url_input.trim();
      }
      return '/uploads/luna.png';
    }
  }
  // Local file upload
  if (req.file) {
    return `/uploads/${req.file.filename}`;
  }
  // URL input fallback
  if (image_url_input && image_url_input.trim() !== '') {
    return image_url_input.trim();
  }
  return '/uploads/luna.png';
}

// GET /api/cats - Fetch all cats with filtering & search support
router.get('/', (req, res) => {
  const { breed, age_group, gender, status, search } = req.query;
  let sql = 'SELECT * FROM cats WHERE 1=1';
  const params = [];

  if (breed) {
    sql += ' AND breed = ?';
    params.push(breed);
  }

  if (age_group) {
    sql += ' AND age_group = ?';
    params.push(age_group);
  }

  if (gender) {
    sql += ' AND gender = ?';
    params.push(gender);
  }

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  if (search) {
    sql += ' AND (name LIKE ? OR breed LIKE ? OR temperament LIKE ?)';
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam);
  }

  sql += ' ORDER BY id DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Database error fetching cats' });
    }
    res.json({ success: true, data: rows });
  });
});

// GET /api/cats/:id - Fetch single cat
router.get('/:id', (req, res) => {
  db.get('SELECT * FROM cats WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ success: false, error: 'Database error' });
    if (!row) return res.status(404).json({ success: false, error: 'Cat not found' });
    res.json({ success: true, data: row });
  });
});

// POST /api/cats - Add new cat (Admin required)
router.post(
  '/',
  verifyAdminToken,
  upload.single('image_file'),
  [
    body('name').trim().notEmpty().withMessage('Name is required').escape(),
    body('breed').trim().notEmpty().withMessage('Breed is required').escape(),
    body('age').isInt({ min: 0, max: 30 }).withMessage('Age must be a valid number'),
    body('age_group').isIn(['Kitten', 'Young', 'Adult', 'Senior']).withMessage('Invalid age group'),
    body('gender').isIn(['Male', 'Female']).withMessage('Invalid gender'),
    body('bio').trim().notEmpty().withMessage('Bio is required').escape(),
    body('temperament').trim().notEmpty().withMessage('Temperament tags required').escape()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, breed, age, age_group, gender, status, bio, temperament, spayed_neutered, vaccinated, intake_date, weight_kg, microchip } = req.body;

    let image_url = await resolveImageUrl(req);

    const sql = `
      INSERT INTO cats (name, breed, age, age_group, gender, status, image_url, bio, temperament, spayed_neutered, vaccinated, intake_date, weight_kg, microchip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const catStatus = status || 'Available';
    const isSpayed = spayed_neutered === 'on' || spayed_neutered === '1' || spayed_neutered === 1 ? 1 : 0;
    const isVaccinated = vaccinated === 'on' || vaccinated === '1' || vaccinated === 1 ? 1 : 0;

    db.run(sql, [name, breed, age, age_group, gender, catStatus, image_url, bio, temperament, isSpayed, isVaccinated, intake_date || null, weight_kg || null, microchip || null], function (err) {
      if (err) {
        console.error('Error inserting cat:', err);
        return res.status(500).json({ success: false, error: 'Failed to save cat profile' });
      }
      db.logActivity('cat.created', `Created cat "${name}" (${breed})`, req.admin?.username);
      res.status(201).json({
        success: true,
        message: 'Cat profile created successfully!',
        data: { id: this.lastID, name, breed, image_url }
      });
    });
  }
);

// PUT /api/cats/:id - Update existing cat (Admin required)
router.put(
  '/:id',
  verifyAdminToken,
  upload.single('image_file'),
  [
    body('name').trim().notEmpty().escape(),
    body('breed').trim().notEmpty().escape(),
    body('age').isInt({ min: 0, max: 30 }),
    body('age_group').isIn(['Kitten', 'Young', 'Adult', 'Senior']),
    body('gender').isIn(['Male', 'Female']),
    body('status').isIn(['Available', 'Pending', 'Adopted']),
    body('bio').trim().notEmpty().escape(),
    body('temperament').trim().notEmpty().escape()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const catId = req.params.id;
    const { name, breed, age, age_group, gender, status, bio, temperament, spayed_neutered, vaccinated, intake_date, weight_kg, microchip } = req.body;

    db.get('SELECT name, image_url FROM cats WHERE id = ?', [catId], async (err, cat) => {
      if (err || !cat) {
        return res.status(404).json({ success: false, error: 'Cat not found' });
      }

      let image_url = cat.image_url;
      if (req.file || req.body.image_url_input) {
        image_url = await resolveImageUrl(req);
      }

      const isSpayed = spayed_neutered === 'on' || spayed_neutered === '1' || spayed_neutered === 1 ? 1 : 0;
      const isVaccinated = vaccinated === 'on' || vaccinated === '1' || vaccinated === 1 ? 1 : 0;

      const sql = `
        UPDATE cats
        SET name = ?, breed = ?, age = ?, age_group = ?, gender = ?, status = ?, image_url = ?, bio = ?, temperament = ?, spayed_neutered = ?, vaccinated = ?, intake_date = ?, weight_kg = ?, microchip = ?
        WHERE id = ?
      `;

      db.run(sql, [name, breed, age, age_group, gender, status, image_url, bio, temperament, isSpayed, isVaccinated, intake_date || null, weight_kg || null, microchip || null, catId], (err) => {
        if (err) {
          return res.status(500).json({ success: false, error: 'Failed to update cat details' });
        }
        db.logActivity('cat.updated', `Updated cat "${name}" (ID: ${catId})`, req.admin?.username);
        res.json({ success: true, message: 'Cat updated successfully!' });
      });
    });
  }
);

// DELETE /api/cats/:id - Delete cat (Admin required)
router.delete('/:id', verifyAdminToken, (req, res) => {
  const catId = req.params.id;
  const catName = (db.getState().cats || []).find(c => c.id === parseInt(catId))?.name || catId;
  db.run('DELETE FROM cats WHERE id = ?', [catId], function (err) {
    if (err) {
      return res.status(500).json({ success: false, error: 'Failed to delete cat' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ success: false, error: 'Cat not found' });
    }
    db.logActivity('cat.deleted', `Deleted cat "${catName}" (ID: ${catId})`, req.admin?.username);
    res.json({ success: true, message: 'Cat profile removed successfully.' });
  });
});

// PATCH /api/cats/:id/status - Update cat status only (Admin required)
router.patch('/:id/status', verifyAdminToken, (req, res) => {
  const catId = parseInt(req.params.id);
  const { status } = req.body;

  if (!['Available', 'Pending', 'Adopted'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid status. Must be Available, Pending, or Adopted.' });
  }

  const catName = (db.getState().cats || []).find(c => c.id === catId)?.name || catId;
  const updated = db.updateCatStatus(catId, status);
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Cat not found' });
  }
  db.logActivity('cat.status_changed', `Changed "${catName}" status to ${status}`, req.admin?.username);
  res.json({ success: true, message: `Status updated to ${status}`, data: { id: catId, status } });
});

module.exports = router;
