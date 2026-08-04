/**
 * Central State Store with reactive listeners
 */

const TOKEN_KEY = 'tikdi_admin_token';

class StateStore {
  constructor() {
    this.state = {
      token: sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '',
      isAdmin: false,
      authConfigured: true,
      currentTab: 'overview',
      status: null,
      minecraftPlayers: null,
      registeredPlayers: [],
      members: [],
      guild: null,
      accessControl: null,
      logs: [],
      devProfile: null,
      isActionLoading: false,
      rateLimitSeconds: 0,
      autoScrollLogs: true,
    };
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  setToken(token, persist = false) {
    this.state.token = token;
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
      if (persist) localStorage.setItem(TOKEN_KEY, token);
      this.state.isAdmin = true;
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
      this.state.isAdmin = false;
    }
    this.notify();
  }

  clearToken() {
    this.setToken('');
  }

  setCurrentTab(tab) {
    this.state.currentTab = tab;
    this.notify();
  }

  update(partial) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error('State listener error:', err);
      }
    }
  }
}

export const store = new StateStore();
