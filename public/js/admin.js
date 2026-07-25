// Admin Dashboard Frontend Logic

document.addEventListener('DOMContentLoaded', () => {
  checkAdminAuth();
});

let adminCats = [];

// Check session on load
async function checkAdminAuth() {
  try {
    const res = await fetch('/api/admin/me');
    const data = await res.json();

    if (res.ok && data.success) {
      document.getElementById('loginModal').classList.remove('active');
      loadAdminDashboard();
    } else {
      document.getElementById('loginModal').classList.add('active');
    }
  } catch (err) {
    document.getElementById('loginModal').classList.add('active');
  }
}

// Handle Admin Login
async function handleAdminLogin(e) {
  e.preventDefault();
  const username = document.getElementById('adminUsername').value;
  const password = document.getElementById('adminPassword').value;

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showToast('Logged in successfully!', 'success');
      document.getElementById('loginModal').classList.remove('active');
      loadAdminDashboard();
    } else {
      showToast(data.error || 'Invalid credentials', 'error');
    }
  } catch (err) {
    showToast('Login request failed', 'error');
  }
}

// Admin Logout
async function handleAdminLogout() {
  try {
    await fetch('/api/admin/logout', { method: 'POST' });
    showToast('Logged out', 'success');
    window.location.reload();
  } catch (err) {
    window.location.reload();
  }
}

// Load Dashboard Data
function loadAdminDashboard() {
  fetchStats();
  fetchAdminCats();
  fetchApplications();
}

// Fetch Stats
async function fetchStats() {
  try {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();
    if (data.success) {
      const s = data.stats;
      document.getElementById('statTotal').textContent = s.totalCats;
      document.getElementById('statAvailable').textContent = s.availableCats;
      document.getElementById('statPending').textContent = s.pendingCats;
      document.getElementById('statAdopted').textContent = s.adoptedCats;
      document.getElementById('statApps').textContent = s.totalApplications;
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// Fetch Cats List
async function fetchAdminCats() {
  try {
    const res = await fetch('/api/cats');
    const data = await res.json();

    if (data.success) {
      adminCats = data.data;
      renderAdminCatsTable(adminCats);
    }
  } catch (err) {
    showToast('Error loading cat listings', 'error');
  }
}

// Render Cats Table
function renderAdminCatsTable(cats) {
  const tbody = document.getElementById('adminCatsTableBody');
  if (!tbody) return;

  if (cats.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem;">No cats listed yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = cats.map(cat => {
    const isSpayed = cat.spayed_neutered === 1 || cat.spayed_neutered === '1' || cat.spayed_neutered === true;
    const isVaccinated = cat.vaccinated === 1 || cat.vaccinated === '1' || cat.vaccinated === true;

    return `
    <tr>
      <td><img src="${cat.image_url}" class="table-thumb" alt="${escapeHtml(cat.name)}" onerror="this.src='/uploads/luna.png'"></td>
      <td><strong>${escapeHtml(cat.name)}</strong></td>
      <td>${escapeHtml(cat.breed)}</td>
      <td>${cat.age} yrs (${cat.age_group})</td>
      <td>${cat.gender}</td>
      <td>
        <div style="font-size: 0.8rem; display: flex; flex-direction: column; gap: 2px;">
          <span style="color: ${isSpayed ? 'var(--status-available)' : '#E76F51'}; font-weight: 700;">
            ${isSpayed ? '<i class="fa-solid fa-check"></i> Spayed' : '<i class="fa-solid fa-xmark"></i> Not Spayed'}
          </span>
          <span style="color: ${isVaccinated ? 'var(--status-available)' : '#E76F51'}; font-weight: 700;">
            ${isVaccinated ? '<i class="fa-solid fa-check"></i> Vaccinated' : '<i class="fa-solid fa-xmark"></i> Not Vaccinated'}
          </span>
        </div>
      </td>
      <td>
        <select class="filter-select" style="padding: 0.3rem 0.5rem; font-size: 0.85rem; border-radius: var(--radius-pill); border: 1px solid rgba(44,26,29,0.15); background: var(--bg-card); cursor: pointer;" onchange="updateCatStatus(${cat.id}, this.value)">
          <option value="Available" ${cat.status === 'Available' ? 'selected' : ''}>Available</option>
          <option value="Pending" ${cat.status === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="Adopted" ${cat.status === 'Adopted' ? 'selected' : ''}>Adopted</option>
        </select>
      </td>
      <td>
        <div class="actions-cell">
          <button class="btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" onclick="editCat(${cat.id})">
            <i class="fa-solid fa-pen-to-square"></i> Edit
          </button>
          <button class="btn-danger" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" onclick="deleteCat(${cat.id})">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </div>
      </td>
    </tr>
  `;
  }).join('');
}

// Fetch Applications List
async function fetchApplications() {
  try {
    const res = await fetch('/api/admin/applications');
    const data = await res.json();

    if (data.success) {
      renderApplicationsTable(data.data);
    }
  } catch (err) {
    console.error('Error fetching applications:', err);
  }
}

// Render Applications Table
function renderApplicationsTable(apps) {
  const tbody = document.getElementById('adminAppsTableBody');
  if (!tbody) return;

  if (apps.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem;">No adoption applications received yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = apps.map(app => `
    <tr>
      <td><strong>${escapeHtml(app.cat_name)}</strong> (ID: #${app.cat_id})</td>
      <td>
        <strong>${escapeHtml(app.applicant_name)}</strong><br>
        <small style="color: var(--text-muted);">${new Date(app.submitted_at).toLocaleDateString()}</small>
      </td>
      <td>
        <div><i class="fa-solid fa-envelope"></i> ${escapeHtml(app.email)}</div>
        <div><i class="fa-solid fa-phone"></i> ${escapeHtml(app.phone)}</div>
      </td>
      <td>
        <div><strong>Housing:</strong> ${escapeHtml(app.housing_type)}</div>
        <div><strong>Experience:</strong> ${escapeHtml(app.experience)}</div>
        ${app.message ? `<div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">"${escapeHtml(app.message)}"</div>` : ''}
      </td>
      <td><span class="status-badge status-${app.status.toLowerCase()}">${app.status}</span></td>
      <td>
        <select class="filter-select" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" onchange="updateAppStatus(${app.id}, this.value)">
          <option value="Pending" ${app.status === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="Approved" ${app.status === 'Approved' ? 'selected' : ''}>Approved</option>
          <option value="Rejected" ${app.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
        </select>
      </td>
    </tr>
  `).join('');
}

// Update Application Status
async function updateAppStatus(appId, newStatus) {
  try {
    const res = await fetch(`/api/admin/applications/${appId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Application updated to ${newStatus}`, 'success');
      fetchStats();
      fetchApplications();
    } else {
      showToast(data.error || 'Failed to update application', 'error');
    }
  } catch (err) {
    showToast('Failed to update application', 'error');
  }
}

// Add/Edit Cat Modal Controls
function openCatFormModal(cat = null) {
  const modal = document.getElementById('catFormModal');
  const form = document.getElementById('catForm');
  form.reset();

  if (cat) {
    document.getElementById('catFormModalTitle').textContent = `Edit Cat: ${cat.name}`;
    document.getElementById('catFormId').value = cat.id;
    document.getElementById('catNameInput').value = cat.name;
    document.getElementById('catBreedInput').value = cat.breed;
    document.getElementById('catAgeInput').value = cat.age;
    document.getElementById('catAgeGroupInput').value = cat.age_group;
    document.getElementById('catGenderInput').value = cat.gender;
    document.getElementById('catStatusInput').value = cat.status;
    document.getElementById('catImageUrlInput').value = cat.image_url;
    document.getElementById('catTemperamentInput').value = cat.temperament;
    document.getElementById('catBioInput').value = cat.bio;
    document.getElementById('catSpayedInput').checked = cat.spayed_neutered === 1 || cat.spayed_neutered === '1' || cat.spayed_neutered === true;
    document.getElementById('catVaccinatedInput').checked = cat.vaccinated === 1 || cat.vaccinated === '1' || cat.vaccinated === true;
  } else {
    document.getElementById('catFormModalTitle').textContent = 'Add New Cat Profile';
    document.getElementById('catFormId').value = '';
    document.getElementById('catSpayedInput').checked = true;
    document.getElementById('catVaccinatedInput').checked = true;
  }

  modal.classList.add('active');
}

function closeCatFormModal() {
  document.getElementById('catFormModal').classList.remove('active');
}

function editCat(id) {
  const cat = adminCats.find(c => c.id === id);
  if (cat) openCatFormModal(cat);
}

// Save Cat (Create or Update)
async function handleSaveCat(e) {
  e.preventDefault();

  const form = document.getElementById('catForm');
  const catId = document.getElementById('catFormId').value;
  const formData = new FormData(form);

  const url = catId ? `/api/cats/${catId}` : '/api/cats';
  const method = catId ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: method,
      body: formData
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showToast(catId ? 'Cat updated successfully!' : 'New cat profile created!', 'success');
      closeCatFormModal();
      fetchAdminCats();
      fetchStats();
    } else {
      const errMsg = data.error || (data.errors ? data.errors[0].msg : 'Failed to save cat profile');
      showToast(errMsg, 'error');
    }
  } catch (err) {
    console.error('Error saving cat:', err);
    showToast('Failed to save cat profile', 'error');
  }
}

// Delete Cat
async function deleteCat(id) {
  if (!confirm('Are you sure you want to remove this cat from adoption listings?')) return;

  try {
    const res = await fetch(`/api/cats/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (res.ok && data.success) {
      showToast('Cat removed', 'success');
      fetchAdminCats();
      fetchStats();
    } else {
      showToast(data.error || 'Failed to delete cat', 'error');
    }
  } catch (err) {
    showToast('Error deleting cat', 'error');
  }
}

// Update Cat Status (inline dropdown)
async function updateCatStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/cats/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Status changed to ${newStatus}`, 'success');
      fetchAdminCats();
      fetchStats();
    } else {
      showToast(data.error || 'Failed to update status', 'error');
      fetchAdminCats();
    }
  } catch (err) {
    showToast('Failed to update status', 'error');
    fetchAdminCats();
  }
}

// Tab Switching
function switchTab(tab) {
  const sections = {
    cats: document.getElementById('catsTabSection'),
    applications: document.getElementById('appsTabSection'),
    database: document.getElementById('dbTabSection'),
  };
  const buttons = {
    cats: document.getElementById('tabCatsBtn'),
    applications: document.getElementById('tabAppsBtn'),
    database: document.getElementById('tabDbBtn'),
  };

  for (const [key, el] of Object.entries(sections)) {
    if (el) el.style.display = key === tab ? 'block' : 'none';
  }
  for (const [key, el] of Object.entries(buttons)) {
    if (el) {
      if (key === tab) el.classList.add('active');
      else el.classList.remove('active');
    }
  }

  if (tab === 'database') {
    fetchDatabaseView();
  }
}

// Database Viewer
let dbState = null;

async function fetchDatabaseView() {
  const content = document.getElementById('dbSectionContent');
  if (!content) return;
  content.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Loading database...</p>';

  try {
    const res = await fetch('/api/admin/db');
    const data = await res.json();
    if (data.success) {
      dbState = data.data;
      renderDatabaseView(data);
    } else {
      content.innerHTML = '<p style="color: #E76F51; text-align: center; padding: 2rem;">Failed to load database.</p>';
    }
  } catch (err) {
    content.innerHTML = '<p style="color: #E76F51; text-align: center; padding: 2rem;">Error loading database.</p>';
  }
}

function renderDatabaseView(data) {
  const state = data.data;
  const cards = document.getElementById('dbSummaryCards');
  const sections = ['cats', 'applications', 'users', 'admins', 'contact_inquiries', 'pending_registrations'];
  const labels = ['Cats', 'Applications', 'Users', 'Admins', 'Contact Inquiries', 'Pending Regs'];
  const icons = ['fa-cat', 'fa-file-signature', 'fa-users', 'fa-user-shield', 'fa-envelope', 'fa-clock'];

  cards.innerHTML = sections.map((s, i) => `
    <div class="db-card">
      <h4><i class="fa-solid ${icons[i]}"></i> ${labels[i]}</h4>
      <div>${(state[s] || []).length}</div>
    </div>
  `).join('');

  if (data.blobUrl) {
    document.getElementById('dbBlobUrl').innerHTML = `<i class="fa-solid fa-link"></i> <a href="${escapeHtml(data.blobUrl)}" target="_blank" rel="noopener" style="color: var(--primary-amber);">View in Blob Store</a>`;
  } else {
    document.getElementById('dbBlobUrl').innerHTML = '<span style="color: var(--text-muted);">Local file storage</span>';
  }

  // Show first section by default
  switchDbSection('cats');
}

function switchDbSection(section) {
  const buttons = document.querySelectorAll('#dbSectionSelector .tab-btn');
  buttons.forEach(btn => {
    if (btn.dataset.section === section) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  const items = dbState ? (dbState[section] || []) : [];
  renderDbSection(section, items);
}

function renderDbSection(section, items) {
  const content = document.getElementById('dbSectionContent');
  if (!content) return;

  if (items.length === 0) {
    content.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No ${section} found.</p>`;
    return;
  }

  const keys = Object.keys(items[0]);
  let html = '';
  items.forEach((item, idx) => {
    html += `<div style="margin-bottom: 0.8rem; background: var(--bg-elevated); border-radius: var(--radius-sm); padding: 0.8rem 1rem;">`;
    html += `<div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.4rem;">#${idx + 1}</div>`;
    keys.forEach(key => {
      let val = item[key];
      let displayVal;
      if (key === 'password_hash') {
        displayVal = '•••• (hidden)';
      } else if (key === 'image_url' && val) {
        displayVal = `<img src="${escapeHtml(String(val))}" style="width:40px;height:40px;border-radius:4px;object-fit:cover;vertical-align:middle;" onerror="this.style.display='none'"> ${escapeHtml(String(val))}`;
      } else if (val === null || val === undefined) {
        displayVal = '<em style="color:var(--text-muted)">null</em>';
      } else {
        displayVal = escapeHtml(String(val));
      }
      html += `<div class="db-row"><span class="db-key">${escapeHtml(key)}</span><span class="db-value">${displayVal}</span></div>`;
    });
    html += `</div>`;
  });

  content.innerHTML = html;
}

function refreshDatabaseView() {
  fetchDatabaseView();
}

// Toast Helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}
