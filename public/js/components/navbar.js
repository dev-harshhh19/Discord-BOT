import { getIcon } from '../icons.js';
import { store } from '../state.js';
import { openAuthModal } from './authModal.js';
import { showToast } from './toast.js';

/**
 * Navbar & Header Component
 */

export function renderNavbar(container) {
  const state = store.getState();
  const serverState = state.status?.server?.state || 'OFFLINE';
  const serverName = state.status?.server?.name || 'Minecraft Server';
  const stateClass = serverState.toLowerCase();
  const isAdmin = state.isAdmin;

  container.innerHTML = `
    <header class="app-header">
      <div class="brand-section">
        <div class="brand-icon">
          ${getIcon('server')}
        </div>
        <div>
          <div class="brand-title">${escapeHtml(serverName)}</div>
          <div class="brand-subtitle">Discord Bot & Telemetry Hub</div>
        </div>
      </div>

      <div class="header-meta">
        <div class="status-pill ${stateClass}" id="header-status-pill">
          <span class="status-dot"></span>
          <span class="status-text">${escapeHtml(serverState)}</span>
        </div>

        ${
          isAdmin
            ? `
          <button class="auth-btn admin" id="auth-lock-btn" title="Logged in as Admin. Click to lock session.">
            <span class="icon">${getIcon('unlock')}</span>
            <span>Admin Active</span>
            <span class="icon" style="margin-left: 0.25rem;">${getIcon('logOut')}</span>
          </button>
        `
            : `
          <button class="auth-btn guest" id="auth-unlock-btn" title="Click to enter password and unlock Admin access">
            <span class="icon">${getIcon('lock')}</span>
            <span>Unlock Admin</span>
          </button>
        `
        }
      </div>
    </header>

    <nav class="nav-tabs">
      <button class="nav-tab-btn ${state.currentTab === 'overview' ? 'active' : ''}" data-tab="overview">
        <span class="icon">${getIcon('server')}</span>
        <span>Overview</span>
      </button>

      <button class="nav-tab-btn ${state.currentTab === 'members' ? 'active' : ''}" data-tab="members">
        <span class="icon">${getIcon('users')}</span>
        <span>Active Members</span>
        ${state.members?.length ? `<span class="badge-count">${state.members.length}</span>` : ''}
      </button>

      <button class="nav-tab-btn ${state.currentTab === 'access' ? 'active' : ''}" data-tab="access">
        <span class="icon">${getIcon('shield')}</span>
        <span>Access Control</span>
        ${!isAdmin ? `<span class="icon" style="color: var(--text-dim);">${getIcon('lock')}</span>` : ''}
      </button>

      <button class="nav-tab-btn ${state.currentTab === 'logs' ? 'active' : ''}" data-tab="logs">
        <span class="icon">${getIcon('terminal')}</span>
        <span>Live Logs</span>
        ${!isAdmin ? `<span class="icon" style="color: var(--text-dim);">${getIcon('lock')}</span>` : ''}
      </button>

      <button class="nav-tab-btn ${state.currentTab === 'dev' ? 'active' : ''}" data-tab="dev">
        <span class="icon">${getIcon('code')}</span>
        <span>About Dev</span>
      </button>
    </nav>
  `;

  // Attach event handlers
  container.querySelector('#auth-unlock-btn')?.addEventListener('click', () => {
    openAuthModal();
  });

  container.querySelector('#auth-lock-btn')?.addEventListener('click', () => {
    store.clearToken();
    showToast('Admin session locked.', 'info');
  });

  const tabButtons = container.querySelectorAll('.nav-tab-btn');
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      if (targetTab) {
        store.setCurrentTab(targetTab);
      }
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
