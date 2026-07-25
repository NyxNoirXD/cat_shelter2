const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;

function verifyAdminToken(req, res, next) {
  const token = req.cookies.admin_token || req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type === 'user') {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired session' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired session' });
  }
}

function verifyUserToken(req, res, next) {
  const token = req.cookies.user_token || req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'user') {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired session' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired session' });
  }
}

function optionalUserToken(req, res, next) {
  const token = req.cookies.user_token || req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'user') {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid user session' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired session' });
  }
}

module.exports = {
  verifyAdminToken,
  verifyUserToken,
  optionalUserToken,
  JWT_SECRET
};
