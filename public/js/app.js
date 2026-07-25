// Main Front-end Script for Whiskers & Haven Adoption Center

document.addEventListener('DOMContentLoaded', () => {
  fetchCats();
  setupEventListeners();
  loadCurrentUser().then(() => {
    if (allCats.length > 0 && currentUser) applyUserAppsToCards();
  });

  const modal = document.getElementById('catDetailModal');
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeCatModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeCatModal();
  });
});

let allCats = [];
let currentUser = null;
let userApplications = {};

async function loadCurrentUser() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    if (data.success) {
      currentUser = data.user;
      updateAdoptionContact();
      await loadUserApplications();
    }
  } catch {
    // Visitors can still submit as guests with an email address.
  }
}

async function loadUserApplications() {
  if (!currentUser) { userApplications = {}; return; }
  try {
    const res = await fetch('/api/auth/applications', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    if (data.success) {
      userApplications = {};
      data.data.forEach(app => {
        userApplications[app.cat_id] = app;
      });
    }
  } catch {}
}

function applyUserAppsToCards() {
  if (allCats.length > 0) renderCats(allCats);
}

function updateAdoptionContact() {
  const emailGroup = document.getElementById('adoptionEmailGroup');
  const emailInput = document.getElementById('email');
  const signedInHint = document.getElementById('adoptionSignedInHint');
  if (!emailGroup || !emailInput || !signedInHint) return;

  if (currentUser) {
    emailGroup.hidden = true;
    emailInput.required = false;
    emailInput.value = currentUser.email;
    signedInHint.hidden = false;
    signedInHint.innerHTML = `<i class="fa-solid fa-circle-check"></i><span>We'll use your account email: <strong>${escapeHtml(currentUser.email)}</strong></span>`;
  } else {
    emailGroup.hidden = false;
    emailInput.required = true;
    signedInHint.hidden = true;
    signedInHint.textContent = '';
  }
}

// Fetch cats with filters applied
async function fetchCats() {
  const search = document.getElementById('searchInput').value;
  const age_group = document.getElementById('filterAgeGroup').value;
  const gender = document.getElementById('filterGender').value;
  const status = document.getElementById('filterStatus').value;

  const queryParams = new URLSearchParams();
  if (search) queryParams.append('search', search);
  if (age_group) queryParams.append('age_group', age_group);
  if (gender) queryParams.append('gender', gender);
  if (status) queryParams.append('status', status);

  const grid = document.getElementById('catsGrid');
  const spinner = document.getElementById('loadingSpinner');
  if (spinner) spinner.style.display = 'block';
  if (grid) grid.classList.add('is-loading');

  try {
    const res = await fetch(`/api/cats?${queryParams.toString()}`);
    const data = await res.json();

    if (data.success) {
      allCats = data.data;
      renderCats(allCats);
      updateHeroStats(allCats);
      if (currentUser) applyUserAppsToCards();
    }
  } catch (err) {
    console.error('Error fetching cats:', err);
    showToast('Failed to load cats. Please refresh.', 'error');
  } finally {
    if (spinner) spinner.style.display = 'none';
    if (grid) grid.classList.remove('is-loading');
  }
}

// Render cat cards grid
function renderCats(cats) {
  const grid = document.getElementById('catsGrid');
  if (!grid) return;

  if (cats.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; background: var(--bg-card); border-radius: var(--radius-md);">
        <i class="fa-solid fa-cat" style="font-size: 3rem; color: var(--primary-amber); margin-bottom: 1rem;"></i>
        <h3>No cats match your filters</h3>
        <p style="color: var(--text-muted);">Try adjusting your search criteria or view all statuses.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = cats.map((cat, index) => {
    const isSpayed = cat.spayed_neutered === 1 || cat.spayed_neutered === '1' || cat.spayed_neutered === true;
    const isVaccinated = cat.vaccinated === 1 || cat.vaccinated === '1' || cat.vaccinated === true;
    const status = ['Available', 'Pending', 'Adopted'].includes(cat.status) ? cat.status : 'Available';
    const myApp = userApplications[cat.id];
    const statusColors = { Pending: 'var(--status-pending)', Approved: 'var(--status-available)', Rejected: '#E76F51' };

    return `
    <div class="cat-card" style="animation-delay: ${index * 70}ms;">
      <div class="cat-card-img-wrapper">
        <span class="status-badge status-${status.toLowerCase()}">${escapeHtml(status)}</span>
        <img src="${escapeHtml(cat.image_url)}" alt="${escapeHtml(cat.name)}" loading="lazy" decoding="async" onerror="this.src='/uploads/luna.png'">
      </div>
      <div class="cat-card-body">
        <div class="cat-card-title">
          <h3>${escapeHtml(cat.name)}</h3>
          <span class="cat-gender ${escapeHtml(cat.gender)}">
            ${cat.gender === 'Male' ? '<i class="fa-solid fa-mars"></i>' : '<i class="fa-solid fa-venus"></i>'}
          </span>
        </div>
        <div class="cat-meta-tags">
          <span class="tag">${escapeHtml(cat.breed)}</span>
          <span class="tag">${cat.age} ${cat.age === 1 ? 'yr' : 'yrs'} old</span>
          <span class="tag">${escapeHtml(cat.age_group)}</span>
          ${isSpayed ? '<span class="tag tag-health-yes"><i class="fa-solid fa-check"></i> Spayed/Neutered</span>' : '<span class="tag tag-health-no"><i class="fa-solid fa-xmark"></i> Not Spayed</span>'}
          ${isVaccinated ? '<span class="tag tag-health-yes"><i class="fa-solid fa-syringe"></i> Vaccinated</span>' : '<span class="tag tag-health-no"><i class="fa-solid fa-triangle-exclamation"></i> Not Vaccinated</span>'}
        </div>
        <p class="cat-bio-snippet">${escapeHtml(cat.bio)}</p>
        <div class="cat-card-footer">
          ${myApp ? `
            <button class="btn-primary" style="background: ${statusColors[myApp.status] || 'var(--primary-amber)'};" onclick="openCatModal(${cat.id})">
              <i class="fa-solid fa-${myApp.status === 'Approved' ? 'check' : myApp.status === 'Rejected' ? 'xmark' : 'clock'}"></i> ${escapeHtml(myApp.status)}
            </button>
          ` : `
            <button class="btn-primary" onclick="openCatModal(${cat.id})">
              <i class="fa-solid fa-heart"></i> ${status === 'Available' ? 'Adopt Me' : 'View Profile'}
            </button>
          `}
        </div>
      </div>
    </div>
  `;
  }).join('');
}

// Setup Event Listeners
function setupEventListeners() {
  const searchInput = document.getElementById('searchInput');
  const filterAge = document.getElementById('filterAgeGroup');
  const filterGender = document.getElementById('filterGender');
  const filterStatus = document.getElementById('filterStatus');

  let debounceTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fetchCats, 300);
  });

  filterAge.addEventListener('change', fetchCats);
  filterGender.addEventListener('change', fetchCats);
  filterStatus.addEventListener('change', fetchCats);
}

// Open Cat Detail Modal
function openCatModal(catId) {
  const cat = allCats.find(c => c.id === catId);
  if (!cat) return;

  document.getElementById('modalCatTitle').textContent = `Meet ${cat.name}`;
  document.getElementById('modalCatName').textContent = cat.name;
  document.getElementById('modalCatImg').src = cat.image_url;
  document.getElementById('modalCatImg').alt = `${cat.name} - ${cat.breed}`;
  document.getElementById('modalCatBreedMeta').textContent = `${cat.breed} • ${cat.age} years old (${cat.age_group}) • ${cat.gender}`;
  const metaLine = document.getElementById('modalCatExtraMeta');
  const parts = [];
  if (cat.intake_date) parts.push(`<i class="fa-solid fa-calendar-day"></i> Intake: ${new Date(cat.intake_date).toLocaleDateString()}`);
  if (cat.weight_kg) parts.push(`<i class="fa-solid fa-weight-scale"></i> ${cat.weight_kg} kg`);
  if (parts.length) {
    metaLine.innerHTML = parts.join(' &nbsp;·&nbsp; ');
    metaLine.style.display = 'block';
  } else {
    metaLine.style.display = 'none';
  }
  document.getElementById('modalCatBio').textContent = cat.bio;

  const availabilityNotice = document.getElementById('modalAvailabilityNotice');
  const adoptionHeading = document.getElementById('adoptionFormHeading');
  const adoptionForm = document.getElementById('adoptionForm');
  const appStatusContainer = document.getElementById('applicationStatusContainer');
  const isAvailable = cat.status === 'Available';
  const myApp = userApplications[cat.id];

  if (myApp) {
    availabilityNotice.hidden = true;
    adoptionHeading.hidden = true;
    adoptionForm.hidden = true;
    appStatusContainer.hidden = false;
    const statusColors = { Pending: 'var(--status-pending)', Approved: 'var(--status-available)', Rejected: '#E76F51' };
    const statusIcons = { Pending: 'fa-clock', Approved: 'fa-circle-check', Rejected: 'fa-circle-xmark' };
    const submittedAt = new Date(myApp.submitted_at).toLocaleDateString();
    appStatusContainer.innerHTML = `
      <div style="text-align:center;padding:1.5rem;background:var(--bg-elevated);border-radius:var(--radius-md);">
        <i class="fa-solid ${statusIcons[myApp.status] || 'fa-clock'}" style="font-size:2.5rem;color:${statusColors[myApp.status] || 'var(--text-muted)'};margin-bottom:0.75rem;"></i>
        <h3 style="font-size:1.3rem;">Application ${escapeHtml(myApp.status)}</h3>
        <p style="color:var(--text-muted);margin-top:0.5rem;">
          Your adoption request for <strong>${escapeHtml(cat.name)}</strong> was submitted on ${submittedAt}.
        </p>
        <p style="color:var(--text-muted);font-size:0.9rem;margin-top:0.5rem;">
          ${myApp.status === 'Pending' ? 'Our team is reviewing your application. We\'ll reach out soon.' :
            myApp.status === 'Approved' ? 'Great news! Your application has been approved. Please check your email for next steps.' :
            myApp.rejection_reason ? escapeHtml(myApp.rejection_reason) :
            'Unfortunately your application was not approved at this time. You\'re welcome to apply for another cat.'}
        </p>
        <a href="/login" style="display:inline-block;margin-top:1rem;color:var(--primary-amber);text-decoration:none;font-weight:600;">
          <i class="fa-solid fa-arrow-right"></i> View all my applications
        </a>
      </div>
    `;
  } else if (!isAvailable) {
    availabilityNotice.hidden = false;
    adoptionHeading.hidden = true;
    adoptionForm.hidden = true;
    appStatusContainer.hidden = true;
    availabilityNotice.innerHTML = `<i class="fa-solid fa-clock"></i><span>${escapeHtml(cat.name)} is ${escapeHtml(cat.status.toLowerCase())} right now. You can still view their profile and check back soon.</span>`;
  } else {
    availabilityNotice.hidden = true;
    adoptionHeading.hidden = false;
    adoptionForm.hidden = false;
    appStatusContainer.hidden = true;
    updateAdoptionContact();
  }

  // Dynamic Health Pills
  const spayedPill = document.getElementById('modalSpayedPill');
  const vaccinatedPill = document.getElementById('modalVaccinatedPill');

  const isSpayed = cat.spayed_neutered === 1 || cat.spayed_neutered === '1' || cat.spayed_neutered === true;
  const isVaccinated = cat.vaccinated === 1 || cat.vaccinated === '1' || cat.vaccinated === true;

  if (isSpayed) {
    spayedPill.className = 'health-pill health-yes';
    spayedPill.innerHTML = '<i class="fa-solid fa-check"></i> Spayed/Neutered';
  } else {
    spayedPill.className = 'health-pill health-no';
    spayedPill.innerHTML = '<i class="fa-solid fa-xmark"></i> Not Spayed/Neutered';
  }

  if (isVaccinated) {
    vaccinatedPill.className = 'health-pill health-yes';
    vaccinatedPill.innerHTML = '<i class="fa-solid fa-syringe"></i> Vaccinated';
  } else {
    vaccinatedPill.className = 'health-pill health-no';
    vaccinatedPill.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Not Vaccinated';
  }

  // Temperament tags
  const tagsContainer = document.getElementById('modalTemperamentTags');
  const tags = cat.temperament ? cat.temperament.split(',').map(t => t.trim()) : [];
  tagsContainer.innerHTML = tags.map(t => `<span class="tag" style="background: var(--primary-soft); color: var(--primary-amber); font-weight: 700;">#${escapeHtml(t)}</span>`).join('');

  // Form hidden values
  document.getElementById('formCatId').value = cat.id;
  document.getElementById('formCatName').value = cat.name;

  const modal = document.getElementById('catDetailModal');
  modal.classList.add('active');
}

function closeCatModal() {
  document.getElementById('catDetailModal').classList.remove('active');
}

// Submit Adoption Application
async function handleAdoptionSubmit(e) {
  e.preventDefault();

  const cat_id = document.getElementById('formCatId').value;
  const cat_name = document.getElementById('formCatName').value;
  const applicant_name = document.getElementById('applicant_name').value;
  const email = currentUser?.email || document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value;
  const housing_type = document.getElementById('housing_type').value;
  const experience = document.getElementById('experience').value;
  const message = document.getElementById('message').value;

  try {
    const res = await fetch('/api/adopt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        cat_id: parseInt(cat_id),
        cat_name,
        applicant_name,
        email,
        phone,
        housing_type,
        experience,
        message
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showToast(data.message || 'Adoption application submitted successfully!', 'success');
      document.getElementById('adoptionForm').reset();
      closeCatModal();
    } else {
      const errMsg = data.error || (data.errors ? data.errors[0].msg : 'Failed to submit application');
      showToast(errMsg, 'error');
    }
  } catch (err) {
    console.error('Submission error:', err);
    showToast('Network error while submitting application.', 'error');
  }
}

// Update stats on hero
function updateHeroStats(cats) {
  const total = cats.length;
  const available = cats.filter(c => c.status === 'Available').length;
  const vaccinated = cats.filter(c => c.vaccinated === 1 || c.vaccinated === '1' || c.vaccinated === true).length;
  const healthPercent = total > 0 ? `${Math.round((vaccinated / total) * 100)}%` : '0%';

  document.getElementById('statTotalCats').textContent = total;
  document.getElementById('statAvailableCats').textContent = available;
  document.getElementById('statHealthPercent').textContent = healthPercent;
}

// Helper: Toast Notifications
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

// XSS Sanitizer helper
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
