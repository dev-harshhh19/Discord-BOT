import { store } from './state.js';
import { api } from './api.js';
import { renderNavbar } from './components/navbar.js';
import { renderOverview } from './components/overview.js';
import { renderMembers } from './components/members.js';
import { renderAccessControl } from './components/accessControl.js';
import { renderLogs } from './components/logs.js';
import { renderAboutDev } from './components/aboutDev.js';

/**
 * Main Application Orchestrator
 */

class App {
  constructor() {
    this.navContainer = document.getElementById('navbar-container');
    this.tabContainers = {
      overview: document.getElementById('tab-overview'),
      members: document.getElementById('tab-members'),
      access: document.getElementById('tab-access'),
      logs: document.getElementById('tab-logs'),
      dev: document.getElementById('tab-dev'),
    };
    this.pollingInterval = null;
    this.activeTab = 'overview';
    this.lastAdminState = false;
  }

  async init() {
    // 1. Subscribe to state changes
    store.subscribe((state) => {
      const tabChanged = state.currentTab !== this.activeTab;
      const adminChanged = state.isAdmin !== this.lastAdminState;

      if (tabChanged || adminChanged) {
        this.activeTab = state.currentTab;
        this.lastAdminState = state.isAdmin;
        void this.fetchTabContent(this.activeTab, true);
      }

      this.render(state);
    });

    // 2. Validate current session / token
    const authRes = await api.checkAuth();
    if (authRes.success) {
      store.update({
        isAdmin: authRes.authenticated,
        authConfigured: authRes.authConfigured,
      });
      this.lastAdminState = authRes.authenticated;
    }

    // 3. Initial load
    await Promise.all([
      this.fetchStatus(),
      this.fetchDevProfile(),
      this.fetchTabContent(store.getState().currentTab, true),
      this.fetchTabContent('members', false),
      this.fetchTabContent('access', false),
    ]);

    // 4. Start background polling (5 seconds)
    this.startPolling();
  }

  startPolling() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.pollingInterval = setInterval(async () => {
      await this.fetchStatus();
      const state = store.getState();
      if (state.currentTab === 'logs' && state.isAdmin) {
        const logsRes = await api.getLogs(150);
        if (logsRes.success && logsRes.logs) {
          store.update({ logs: logsRes.logs });
        }
      }
    }, 5000);
  }

  async fetchStatus() {
    const res = await api.getStatus();
    if (res.success) {
      store.update({
        status: res,
        isAdmin: res.role === 'admin' || store.getState().isAdmin,
      });
    }
  }

  async fetchDevProfile() {
    const res = await api.getDevInfo();
    if (res.success) {
      store.update({ devProfile: res });
    }
  }

  async fetchTabContent(tab, force = false) {
    const state = store.getState();
    try {
      if (tab === 'members') {
        const res = await api.getMembers();
        if (res.success) {
          store.update({
            members: res.members || [],
            guild: res.guild || null,
            minecraftPlayers: res.minecraft || null,
            registeredPlayers: res.registeredPlayers || [],
          });
        }
      } else if (tab === 'access') {
        const res = await api.getAccessControl();
        if (res.success) {
          store.update({ accessControl: res });
        }
      } else if (tab === 'logs' && state.isAdmin) {
        const res = await api.getLogs(150);
        if (res.success) {
          store.update({ logs: res.logs || [] });
        }
      } else if (tab === 'overview' && force) {
        await this.fetchStatus();
      }
    } catch (err) {
      console.error(`Error fetching tab content for ${tab}:`, err);
    }
  }

  render(state) {
    // Render Header & Navigation
    if (this.navContainer) {
      renderNavbar(this.navContainer);
    }

    // Toggle active tab content visibility
    for (const [tabKey, container] of Object.entries(this.tabContainers)) {
      if (!container) continue;

      if (tabKey === state.currentTab) {
        container.classList.add('active');
        // Render content for this tab
        if (tabKey === 'overview') renderOverview(container);
        else if (tabKey === 'members') renderMembers(container);
        else if (tabKey === 'access') renderAccessControl(container);
        else if (tabKey === 'logs') renderLogs(container);
        else if (tabKey === 'dev') renderAboutDev(container);
      } else {
        container.classList.remove('active');
      }
    }
  }
}

// Bootstrap application on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init().catch(console.error);
});
