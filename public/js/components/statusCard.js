import { api } from '../api.js';
import { getIcon } from '../icons.js';
import { store } from '../state.js';

/**
 * Reusable Status Card Component
 * Fetches and renders real-time health and uptime data from the bot's health API (/api/health).
 */

export class StatusCard {
  /**
   * @param {HTMLElement} container - The DOM element to render the status card into.
   * @param {Object} options - Configuration options.
   * @param {boolean} [options.autoRefresh=true] - Whether to automatically poll /api/health.
   * @param {number} [options.refreshInterval=5000] - Polling interval in milliseconds.
   * @param {boolean} [options.liveTicker=true] - Whether to tick process uptime every second.
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      autoRefresh: options.autoRefresh ?? true,
      refreshInterval: options.refreshInterval ?? 5000,
      liveTicker: options.liveTicker ?? true,
      ...options,
    };

    this.healthData = null;
    this.uptimeSeconds = 0;
    this.isFetching = false;
    this.lastFetchedTime = null;
    this.pollTimer = null;
    this.tickerTimer = null;
    this.id = 'status-card-' + Math.random().toString(36).slice(2, 9);
  }

  async init() {
    this.renderInitialSkeleton();
    await this.fetchHealth();

    if (this.options.liveTicker) {
      this.startTicker();
    }

    if (this.options.autoRefresh) {
      this.startPolling();
    }
  }

  async fetchHealth() {
    if (this.isFetching) return;
    this.isFetching = true;
    this.setRefreshButtonState(true);

    try {
      const res = await api.getHealth();
      if (res && res.status) {
        this.healthData = res;
        this.uptimeSeconds = Number(res.uptime_seconds) || 0;
        this.lastFetchedTime = Date.now();
        store.update({ health: res });
        this.updateDOM();
      } else {
        this.renderError('Unable to reach /api/health endpoint');
      }
    } catch (err) {
      console.error('[StatusCard] Error fetching health:', err);
      this.renderError(err.message || 'Health probe failed');
    } finally {
      this.isFetching = false;
      this.setRefreshButtonState(false);
    }
  }

  startTicker() {
    this.stopTicker();
    this.tickerTimer = setInterval(() => {
      this.uptimeSeconds += 1;
      this.updateUptimeOnly();
    }, 1000);
  }

  stopTicker() {
    if (this.tickerTimer) {
      clearInterval(this.tickerTimer);
      this.tickerTimer = null;
    }
  }

  startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      // Only fetch if container is still connected in DOM
      if (document.body.contains(this.container)) {
        void this.fetchHealth();
      } else {
        this.destroy();
      }
    }, this.options.refreshInterval);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  destroy() {
    this.stopPolling();
    this.stopTicker();
    if (this.container && this.container._statusCardInstance === this) {
      delete this.container._statusCardInstance;
    }
  }

  renderInitialSkeleton() {
    this.container.innerHTML = `
      <div class="card status-card-component" id="${this.id}">
        <div class="card-header">
          <div class="card-title">
            <span class="icon" style="color: var(--color-primary);">${getIcon('activity')}</span>
            <span>Server Health & Runtime Diagnostics</span>
          </div>
          <div class="status-pill offline" id="${this.id}-badge">
            <span class="status-dot"></span>
            <span>Probing Health...</span>
          </div>
        </div>
        <div style="padding: 1rem 0; text-align: center; color: var(--text-muted); font-size: 0.8125rem;">
          Connecting to bot health telemetry API...
        </div>
      </div>
    `;
  }

  updateDOM() {
    if (!this.healthData) return;
    const data = this.healthData;
    const isUp = data.status === 'UP' && data.bot_ready;
    const state = (data.state || 'UNKNOWN').toUpperCase();
    const isOnline = state === 'ONLINE';

    const cardEl = this.container.querySelector(`#${this.id}`);
    if (!cardEl) {
      this.renderFull();
      return;
    }

    // Update Badge
    const badge = cardEl.querySelector(`#${this.id}-badge`);
    if (badge) {
      badge.className = `status-pill ${isUp ? 'online' : 'offline'}`;
      badge.innerHTML = `
        <span class="status-dot"></span>
        <span>${data.status} • ${isUp ? 'OPERATIONAL' : 'DEGRADED'}</span>
      `;
    }

    // Update Metric Values
    const uptimeEl = cardEl.querySelector(`#${this.id}-uptime`);
    if (uptimeEl) uptimeEl.textContent = this.formatUptime(this.uptimeSeconds);

    const stateEl = cardEl.querySelector(`#${this.id}-state`);
    if (stateEl) {
      stateEl.textContent = state;
      stateEl.style.color = isOnline ? 'var(--color-online-text)' : 'var(--text-secondary)';
    }

    const botPingEl = cardEl.querySelector(`#${this.id}-ping`);
    if (botPingEl) {
      botPingEl.textContent = data.discord_latency_ms !== null && data.discord_latency_ms !== undefined
        ? `${data.discord_latency_ms}ms`
        : '--';
    }

    const memoryEl = cardEl.querySelector(`#${this.id}-memory`);
    if (memoryEl) {
      memoryEl.textContent = data.memory_mb ? `${data.memory_mb} MB` : '--';
    }

    const botReadyEl = cardEl.querySelector(`#${this.id}-ready`);
    if (botReadyEl) {
      botReadyEl.textContent = data.bot_ready ? 'Online & Listening' : 'Offline';
      botReadyEl.style.color = data.bot_ready ? 'var(--color-online-text)' : 'var(--color-danger-text)';
    }

    const probeTimeEl = cardEl.querySelector(`#${this.id}-probe-time`);
    if (probeTimeEl) {
      probeTimeEl.textContent = 'Just now';
    }
  }

  updateUptimeOnly() {
    const uptimeEl = this.container.querySelector(`#${this.id}-uptime`);
    if (uptimeEl) {
      uptimeEl.textContent = this.formatUptime(this.uptimeSeconds);
    }
  }

  renderFull() {
    const data = this.healthData || {};
    const isUp = data.status === 'UP' && data.bot_ready;
    const state = (data.state || 'UNKNOWN').toUpperCase();
    const isOnline = state === 'ONLINE';

    this.container.innerHTML = `
      <div class="card status-card-component" id="${this.id}">
        <div class="card-header" style="padding-bottom: 0.85rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div class="stat-icon-wrapper" style="width: 2.25rem; height: 2.25rem; background: var(--bg-surface-elevated); color: ${isUp ? 'var(--color-online)' : 'var(--color-starting)'};">
              ${getIcon('activity')}
            </div>
            <div>
              <div class="card-title" style="margin-bottom: 0.15rem;">
                <span>Server Health & Runtime Diagnostics</span>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">
                Live metrics from <span style="font-family: var(--font-mono); color: var(--text-secondary);">/api/health</span> probe
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div class="status-pill ${isUp ? 'online' : 'offline'}" id="${this.id}-badge">
              <span class="status-dot"></span>
              <span>${data.status || 'UP'} • ${isUp ? 'OPERATIONAL' : 'STANDBY'}</span>
            </div>

            <button class="btn btn-secondary" id="${this.id}-refresh-btn" title="Trigger instant health probe" style="padding: 0.35rem 0.65rem; font-size: 0.75rem;">
              <span class="icon">${getIcon('refreshCw')}</span>
              <span>Probe</span>
            </button>
          </div>
        </div>

        <!-- Health Diagnostic Grid -->
        <div class="health-metrics-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.875rem; margin-top: 0.25rem;">
          
          <div class="health-metric-tile" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
              <span style="font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 600;">Process Uptime</span>
              <span class="icon" style="color: var(--color-online);">${getIcon('clock')}</span>
            </div>
            <div id="${this.id}-uptime" style="font-family: var(--font-mono); font-size: 1.125rem; font-weight: 700; color: var(--text-primary);">
              ${this.formatUptime(this.uptimeSeconds)}
            </div>
            <div style="font-size: 0.6875rem; color: var(--text-muted); margin-top: 0.25rem;">Live ticking continuous counter</div>
          </div>

          <div class="health-metric-tile" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
              <span style="font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 600;">Server Lifecycle</span>
              <span class="icon" style="color: var(--color-primary);">${getIcon('server')}</span>
            </div>
            <div id="${this.id}-state" style="font-size: 1.125rem; font-weight: 700; color: ${isOnline ? 'var(--color-online-text)' : 'var(--text-secondary)'};">
              ${escapeHtml(state)}
            </div>
            <div style="font-size: 0.6875rem; color: var(--text-muted); margin-top: 0.25rem;">Aternos monitored state</div>
          </div>

          <div class="health-metric-tile" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
              <span style="font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 600;">Discord Gateway</span>
              <span class="icon" style="color: var(--color-purple);">${getIcon('zap')}</span>
            </div>
            <div id="${this.id}-ready" style="font-size: 1rem; font-weight: 700; color: ${data.bot_ready ? 'var(--color-online-text)' : 'var(--color-danger-text)'};">
              ${data.bot_ready ? 'Ready & Connected' : 'Offline'}
            </div>
            <div style="font-size: 0.6875rem; color: var(--text-muted); margin-top: 0.25rem;">
              Latency: <span id="${this.id}-ping" style="font-family: var(--font-mono); font-weight: 600; color: var(--text-secondary);">${data.discord_latency_ms ? `${data.discord_latency_ms}ms` : '--'}</span>
            </div>
          </div>

          <div class="health-metric-tile" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
              <span style="font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 600;">Memory Footprint</span>
              <span class="icon" style="color: var(--color-info);">${getIcon('cpu')}</span>
            </div>
            <div id="${this.id}-memory" style="font-family: var(--font-mono); font-size: 1.125rem; font-weight: 700; color: var(--text-primary);">
              ${data.memory_mb ? `${data.memory_mb} MB` : '--'}
            </div>
            <div style="font-size: 0.6875rem; color: var(--text-muted); margin-top: 0.25rem;">Container RSS allocation</div>
          </div>

        </div>

        <!-- Probe Status Footer -->
        <div style="border-top: 1px solid var(--border-subtle); padding-top: 0.75rem; display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); flex-wrap: wrap; gap: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="display: inline-block; width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--color-online);"></span>
            <span>Uptime Monitor API: <code style="font-family: var(--font-mono); color: var(--color-primary-text);">/api/health</code> (HTTP 200 OK)</span>
          </div>
          <div>
            Last probe: <span id="${this.id}-probe-time" style="color: var(--text-secondary); font-weight: 500;">Just now</span>
          </div>
        </div>
      </div>
    `;

    // Attach refresh handler
    this.container.querySelector(`#${this.id}-refresh-btn`)?.addEventListener('click', () => {
      void this.fetchHealth();
    });
  }

  renderError(msg) {
    const cardEl = this.container.querySelector(`#${this.id}`);
    if (badgeEl(cardEl)) {
      const badge = cardEl.querySelector(`#${this.id}-badge`);
      badge.className = 'status-pill offline';
      badge.innerHTML = `<span class="status-dot"></span><span>PROBE ERROR</span>`;
    }
  }

  setRefreshButtonState(loading) {
    const btn = this.container.querySelector(`#${this.id}-refresh-btn`);
    if (!btn) return;
    const icon = btn.querySelector('.icon');
    if (loading) {
      btn.disabled = true;
      if (icon) icon.style.animation = 'spin 1s linear infinite';
    } else {
      btn.disabled = false;
      if (icon) icon.style.animation = '';
    }
  }

  formatUptime(seconds) {
    if (!seconds || seconds <= 0) return '0s';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0 || d > 0) parts.push(`${h}h`);
    if (m > 0 || h > 0 || d > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  }
}

function badgeEl(el) {
  return el && el.querySelector('.status-pill');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Reusable Factory function to mount or update a StatusCard on any container
 * @param {HTMLElement} container
 * @param {Object} [options]
 * @returns {StatusCard}
 */
export function renderStatusCard(container, options = {}) {
  if (!container) return null;

  if (container._statusCardInstance) {
    container._statusCardInstance.updateDOM();
    return container._statusCardInstance;
  }

  const card = new StatusCard(container, options);
  container._statusCardInstance = card;
  void card.init();
  return card;
}
