import { getIcon } from '../icons.js';
import { store } from '../state.js';
import { showToast } from './toast.js';

/**
 * Modern SaaS Navbar & Header Component
 */

export function renderNavbar(container) {
  const state = store.getState();
  const serverState = state.status?.server?.state || 'OFFLINE';
  const serverName = state.status?.server?.name || 'Minecraft Server';
  const stateClass = serverState.toLowerCase();
  const isAdmin = state.isAdmin;
  const brandImgUrl = state.status?.bot?.user?.avatar || '/img/logo.svg';

  container.innerHTML = `
    <header class="app-header">
      <div class="brand-section" id="brand-title-link">
        <img class="brand-img" src="${escapeHtml(brandImgUrl)}" alt="${escapeHtml(serverName)}" onerror="this.src='/img/logo.svg'" />
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
      </div>
    </header>

    <nav class="nav-tabs">
      <button class="nav-tab-btn ${state.currentTab === 'overview' ? 'active' : ''}" data-tab="overview">
        <span class="icon">${getIcon('server')}</span>
        <span>Dashboard</span>
      </button>

      <button class="nav-tab-btn ${state.currentTab === 'members' ? 'active' : ''}" data-tab="members">
        <span class="icon">${getIcon('users')}</span>
        <span>Players</span>
        ${state.members?.length ? `<span class="badge-count">${state.members.length}</span>` : ''}
      </button>

      <button class="nav-tab-btn ${state.currentTab === 'logs' ? 'active' : ''}" data-tab="logs">
        <span class="icon">${getIcon('terminal')}</span>
        <span>Live Console</span>
        ${!isAdmin ? `<span class="icon" style="color: var(--text-dim);">${getIcon('lock')}</span>` : ''}
      </button>

      <button class="nav-tab-btn ${state.currentTab === 'access' ? 'active' : ''}" data-tab="access">
        <span class="icon">${getIcon('shield')}</span>
        <span>Commands</span>
      </button>

      <div style="flex-grow: 1;"></div>

      ${
        isAdmin
          ? `
        <button class="nav-tab-btn auth-btn" id="auth-lock-btn" title="Logged in as Admin. Click to log out.">
          <span class="icon" style="color: var(--color-primary);">${getIcon('logOut')}</span>
          <span>Log Out</span>
        </button>
      `
          : `
        <button class="nav-tab-btn auth-btn ${state.currentTab === 'login' ? 'active' : ''}" data-tab="login">
          <span class="icon" style="color: var(--color-primary);">${getIcon('key')}</span>
          <span>Admin Login</span>
        </button>
      `
      }
    </nav>
  `;

  // Attach event handlers
  container.querySelector('#brand-title-link')?.addEventListener('click', () => {
    store.setCurrentTab('overview');
  });

  container.querySelector('#auth-lock-btn')?.addEventListener('click', () => {
    store.clearToken();
    store.setCurrentTab('overview');
    showToast('Admin session locked.', 'info');
  });

  const tabButtons = container.querySelectorAll('.nav-tab-btn[data-tab]');
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
