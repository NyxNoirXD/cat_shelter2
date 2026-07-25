document.addEventListener('DOMContentLoaded', () => {
  checkSession();
  setupTabs();
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('registerForm').addEventListener('submit', handleRegisterSendOtp);
  document.getElementById('verifyOtpForm').addEventListener('submit', handleVerifyOtp);
  document.getElementById('resendOtpBtn').addEventListener('click', handleResendOtp);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
});

let pendingRegisterEmail = '';
let pendingRegisterPassword = '';

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function setupTabs() {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
    });
  });
}

function showLoggedIn(email) {
  document.getElementById('authForms').style.display = 'none';
  document.getElementById('loggedInView').style.display = 'block';
  document.getElementById('loggedInEmail').textContent = email;
  loadMyApplications();
}

async function checkSession() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      showLoggedIn(data.user.email);
    }
  } catch {
    /* not logged in */
  }
}

async function loadMyApplications() {
  const list = document.getElementById('accountApplicationsList');
  if (!list) return;

  try {
    const res = await fetch('/api/auth/applications', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      list.innerHTML = '<p class="account-empty">We could not load your requests. Please refresh and try again.</p>';
      return;
    }

    if (!data.data.length) {
      list.innerHTML = '<div class="account-empty"><i class="fa-solid fa-paw"></i><p>You have not submitted an adoption request yet.</p></div>';
      return;
    }

    list.innerHTML = data.data.map(application => {
      const status = ['Pending', 'Approved', 'Rejected'].includes(application.status)
        ? application.status
        : 'Pending';
      const submittedAt = new Date(application.submitted_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      return `
        <article class="account-application">
          <div class="account-application-topline">
            <strong>${escapeHtml(application.cat_name)}</strong>
            <span class="account-status status-${status.toLowerCase()}">${status}</span>
          </div>
          <p>Request submitted ${submittedAt}</p>
          <small>${status === 'Pending' ? 'Our shelter team is reviewing your request.' : status === 'Rejected' && application.rejection_reason ? `Reason: ${escapeHtml(application.rejection_reason)}` : `This request has been ${status.toLowerCase()}.`}</small>
        </article>
      `;
    }).join('');
  } catch {
    list.innerHTML = '<p class="account-empty">We could not load your requests. Please refresh and try again.</p>';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Login failed', 'error');
      return;
    }
    showToast('Welcome back!', 'success');
    showLoggedIn(data.user.email);
  } catch {
    showToast('Login request failed', 'error');
  }
}

async function handleRegisterSendOtp(e) {
  e.preventDefault();
  pendingRegisterEmail = document.getElementById('registerEmail').value.trim();
  pendingRegisterPassword = document.getElementById('registerPassword').value;
  const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

  if (pendingRegisterPassword !== passwordConfirm) {
    showToast('Passwords do not match', 'error');
    return;
  }

  try {
    const res = await fetch('/api/auth/register/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: pendingRegisterEmail,
        password: pendingRegisterPassword,
        password_confirm: passwordConfirm
      })
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error || data.errors?.[0]?.msg || 'Could not send code';
      showToast(msg, 'error');
      return;
    }
    document.getElementById('otpEmailDisplay').textContent = pendingRegisterEmail;
    document.getElementById('registerStep1').classList.remove('active');
    document.getElementById('registerStep2').classList.add('active');
    showToast('Check your email for the 6-digit code', 'success');
  } catch {
    showToast('Request failed', 'error');
  }
}

async function handleVerifyOtp(e) {
  e.preventDefault();
  const code = document.getElementById('otpCode').value.trim();

  try {
    const res = await fetch('/api/auth/register/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: pendingRegisterEmail,
        code,
        password: pendingRegisterPassword
      })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Verification failed', 'error');
      return;
    }
    showToast('Account created!', 'success');
    showLoggedIn(data.user.email);
  } catch {
    showToast('Verification request failed', 'error');
  }
}

async function handleResendOtp() {
  if (!pendingRegisterEmail || !pendingRegisterPassword) {
    showToast('Start registration again', 'error');
    return;
  }
  try {
    const res = await fetch('/api/auth/register/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: pendingRegisterEmail,
        password: pendingRegisterPassword,
        password_confirm: pendingRegisterPassword
      })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Could not resend code', 'error');
      return;
    }
    showToast('New code sent', 'success');
  } catch {
    showToast('Resend failed', 'error');
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    location.reload();
  } catch {
    showToast('Logout failed', 'error');
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[character]));
}
