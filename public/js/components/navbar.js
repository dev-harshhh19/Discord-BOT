import { getIcon } from '../icons.js';
import { store } from '../state.js';
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
          <div class="brand-title" style="cursor:pointer;" id="brand-title-link">${escapeHtml(serverName)}</div>
          <div class="brand-subtitle">Discord Bot & Telemetry Hub</div>
        </div>
      </div>

      <div class="header-meta">
        <div class="status-pill ${stateClass}" id="header-status-pill">
          <span class="status-dot"></span>
          <span class="status-text">${escapeHtml(serverState)}</span>
        </div>
      </div>
    </header>

    <nav class="nav-tabs">
      <button class="nav-tab-btn ${state.currentTab === 'landing' ? 'active' : ''}" data-tab="landing">
        <span class="icon">${getIcon('home')}</span>
        <span>Home</span>
      </button>

      <button class="nav-tab-btn ${state.currentTab === 'overview' ? 'active' : ''}" data-tab="overview">
        <span class="icon">${getIcon('server')}</span>
        <span>Dashboard</span>
      </button>

      <button class="nav-tab-btn ${state.currentTab === 'members' ? 'active' : ''}" data-tab="members">
        <span class="icon">${getIcon('users')}</span>
        <span>Members</span>
        ${state.members?.length ? `<span class="badge-count">${state.members.length}</span>` : ''}
      </button>

      <button class="nav-tab-btn ${state.currentTab === 'access' ? 'active' : ''}" data-tab="access">
        <span class="icon">${getIcon('shield')}</span>
        <span>Access</span>
        ${!isAdmin ? `<span class="icon" style="color: var(--text-dim);">${getIcon('lock')}</span>` : ''}
      </button>

      <button class="nav-tab-btn ${state.currentTab === 'logs' ? 'active' : ''}" data-tab="logs">
        <span class="icon">${getIcon('terminal')}</span>
        <span>Logs</span>
        ${!isAdmin ? `<span class="icon" style="color: var(--text-dim);">${getIcon('lock')}</span>` : ''}
      </button>

      <div style="flex-grow: 1;"></div>

      ${
        isAdmin
          ? `
        <button class="nav-tab-btn" id="auth-lock-btn" title="Logged in as Admin. Click to lock session.">
          <span class="icon">${getIcon('logOut')}</span>
          <span>Log Out</span>
        </button>
      `
          : `
        <button class="nav-tab-btn ${state.currentTab === 'login' ? 'active' : ''}" data-tab="login">
          <span class="icon">${getIcon('key')}</span>
          <span>Admin Login</span>
        </button>
      `
      }
    </nav>
  `;

  // Attach event handlers
  container.querySelector('#brand-title-link')?.addEventListener('click', () => {
    store.setCurrentTab('landing');
  });

  container.querySelector('#auth-lock-btn')?.addEventListener('click', () => {
    store.clearToken();
    store.setCurrentTab('landing');
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
