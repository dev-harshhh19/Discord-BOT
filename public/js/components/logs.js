import { getIcon } from '../icons.js';
import { store } from '../state.js';
import { api } from '../api.js';
import { showToast } from './toast.js';

/**
 * Live Console & System Logs Component
 */

let selectedLogLevel = 'ALL';

export function renderLogs(container) {
  const state = store.getState();
  const isAdmin = state.isAdmin;
  const logs = state.logs || [];

  if (!isAdmin) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 3rem 1.5rem; align-items: center;">
        <div style="width: 3.5rem; height: 3.5rem; border-radius: var(--radius-xl); background-color: var(--bg-surface-elevated); border: 1px solid var(--border-strong); display: flex; align-items: center; justify-content: center; color: var(--color-starting-text); margin-bottom: 0.5rem;">
          ${getIcon('lock')}
        </div>
        <h2 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">Admin Access Required</h2>
        <p style="max-width: 440px; margin-bottom: 1.5rem;">
          Real-time server console output and system telemetry logs are protected for security.
        </p>
        <button class="btn btn-primary" id="logs-unlock-btn">
          <span class="icon">${getIcon('key')}</span>
          <span>Unlock Admin with Password</span>
        </button>
      </div>
    `;

    container.querySelector('#logs-unlock-btn')?.addEventListener('click', () => {
      store.setCurrentTab('login');
    });
    return;
  }

  const filteredLogs = logs.filter((log) => {
    if (selectedLogLevel === 'ALL') return true;
    return log.level?.toUpperCase() === selectedLogLevel;
  });

  container.innerHTML = `
    <div class="card" style="padding: 0; overflow: hidden;">
      <div class="terminal-bar">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span class="icon" style="color: var(--text-muted);">${getIcon('terminal')}</span>
          <span class="terminal-title">system.log &bull; ${filteredLogs.length} entries</span>
        </div>

        <div class="terminal-actions">
          <select id="log-filter-select" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
            <option value="ALL" ${selectedLogLevel === 'ALL' ? 'selected' : ''}>All Levels</option>
            <option value="INFO" ${selectedLogLevel === 'INFO' ? 'selected' : ''}>INFO</option>
            <option value="WARN" ${selectedLogLevel === 'WARN' ? 'selected' : ''}>WARN</option>
            <option value="ERROR" ${selectedLogLevel === 'ERROR' ? 'selected' : ''}>ERROR</option>
            <option value="DEBUG" ${selectedLogLevel === 'DEBUG' ? 'selected' : ''}>DEBUG</option>
          </select>

          <button class="btn btn-secondary" id="refresh-logs-btn" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">
            <span class="icon">${getIcon('refreshCw')}</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div class="terminal-window" style="border: none; border-radius: 0;">
        <div class="terminal-body" id="terminal-body">
          ${
            filteredLogs.length > 0
              ? filteredLogs
                  .map((log) => {
                    const lvl = (log.level || 'info').toLowerCase();
                    const time = log.timestamp ? formatLogTime(log.timestamp) : '--:--:--';
                    return `
                <div class="log-entry">
                  <span class="log-time">[${escapeHtml(time)}]</span>
                  <span class="log-level ${lvl}">[${escapeHtml(log.level || 'INFO')}]</span>
                  <span class="log-msg">${escapeHtml(log.message)}</span>
                </div>
              `;
                  })
                  .join('')
              : '<div style="color: var(--text-dim); text-align: center; padding: 2rem;">No log entries to display.</div>'
          }
        </div>
      </div>
    </div>
  `;

  // Autoscroll to bottom
  const terminalBody = container.querySelector('#terminal-body');
  if (terminalBody && state.autoScrollLogs) {
    terminalBody.scrollTop = terminalBody.scrollHeight;
  }

  // Filter change
  const filterSelect = container.querySelector('#log-filter-select');
  filterSelect?.addEventListener('change', (e) => {
    selectedLogLevel = e.target.value;
    renderLogs(container);
  });

  // Refresh logs button
  const refreshBtn = container.querySelector('#refresh-logs-btn');
  refreshBtn?.addEventListener('click', async () => {
    const res = await api.getLogs(150);
    if (res.success && res.logs) {
      store.update({ logs: res.logs });
      showToast('Logs refreshed.', 'info');
    }
  });
}

function formatLogTime(iso) {
  try {
    const d = new Date(iso);
    return d.toTimeString().split(' ')[0] || iso;
  } catch {
    return iso;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
