const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbFilePath = path.join(__dirname, 'whiskers_db.json');

let blobClient = null;
try {
  blobClient = require('@vercel/blob');
} catch {
  // @vercel/blob not installed — use file-based storage
}

const USE_BLOB = !!blobClient && !!process.env.BLOB_READ_WRITE_TOKEN;
const BLOB_KEY = 'whiskers_db_state.json';
let _blobUrl = null;

// In-Memory state backed by JSON file or Blob persistence
let state = {
  cats: [],
  applications: [],
  admins: [],
  users: [],
  pending_registrations: [],
  contact_inquiries: []
};

let _ready = null;

function ready() {
  if (!_ready) {
    _ready = init();
  }
  return _ready;
}

async function init() {
  if (USE_BLOB) {
    try {
      const { list } = blobClient;
      const { blobs } = await list({ prefix: BLOB_KEY, limit: 1 });
      if (blobs.length > 0) {
        _blobUrl = blobs[0].url;
        const res = await fetch(_blobUrl);
        if (res.ok) {
          const raw = await res.text();
          state = JSON.parse(raw);
        }
      }
      if (!state.admins) state.admins = [];
      if (!state.users) state.users = [];
      if (!state.pending_registrations) state.pending_registrations = [];
      if (!state.contact_inquiries) state.contact_inquiries = [];
      if (!state.cats || state.cats.length === 0) {
        seedAdmin();
        seedCats();
        await persistToBlob();
      } else if (!state.admins || state.admins.length === 0) {
        seedAdmin();
        await persistToBlob();
      }
    } catch (err) {
      console.error('Blob init error, falling back to empty state:', err.message);
    }
  } else {
    loadStateSync();
  }
}

async function persistToBlob() {
  if (!USE_BLOB) return;
  try {
    const { put } = blobClient;
    const blob = await put(BLOB_KEY, JSON.stringify(state), {
      access: 'public',
      addRandomSuffix: false,
    });
    _blobUrl = blob.url;
  } catch (err) {
    console.error('Blob persist error:', err.message);
  }
}

function persistToBlobFireAndForget() {
  if (!USE_BLOB) return;
  persistToBlob().catch(err => console.error('Blob persist error:', err.message));
}

// Save state to disk atomically (file-based only)
function saveStateSync() {
  if (USE_BLOB) return;
  try {
    const tempPath = dbFilePath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tempPath, dbFilePath);
  } catch (err) {
    console.error('Error persisting database state to disk:', err);
  }
}

// Load state from disk (file-based only)
function loadStateSync() {
  try {
    if (fs.existsSync(dbFilePath)) {
      const data = fs.readFileSync(dbFilePath, 'utf8');
      state = JSON.parse(data);
      if (!state.users) state.users = [];
      if (!state.pending_registrations) state.pending_registrations = [];
      if (!state.contact_inquiries) state.contact_inquiries = [];
    }
  } catch (err) {
    console.error('Error reading database file, starting clean:', err);
  }

  if (!state.admins || state.admins.length === 0) {
    seedAdmin();
  }

  if (!state.cats || state.cats.length === 0) {
    seedCats();
  }
}

function seedAdmin() {
  const defaultUser = process.env.ADMIN_USERNAME;
  const defaultPass = process.env.ADMIN_PASSWORD;
  if (!defaultUser || !defaultPass) {
    if (!USE_BLOB) {
      console.error('FATAL: ADMIN_USERNAME and ADMIN_PASSWORD environment variables must be set for first run.');
      console.error('Add them to your .env file, then delete db/whiskers_db.json and restart.');
      process.exit(1);
    }
    return;
  }
  const hash = bcrypt.hashSync(defaultPass, 12);
  state.admins = [{ id: 1, username: defaultUser, password_hash: hash, created_at: new Date().toISOString() }];
  if (!USE_BLOB) saveStateSync();
  console.log(`Admin account created for: ${defaultUser}`);
}

function seedCats() {
  state.cats = [
    {
      id: 1,
      name: 'Oliver',
      breed: 'Orange Tabby',
      age: 2,
      age_group: 'Young',
      gender: 'Male',
      status: 'Available',
      image_url: '/uploads/luna.png',
      bio: 'Oliver is a sweet, affectionate orange tabby who loves lounging on warm cushions and chasing laser pointers. He gets along wonderfully with people and loves chin scratches.',
      temperament: 'Playful, Affectionate, Gentle',
      spayed_neutered: 1,
      vaccinated: 1,
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      name: 'Snowball',
      breed: 'Persian',
      age: 3,
      age_group: 'Adult',
      gender: 'Female',
      status: 'Available',
      image_url: '/uploads/milo.png',
      bio: 'Snowball is a fluffy, regal Persian beauty with ocean-blue eyes. She thrives in calm environments, enjoys soft grooming sessions, and loves being pampered.',
      temperament: 'Calm, Quiet, Regal',
      spayed_neutered: 1,
      vaccinated: 1,
      created_at: new Date().toISOString()
    },
    {
      id: 3,
      name: 'Cleo',
      breed: 'Calico',
      age: 1,
      age_group: 'Young',
      gender: 'Female',
      status: 'Available',
      image_url: '/uploads/cleo.png',
      bio: 'Cleo is a curious and energetic Calico explorer. She loves windowsill bird-watching, climbing cat trees, and making cute chirping sounds when excited.',
      temperament: 'Curious, Energetic, Friendly',
      spayed_neutered: 1,
      vaccinated: 1,
      created_at: new Date().toISOString()
    },
    {
      id: 4,
      name: 'Shadow',
      breed: 'Domestic Shorthair',
      age: 4,
      age_group: 'Adult',
      gender: 'Male',
      status: 'Available',
      image_url: '/uploads/shadow.png',
      bio: 'Shadow is a sleek black panther cat with glowing amber eyes. He is extremely loyal, loves lap cuddles during movie nights, and gets along great with other pets.',
      temperament: 'Loyal, Cuddly, Smart',
      spayed_neutered: 1,
      vaccinated: 1,
      created_at: new Date().toISOString()
    }
  ];
  if (!USE_BLOB) saveStateSync();
  console.log('Default feline profiles seeded.');
}

function persist() {
  if (USE_BLOB) {
    persistToBlobFireAndForget();
  } else {
    saveStateSync();
  }
}

// Database compatibility API layer
const db = {
  all: (sql, params, callback) => {
    try {
      let result = [...state.cats];

      // Handle filtered query from /api/cats
      if (sql.includes('FROM cats')) {
        let breed, age_group, gender, status, search;
        let paramIdx = 0;

        if (sql.includes('breed = ?')) breed = params[paramIdx++];
        if (sql.includes('age_group = ?')) age_group = params[paramIdx++];
        if (sql.includes('gender = ?')) gender = params[paramIdx++];
        if (sql.includes('status = ?')) status = params[paramIdx++];
        if (sql.includes('LIKE ?')) search = params[paramIdx]?.replace(/%/g, '');

        if (breed) result = result.filter(c => c.breed.toLowerCase() === breed.toLowerCase());
        if (age_group) result = result.filter(c => c.age_group === age_group);
        if (gender) result = result.filter(c => c.gender === gender);
        if (status) result = result.filter(c => c.status === status);
        if (search) {
          const s = search.toLowerCase();
          result = result.filter(c => 
            c.name.toLowerCase().includes(s) || 
            c.breed.toLowerCase().includes(s) || 
            c.temperament.toLowerCase().includes(s)
          );
        }
        result.sort((a, b) => b.id - a.id);
        return callback(null, result);
      }

      if (sql.includes('FROM applications')) {
        let apps = [...state.applications].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
        return callback(null, apps);
      }

      callback(null, []);
    } catch (err) {
      callback(err, null);
    }
  },

  get: (sql, params, callback) => {
    try {
      if (sql.includes('COUNT(*) as count FROM admins')) {
        return callback(null, { count: state.admins.length });
      }
      if (sql.includes('COUNT(*) as count FROM cats')) {
        return callback(null, { count: state.cats.length });
      }
      if (sql.includes('COUNT(*) as total FROM cats')) {
        return callback(null, { total: state.cats.length });
      }
      if (sql.includes('status = \'Available\'')) {
        const count = state.cats.filter(c => c.status === 'Available').length;
        return callback(null, { available: count });
      }
      if (sql.includes('status = \'Pending\'')) {
        const count = state.cats.filter(c => c.status === 'Pending').length;
        return callback(null, { pending: count });
      }
      if (sql.includes('status = \'Adopted\'')) {
        const count = state.cats.filter(c => c.status === 'Adopted').length;
        return callback(null, { adopted: count });
      }
      if (sql.includes('COUNT(*) as totalApps FROM applications')) {
        return callback(null, { totalApps: state.applications.length });
      }

      if (sql.includes('FROM admins WHERE username = ?')) {
        const admin = state.admins.find(a => a.username === params[0]);
        return callback(null, admin || null);
      }

      if (sql.includes('FROM cats WHERE id = ?')) {
        const cat = state.cats.find(c => c.id === parseInt(params[0]));
        return callback(null, cat || null);
      }

      callback(null, null);
    } catch (err) {
      callback(err, null);
    }
  },

  run: function (sql, params, callback) {
    try {
      // Insert Cat
      if (sql.includes('INSERT INTO cats')) {
        const newId = state.cats.length > 0 ? Math.max(...state.cats.map(c => c.id)) + 1 : 1;
        const newCat = {
          id: newId,
          name: params[0],
          breed: params[1],
          age: parseInt(params[2]),
          age_group: params[3],
          gender: params[4],
          status: params[5],
          image_url: params[6],
          bio: params[7],
          temperament: params[8],
          spayed_neutered: parseInt(params[9]),
          vaccinated: parseInt(params[10]),
          created_at: new Date().toISOString()
        };
        state.cats.push(newCat);
        persist();
        if (callback) callback.call({ lastID: newId }, null);
        return;
      }

      // Update Cat
      if (sql.includes('UPDATE cats')) {
        const catId = parseInt(params[11]);
        const idx = state.cats.findIndex(c => c.id === catId);
        if (idx !== -1) {
          state.cats[idx] = {
            ...state.cats[idx],
            name: params[0],
            breed: params[1],
            age: parseInt(params[2]),
            age_group: params[3],
            gender: params[4],
            status: params[5],
            image_url: params[6],
            bio: params[7],
            temperament: params[8],
            spayed_neutered: parseInt(params[9]),
            vaccinated: parseInt(params[10])
          };
          persist();
        }
        if (callback) callback.call({ changes: idx !== -1 ? 1 : 0 }, null);
        return;
      }

      // Delete Cat
      if (sql.includes('DELETE FROM cats WHERE id = ?')) {
        const catId = parseInt(params[0]);
        const initialLen = state.cats.length;
        state.cats = state.cats.filter(c => c.id !== catId);
        persist();
        const changes = initialLen - state.cats.length;
        if (callback) callback.call({ changes }, null);
        return;
      }

      // Insert Application
      if (sql.includes('INSERT INTO applications')) {
        const newId = state.applications.length > 0 ? Math.max(...state.applications.map(a => a.id)) + 1 : 1;
        const newApp = {
          id: newId,
          cat_id: parseInt(params[0]),
          cat_name: params[1],
          applicant_name: params[2],
          email: params[3],
          phone: params[4],
          housing_type: params[5],
          experience: params[6],
          message: params[7],
          status: 'Pending',
          submitted_at: new Date().toISOString()
        };
        state.applications.push(newApp);
        persist();
        if (callback) callback.call({ lastID: newId }, null);
        return;
      }

      // Update Application Status
      if (sql.includes('UPDATE applications SET status = ? WHERE id = ?')) {
        const appId = parseInt(params[1]);
        const app = state.applications.find(a => a.id === appId);
        if (app) {
          app.status = params[0];
          persist();
        }
        if (callback) callback.call({ changes: app ? 1 : 0 }, null);
        return;
      }

      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }
};

function findUserByEmail(email) {
  const normalized = String(email).trim().toLowerCase();
  const user = state.users.find(u => u.email === normalized);
  return Promise.resolve(user || null);
}

function findApplicationsByEmail(email) {
  const normalized = String(email).trim().toLowerCase();
  const applications = state.applications
    .filter(application => String(application.email).trim().toLowerCase() === normalized)
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  return Promise.resolve(applications.map(application => ({ ...application })));
}

function getPendingRegistration(email) {
  const normalized = String(email).trim().toLowerCase();
  const pending = state.pending_registrations.find(p => p.email === normalized);
  return Promise.resolve(pending || null);
}

function upsertPendingRegistration(record) {
  const normalized = String(record.email).trim().toLowerCase();
  state.pending_registrations = state.pending_registrations.filter(p => p.email !== normalized);
  state.pending_registrations.push({
    email: normalized,
    expires_at: record.expires_at,
    created_at: new Date().toISOString()
  });
  persist();
  return Promise.resolve();
}

function deletePendingRegistration(email) {
  const normalized = String(email).trim().toLowerCase();
  const before = state.pending_registrations.length;
  state.pending_registrations = state.pending_registrations.filter(p => p.email !== normalized);
  if (state.pending_registrations.length !== before) {
    persist();
  }
  return Promise.resolve();
}

function createUser({ email, password_hash, email_verified }) {
  const normalized = String(email).trim().toLowerCase();
  if (state.users.some(u => u.email === normalized)) {
    return Promise.reject(new Error('User already exists'));
  }
  const newId = state.users.length > 0 ? Math.max(...state.users.map(u => u.id)) + 1 : 1;
  const user = {
    id: newId,
    email: normalized,
    password_hash,
    email_verified: !!email_verified,
    created_at: new Date().toISOString()
  };
  state.users.push(user);
  persist();
  return Promise.resolve({ ...user });
}

function updateCatStatus(catId, status) {
  const idx = state.cats.findIndex(c => c.id === catId);
  if (idx === -1) return false;
  state.cats[idx].status = status;
  persist();
  return true;
}

function addContactInquiry({ name, email, subject, message }) {
  const inquiry = {
    id: state.contact_inquiries.length + 1,
    name,
    email,
    subject,
    message,
    created_at: new Date().toISOString()
  };
  state.contact_inquiries.push(inquiry);
  persist();
}

module.exports = db;
module.exports.ready = ready;
module.exports.findUserByEmail = findUserByEmail;
module.exports.findApplicationsByEmail = findApplicationsByEmail;
module.exports.getPendingRegistration = getPendingRegistration;
module.exports.upsertPendingRegistration = upsertPendingRegistration;
module.exports.deletePendingRegistration = deletePendingRegistration;
module.exports.createUser = createUser;
module.exports.updateCatStatus = updateCatStatus;
module.exports.addContactInquiry = addContactInquiry;
