import { store } from './state.js';
import { api } from './api.js';
import { renderNavbar } from './components/navbar.js';
import { renderOverview } from './components/overview.js';
import { renderMembers } from './components/members.js';
import { renderAccessControl } from './components/accessControl.js';
import { renderLogs } from './components/logs.js';
import { renderLogin } from './components/login.js';

/**
 * Modern Application Orchestrator
 */

class App {
  constructor() {
    this.navContainer = document.getElementById('navbar-container');
    this.tabContainers = {
      overview: document.getElementById('tab-overview'),
      members: document.getElementById('tab-members'),
      logs: document.getElementById('tab-logs'),
      access: document.getElementById('tab-access'),
      login: document.getElementById('tab-login'),
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

      if (tabChanged) {
        const path = state.currentTab === 'overview' ? '/' : `/${state.currentTab}`;
        if (window.location.pathname !== path) {
          window.history.pushState({ tab: state.currentTab }, '', path);
        }
      }

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

    // 3. Routing
    this.handleRouting();
    window.addEventListener('popstate', () => this.handleRouting());

    // 4. Initial load
    await Promise.all([
      this.fetchStatus(),
      this.fetchTabContent(store.getState().currentTab, true),
      this.fetchTabContent('members', false),
      this.fetchTabContent('access', false),
    ]);

    // 5. Calm background polling (8s when active tab, paused in background)
    this.startPolling();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        void this.fetchStatus();
      }
    });
  }

  handleRouting() {
    const path = window.location.pathname.toLowerCase();
    if (path === '/members' || path === '/players') {
      store.setCurrentTab('members');
    } else if (path === '/logs' || path === '/console') {
      store.setCurrentTab('logs');
    } else if (path === '/access' || path === '/commands') {
      store.setCurrentTab('access');
    } else if (path === '/login') {
      store.setCurrentTab('login');
    } else {
      store.setCurrentTab('overview');
    }
  }

  startPolling() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.pollingInterval = setInterval(async () => {
      if (document.hidden) return;

      await this.fetchStatus(true);
      const state = store.getState();
      if (state.currentTab === 'logs' && state.isAdmin) {
        const logsRes = await api.getLogs(150, true);
        if (logsRes.success && logsRes.logs) {
          store.update({ logs: logsRes.logs });
        }
      }
    }, 8000);
  }

  async fetchStatus(isBackground = false) {
    const res = await api.getStatus(isBackground);

    if (res && res.success) {
      store.update({
        status: res,
        isAdmin: res.role === 'admin' || store.getState().isAdmin,
      });
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
    if (this.navContainer) {
      renderNavbar(this.navContainer);
    }

    for (const [tabKey, container] of Object.entries(this.tabContainers)) {
      if (!container) continue;

      if (tabKey === state.currentTab) {
        container.classList.add('active');
        if (tabKey === 'overview') renderOverview(container);
        else if (tabKey === 'members') renderMembers(container);
        else if (tabKey === 'access') renderAccessControl(container);
        else if (tabKey === 'logs') renderLogs(container);
        else if (tabKey === 'login') renderLogin(container);
      } else {
        container.classList.remove('active');
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init().catch(console.error);
});
