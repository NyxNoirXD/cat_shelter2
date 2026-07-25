const DEFAULT_BASE_US = 'https://us1.platform.bird.com';
const DEFAULT_BASE_EU = 'https://eu1.platform.bird.com';

const devOtpStore = new Map();

function getBirdConfig() {
  const apiKey = process.env.BIRD_API_KEY;
  let baseUrl = process.env.BIRD_API_BASE_URL;
  
  if (!baseUrl && apiKey) {
    if (apiKey.startsWith('bk_eu1_')) {
      baseUrl = DEFAULT_BASE_EU;
    } else if (apiKey.startsWith('bk_us1_')) {
      baseUrl = DEFAULT_BASE_US;
    } else {
      baseUrl = DEFAULT_BASE_US;
    }
  } else if (!baseUrl) {
    baseUrl = DEFAULT_BASE_US;
  }
  
  baseUrl = baseUrl.replace(/\/$/, '');
  
  return { apiKey, baseUrl };
}

function isDevMode() {
  return !process.env.BIRD_API_KEY;
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function parseBirdError(response) {
  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  const message =
    body.message ||
    body.error?.message ||
    body.errors?.[0]?.message ||
    `Bird API request failed (${response.status})`;
  const err = new Error(message);
  err.status = response.status;
  err.body = body;
  return err;
}

async function sendEmailOtp(emailAddress) {
  const { apiKey, baseUrl } = getBirdConfig();
  
  if (isDevMode()) {
    const code = generateOtp();
    const expiresAt = Date.now() + 15 * 60 * 1000;
    devOtpStore.set(emailAddress.toLowerCase(), { code, expiresAt });
    console.log(`[DEV MODE] OTP for ${emailAddress}: ${code} (expires in 15 min)`);
    return { success: true };
  }

  const response = await fetch(`${baseUrl}/v1/verify/verifications`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: { email_address: emailAddress }
    })
  });

  if (!response.ok) {
    throw await parseBirdError(response);
  }

  return response.json().catch(() => ({}));
}

async function checkEmailOtp(emailAddress, code) {
  const normalizedEmail = emailAddress.toLowerCase();
  
  if (isDevMode()) {
    const stored = devOtpStore.get(normalizedEmail);
    if (!stored) {
      const err = new Error('No OTP found for this email. Request a new one.');
      err.status = 404;
      throw err;
    }
    if (Date.now() > stored.expiresAt) {
      devOtpStore.delete(normalizedEmail);
      const err = new Error('OTP expired. Request a new one.');
      err.status = 400;
      throw err;
    }
    if (stored.code !== code) {
      const err = new Error('Invalid OTP code.');
      err.status = 400;
      throw err;
    }
    devOtpStore.delete(normalizedEmail);
    return { success: true };
  }

  const { apiKey, baseUrl } = getBirdConfig();

  const response = await fetch(`${baseUrl}/v1/verify/verifications/check`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: { email_address: emailAddress },
      code
    })
  });

  if (!response.ok) {
    throw await parseBirdError(response);
  }

  const body = await response.json().catch(() => ({}));
  // Bird returns 200 with success:false for wrong/expired codes (not an HTTP error)
  if (!body.success) {
    const reason = body.reason || 'incorrect_code';
    const err = new Error(
      reason === 'expired' ? 'Verification code expired' : 'Invalid verification code'
    );
    err.status = 400;
    err.code = reason;
    throw err;
  }

  return body;
}

module.exports = {
  sendEmailOtp,
  checkEmailOtp
};
