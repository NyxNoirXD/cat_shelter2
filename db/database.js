const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGODB_URI;
const USE_MONGO = !!MONGO_URI;
const dbFilePath = path.join(__dirname, 'whiskers_db.json');

let _mongoClient = null;
let _mongoDb = null;

const COLLECTIONS = ['cats', 'applications', 'admins', 'users', 'pending_registrations', 'contact_inquiries'];

let state = {
  cats: [],
  applications: [],
  admins: [],
  users: [],
  pending_registrations: [],
  contact_inquiries: []
};

let _ready = null;
let _mongoQueue = Promise.resolve();

async function connectMongo() {
  if (_mongoDb) return _mongoDb;
  _mongoClient = new MongoClient(MONGO_URI);
  await _mongoClient.connect();
  _mongoDb = _mongoClient.db();
  console.log('Connected to MongoDB');
  return _mongoDb;
}

function queueMongoOp(fn) {
  _mongoQueue = _mongoQueue.then(fn).catch(err => {
    console.error('MongoDB operation failed:', err.message);
  });
}

async function flushMongoQueue() {
  await _mongoQueue;
}

function ready() {
  if (!_ready) {
    _ready = init();
  }
  return _ready;
}

async function init() {
  if (USE_MONGO) {
    const db = await connectMongo();
    for (const name of COLLECTIONS) {
      try {
        state[name] = await db.collection(name).find().toArray();
      } catch (err) {
        console.error(`Error loading ${name} from MongoDB:`, err.message);
        state[name] = [];
      }
    }
    if (!state.users) state.users = [];
    if (!state.pending_registrations) state.pending_registrations = [];
    if (!state.contact_inquiries) state.contact_inquiries = [];
    if (!state.admins || state.admins.length === 0) {
      seedAdmin();
      if (state.admins.length > 0) {
        await db.collection('admins').insertMany(state.admins);
        console.log('Admin seeded to MongoDB');
      }
    }
    if (!state.cats || state.cats.length === 0) {
      seedCats();
      await db.collection('cats').insertMany(state.cats);
      console.log('Cats seeded to MongoDB');
    }
  } else {
    loadStateFile();
  }
}

function loadStateFile() {
  try {
    if (fs.existsSync(dbFilePath)) {
      const data = fs.readFileSync(dbFilePath, 'utf8');
      state = JSON.parse(data);
      ensureArrays();
    }
  } catch (err) {
    console.error('Error reading database file, starting clean:', err);
  }
  if (!state.admins || state.admins.length === 0) {
    seedAdmin();
    saveStateFile();
  }
  if (!state.cats || state.cats.length === 0) {
    seedCats();
    saveStateFile();
  }
  console.log('Using file-based storage');
}

function saveStateFile() {
  try {
    const tempPath = dbFilePath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tempPath, dbFilePath);
  } catch (err) {
    console.error('Error saving database file:', err);
  }
}

function ensureArrays() {
  if (!state.users) state.users = [];
  if (!state.pending_registrations) state.pending_registrations = [];
  if (!state.contact_inquiries) state.contact_inquiries = [];
}

function seedAdmin() {
  const defaultUser = process.env.ADMIN_USERNAME;
  const defaultPass = process.env.ADMIN_PASSWORD;
  if (!defaultUser || !defaultPass) {
    if (USE_MONGO) {
      console.warn('ADMIN_USERNAME and ADMIN_PASSWORD not set — skipping admin seed. Set these environment variables.');
    } else {
      console.error('FATAL: ADMIN_USERNAME and ADMIN_PASSWORD environment variables must be set for first run.');
      console.error('Add them to your .env file, then delete db/whiskers_db.json and restart.');
      process.exit(1);
    }
    return;
  }
  const hash = bcrypt.hashSync(defaultPass, 12);
  state.admins = [{ id: 1, username: defaultUser, password_hash: hash, created_at: new Date().toISOString() }];
  console.log(`Admin account created for: ${defaultUser}`);
}

function seedCats() {
  state.cats = [
    {
      id: 1, name: 'Oliver', breed: 'Orange Tabby', age: 2, age_group: 'Young',
      gender: 'Male', status: 'Available', image_url: '/uploads/luna.png',
      bio: 'Oliver is a sweet, affectionate orange tabby who loves lounging on warm cushions and chasing laser pointers. He gets along wonderfully with people and loves chin scratches.',
      temperament: 'Playful, Affectionate, Gentle', spayed_neutered: 1, vaccinated: 1,
      created_at: new Date().toISOString()
    },
    {
      id: 2, name: 'Snowball', breed: 'Persian', age: 3, age_group: 'Adult',
      gender: 'Female', status: 'Available', image_url: '/uploads/milo.png',
      bio: 'Snowball is a fluffy, regal Persian beauty with ocean-blue eyes. She thrives in calm environments, enjoys soft grooming sessions, and loves being pampered.',
      temperament: 'Calm, Quiet, Regal', spayed_neutered: 1, vaccinated: 1,
      created_at: new Date().toISOString()
    },
    {
      id: 3, name: 'Cleo', breed: 'Calico', age: 1, age_group: 'Young',
      gender: 'Female', status: 'Available', image_url: '/uploads/cleo.png',
      bio: 'Cleo is a curious and energetic Calico explorer. She loves windowsill bird-watching, climbing cat trees, and making cute chirping sounds when excited.',
      temperament: 'Curious, Energetic, Friendly', spayed_neutered: 1, vaccinated: 1,
      created_at: new Date().toISOString()
    },
    {
      id: 4, name: 'Shadow', breed: 'Domestic Shorthair', age: 4, age_group: 'Adult',
      gender: 'Male', status: 'Available', image_url: '/uploads/shadow.png',
      bio: 'Shadow is a sleek black panther cat with glowing amber eyes. He is extremely loyal, loves lap cuddles during movie nights, and gets along great with other pets.',
      temperament: 'Loyal, Cuddly, Smart', spayed_neutered: 1, vaccinated: 1,
      created_at: new Date().toISOString()
    }
  ];
  console.log('Default feline profiles seeded.');
}

function persist() {
  if (USE_MONGO) {
    // Individual MongoDB operations are queued per-mutation in db.run() helpers
  } else {
    saveStateFile();
  }
}

const db = {
  all: (sql, params, callback) => {
    try {
      if (sql.includes('FROM cats')) {
        let result = [...state.cats];
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
      if (sql.includes('COUNT(*) as count FROM admins'))
        return callback(null, { count: state.admins.length });
      if (sql.includes('COUNT(*) as count FROM cats') || sql.includes('COUNT(*) as total FROM cats'))
        return callback(null, { total: state.cats.length });
      if (sql.includes("status = 'Available'"))
        return callback(null, { available: state.cats.filter(c => c.status === 'Available').length });
      if (sql.includes("status = 'Pending'"))
        return callback(null, { pending: state.cats.filter(c => c.status === 'Pending').length });
      if (sql.includes("status = 'Adopted'"))
        return callback(null, { adopted: state.cats.filter(c => c.status === 'Adopted').length });
      if (sql.includes('COUNT(*) as totalApps FROM applications'))
        return callback(null, { totalApps: state.applications.length });
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
      if (sql.includes('INSERT INTO cats')) {
        const newId = state.cats.length > 0 ? Math.max(...state.cats.map(c => c.id)) + 1 : 1;
        const newCat = {
          id: newId, name: params[0], breed: params[1], age: parseInt(params[2]),
          age_group: params[3], gender: params[4], status: params[5], image_url: params[6],
          bio: params[7], temperament: params[8], spayed_neutered: parseInt(params[9]),
          vaccinated: parseInt(params[10]), created_at: new Date().toISOString()
        };
        state.cats.push(newCat);
        if (USE_MONGO) queueMongoOp(() => _mongoDb.collection('cats').insertOne(newCat));
        if (!USE_MONGO) saveStateFile();
        if (callback) callback.call({ lastID: newId }, null);
        return;
      }

      if (sql.includes('UPDATE cats')) {
        const catId = parseInt(params[11]);
        const idx = state.cats.findIndex(c => c.id === catId);
        if (idx !== -1) {
          state.cats[idx] = {
            ...state.cats[idx],
            name: params[0], breed: params[1], age: parseInt(params[2]),
            age_group: params[3], gender: params[4], status: params[5], image_url: params[6],
            bio: params[7], temperament: params[8], spayed_neutered: parseInt(params[9]),
            vaccinated: parseInt(params[10])
          };
          if (USE_MONGO) queueMongoOp(() => _mongoDb.collection('cats').updateOne({ id: catId }, { $set: state.cats[idx] }));
          if (!USE_MONGO) saveStateFile();
        }
        if (callback) callback.call({ changes: idx !== -1 ? 1 : 0 }, null);
        return;
      }

      if (sql.includes('DELETE FROM cats WHERE id = ?')) {
        const catId = parseInt(params[0]);
        const initialLen = state.cats.length;
        state.cats = state.cats.filter(c => c.id !== catId);
        if (USE_MONGO) queueMongoOp(() => _mongoDb.collection('cats').deleteOne({ id: catId }));
        if (!USE_MONGO) saveStateFile();
        if (callback) callback.call({ changes: initialLen - state.cats.length }, null);
        return;
      }

      if (sql.includes('INSERT INTO applications')) {
        const newId = state.applications.length > 0 ? Math.max(...state.applications.map(a => a.id)) + 1 : 1;
        const newApp = {
          id: newId, cat_id: parseInt(params[0]), cat_name: params[1],
          applicant_name: params[2], email: params[3], phone: params[4],
          housing_type: params[5], experience: params[6], message: params[7],
          status: 'Pending', submitted_at: new Date().toISOString()
        };
        state.applications.push(newApp);
        if (USE_MONGO) queueMongoOp(() => _mongoDb.collection('applications').insertOne(newApp));
        if (!USE_MONGO) saveStateFile();
        if (callback) callback.call({ lastID: newId }, null);
        return;
      }

      if (sql.includes('UPDATE applications SET status = ? WHERE id = ?')) {
        const appId = parseInt(params[1]);
        const app = state.applications.find(a => a.id === appId);
        if (app) {
          app.status = params[0];
          if (USE_MONGO) queueMongoOp(() => _mongoDb.collection('applications').updateOne({ id: appId }, { $set: { status: params[0] } }));
          if (!USE_MONGO) saveStateFile();
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
  const doc = { email: normalized, expires_at: record.expires_at, created_at: new Date().toISOString() };
  state.pending_registrations.push(doc);
  if (USE_MONGO) queueMongoOp(() => _mongoDb.collection('pending_registrations').replaceOne({ email: normalized }, doc, { upsert: true }));
  if (!USE_MONGO) saveStateFile();
  return Promise.resolve();
}

function deletePendingRegistration(email) {
  const normalized = String(email).trim().toLowerCase();
  const before = state.pending_registrations.length;
  state.pending_registrations = state.pending_registrations.filter(p => p.email !== normalized);
  if (state.pending_registrations.length !== before) {
    if (USE_MONGO) queueMongoOp(() => _mongoDb.collection('pending_registrations').deleteOne({ email: normalized }));
    if (!USE_MONGO) saveStateFile();
  }
  return Promise.resolve();
}

function createUser({ email, password_hash, email_verified }) {
  const normalized = String(email).trim().toLowerCase();
  if (state.users.some(u => u.email === normalized)) {
    return Promise.reject(new Error('User already exists'));
  }
  const newId = state.users.length > 0 ? Math.max(...state.users.map(u => u.id)) + 1 : 1;
  const user = { id: newId, email: normalized, password_hash, email_verified: !!email_verified, created_at: new Date().toISOString() };
  state.users.push(user);
  if (USE_MONGO) queueMongoOp(() => _mongoDb.collection('users').insertOne(user));
  if (!USE_MONGO) saveStateFile();
  return Promise.resolve({ ...user });
}

function updateCatStatus(catId, status) {
  const idx = state.cats.findIndex(c => c.id === catId);
  if (idx === -1) return false;
  state.cats[idx].status = status;
  if (USE_MONGO) queueMongoOp(() => _mongoDb.collection('cats').updateOne({ id: catId }, { $set: { status } }));
  if (!USE_MONGO) saveStateFile();
  return true;
}

function addContactInquiry({ name, email, subject, message }) {
  const inquiry = {
    id: state.contact_inquiries.length + 1, name, email, subject, message,
    created_at: new Date().toISOString()
  };
  state.contact_inquiries.push(inquiry);
  if (USE_MONGO) queueMongoOp(() => _mongoDb.collection('contact_inquiries').insertOne(inquiry));
  if (!USE_MONGO) saveStateFile();
}

function getState() {
  return state;
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
module.exports.getState = getState;
