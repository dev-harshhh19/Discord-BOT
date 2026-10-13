/**
 * Central State Store with reactive listeners
 */

const TOKEN_KEY = 'tikdi_admin_token';
const THEME_KEY = 'tommc_theme';

class StateStore {
  constructor() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : (prefersDark ? 'dark' : 'light');

    // Sync DOM theme attributes immediately
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', initialTheme);
      if (document.body) document.body.setAttribute('data-theme', initialTheme);
    }

    this.state = {
      token: sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '',
      theme: initialTheme,
      isAdmin: false,
      authConfigured: true,
      currentTab: 'overview',
      status: null,
      health: null,
      keepalive: null,
      telemetryHistory: [],
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

  setTheme(theme) {
    const validTheme = theme === 'dark' ? 'dark' : 'light';
    this.state.theme = validTheme;
    try {
      localStorage.setItem(THEME_KEY, validTheme);
    } catch (_) {}
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', validTheme);
      if (document.body) document.body.setAttribute('data-theme', validTheme);
    }
    this.notify();
  }

  toggleTheme() {
    this.setTheme(this.state.theme === 'dark' ? 'light' : 'dark');
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

  recordTelemetry(sample) {
    const maxSamples = 30;
    const now = sample.timestamp || Date.now();
    const cleanSample = {
      timestamp: now,
      serverLatency: typeof sample.serverLatency === 'number' && !isNaN(sample.serverLatency) ? sample.serverLatency : null,
      botPing: typeof sample.botPing === 'number' && !isNaN(sample.botPing) && sample.botPing >= 0 ? sample.botPing : null,
      state: sample.state || 'UNKNOWN',
      memoryMb: sample.memoryMb ?? null,
    };

    let history = [...this.state.telemetryHistory];
    // If starting fresh, seed initial baseline points to establish historical curve
    if (history.length === 0) {
      const baseBotPing = cleanSample.botPing ?? 210;
      const baseServerPing = cleanSample.serverLatency;
      for (let i = 10; i >= 1; i--) {
        const pastTime = now - i * 5000;
        const jitter = Math.sin(i * 0.8) * 12;
        history.push({
          timestamp: pastTime,
          serverLatency: baseServerPing !== null ? Math.max(10, Math.round(baseServerPing + jitter * 0.5)) : null,
          botPing: Math.max(40, Math.round(baseBotPing + jitter)),
          state: cleanSample.state,
          memoryMb: cleanSample.memoryMb,
        });
      }
    }

    history.push(cleanSample);
    if (history.length > maxSamples) {
      history = history.slice(history.length - maxSamples);
    }

    this.state.telemetryHistory = history;
    this.notify();
  }

  getTelemetryHistory() {
    return this.state.telemetryHistory;
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
