const loginForm = document.getElementById('loginForm');
const statusEl = document.getElementById('status');
const dashboard = document.getElementById('dashboard');
const loginPanel = document.getElementById('loginPanel');
const userEmail = document.getElementById('userEmail');
const userRole = document.getElementById('userRole');
const releaseTagHero = document.getElementById('releaseTagHero');
const releaseTagCard = document.getElementById('releaseTagCard');
const toggleVisibility = document.getElementById('toggleVisibility');

init();

function init() {
  fetchRelease();
  loginForm.addEventListener('submit', onSubmit);
  toggleVisibility.addEventListener('click', onToggleVisibility);
}

async function fetchRelease() {
  try {
    const res = await fetch('/api/release');
    if (!res.ok) return;
    const data = await res.json();
    setReleaseTag(data.releaseTag);
  } catch (error) {
    console.warn('Could not fetch release tag', error);
  }
}

async function onSubmit(event) {
  event.preventDefault();
  statusEl.textContent = 'Checking credentials...';
  statusEl.style.color = 'var(--muted)';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (data.releaseTag) {
      setReleaseTag(data.releaseTag);
    }

    if (!res.ok) {
      renderError(data);
      return;
    }

    renderSuccess(data);
  } catch (error) {
    statusEl.textContent = 'Network error while contacting the auth service.';
    statusEl.style.color = 'var(--danger)';
    console.error(error);
  }
}

function renderError(data) {
  const messages = {
    invalid_password: 'Password does not match our records',
    unknown_user: 'User not found. Confirm the seeded accounts.',
    missing_salt: 'Auth salt missing from runtime config.',
    internal_error: 'Auth service error.'
  };
  const message = messages[data?.reason] ?? 'Login failed.';
  statusEl.textContent = message;
  statusEl.style.color = 'var(--danger)';
  dashboard.classList.add('hidden');
  loginPanel.classList.remove('hidden');
}

function renderSuccess(data) {
  statusEl.textContent = 'Authenticated. Redirecting to dashboard...';
  statusEl.style.color = 'var(--ok)';
  userEmail.textContent = data.user?.email ?? 'demo@example.com';
  userRole.textContent = data.user?.role ?? 'engineer';
  dashboard.classList.remove('hidden');
  loginPanel.classList.add('hidden');
}

function onToggleVisibility() {
  const input = document.getElementById('password');
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  toggleVisibility.textContent = isHidden ? 'Hide' : 'Show';
}

function setReleaseTag(tag) {
  if (!tag) return;
  releaseTagHero.textContent = tag;
  releaseTagCard.textContent = tag;
}
