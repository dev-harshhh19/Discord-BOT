import { getIcon } from '../icons.js';
import { store } from '../state.js';
import { api } from '../api.js';
import { openAuthModal } from './authModal.js';
import { showToast } from './toast.js';

/**
 * Overview & Telemetry Dashboard View Component
 */

export function renderOverview(container) {
  const state = store.getState();
  const server = state.status?.server || {};
  const bot = state.status?.bot || {};
  const isAdmin = state.isAdmin;
  const serverState = (server.state || 'OFFLINE').toUpperCase();
  const isOnline = serverState === 'ONLINE';
  const isStarting = serverState === 'STARTING' || serverState === 'QUEUEING';
  const isStopping = serverState === 'STOPPING';
  const isOffline = serverState === 'OFFLINE' || serverState === 'CRASHED';

  const fullAddress = server.address ? `${server.address}${server.port ? `:${server.port}` : ''}` : 'TomMC-SMP.aternos.me';
  const playersOnline = server.players?.online ?? 0;
  const playersMax = server.players?.max ?? 0;
  const playerList = server.players?.list || [];

  container.innerHTML = `
    <!-- Top Metrics Row -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon-wrapper">
          ${getIcon('server')}
        </div>
        <div class="stat-content">
          <div class="stat-label">Server State</div>
          <div class="stat-value" style="color: ${isOnline ? 'var(--color-online-text)'
      : isStarting ? 'var(--color-starting-text)'
        : isStopping ? 'var(--color-danger-text)'
          : 'var(--text-muted)'
    };">
            ${escapeHtml(serverState)}
          </div>
          <div class="stat-subtext">${server.uptimeFormatted ? `Online for ${server.uptimeFormatted}` : 'Currently offline'}</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper">
          ${getIcon('users')}
        </div>
        <div class="stat-content">
          <div class="stat-label">Players Online</div>
          <div class="stat-value">${playersOnline} <span style="font-size: 0.875rem; color: var(--text-dim); font-weight: 500;">/ ${playersMax}</span></div>
          <div class="stat-subtext">${playersOnline > 0 ? `${playersOnline} active in realm` : 'No players currently online'}</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper">
          ${getIcon('activity')}
        </div>
        <div class="stat-content">
          <div class="stat-label">Network Latency</div>
          <div class="stat-value">${server.latency !== null && server.latency !== undefined ? `${server.latency}ms` : '--'}</div>
          <div class="stat-subtext">Bot Gateway Ping: ${bot.ping ?? '--'}ms</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper">
          ${getIcon('cpu')}
        </div>
        <div class="stat-content">
          <div class="stat-label">Bot Process Uptime</div>
          <div class="stat-value">${formatSeconds(bot.processUptimeSeconds || 0)}</div>
          <div class="stat-subtext">RSS: ${bot.memory?.rssMB ?? '--'} MB | Heap: ${bot.memory?.heapUsedMB ?? '--'} MB</div>
        </div>
      </div>
    </div>

    <!-- Quick Server Actions (Admin Protected) -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <span class="icon">${getIcon('zap')}</span>
          <span>Server Power & Management Actions</span>
        </div>
        ${!isAdmin
      ? `
          <div class="badge everyone">
            <span class="icon">${getIcon('lock')}</span>
            <span>Guest View (Read-Only)</span>
          </div>
        `
      : `
          <div class="badge admin">
            <span class="icon">${getIcon('unlock')}</span>
            <span>Admin Control Active</span>
          </div>
        `
    }
      </div>

      ${!isAdmin
      ? `
        <div class="notice-banner">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="icon" style="color: var(--color-starting-text);">${getIcon('info')}</span>
            <span>Server power operations (Start, Stop, Restart) are protected by admin password.</span>
          </div>
          <button class="btn btn-secondary" id="banner-unlock-btn" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;">
            <span class="icon">${getIcon('key')}</span>
            <span>Unlock Admin</span>
          </button>
        </div>
      `
      : ''
    }

      <div class="actions-bar">
        <button class="action-btn start" id="action-start-btn" ${!isAdmin || isOnline || isStarting ? 'disabled' : ''}>
          <span class="icon">${getIcon('play')}</span>
          <span>Start Server</span>
        </button>

        <button class="action-btn stop" id="action-stop-btn" ${!isAdmin || !isOnline ? 'disabled' : ''}>
          <span class="icon">${getIcon('square')}</span>
          <span>Stop Server</span>
        </button>

        <button class="action-btn restart" id="action-restart-btn" ${!isAdmin || isStarting ? 'disabled' : ''}>
          <span class="icon">${getIcon('rotateCw')}</span>
          <span>Restart Server</span>
        </button>

        <button class="action-btn poll" id="action-poll-btn" ${!isAdmin ? 'disabled' : ''}>
          <span class="icon">${getIcon('refreshCw')}</span>
          <span>Force Status Poll</span>
        </button>
      </div>
    </div>

    <!-- Connection Info Card & Players -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem;">
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span class="icon">${getIcon('globe')}</span>
            <span>Minecraft Server Connection</span>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.35rem;">Server Address (IP / Domain)</div>
            <div class="address-box">
              <span class="address-text" id="server-addr-text">${escapeHtml(fullAddress)}</span>
              <button class="copy-btn" id="copy-addr-btn" title="Copy server address to clipboard">
                <span class="icon">${getIcon('copy')}</span>
                <span>Copy</span>
              </button>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.5rem;">
            <div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Software</div>
              <div style="font-size: 0.875rem; font-weight: 600; color: var(--text-primary); margin-top: 0.2rem;">
                ${escapeHtml(server.software || 'Vanilla / Paper')}
              </div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Version</div>
              <div style="font-size: 0.875rem; font-weight: 600; color: var(--text-primary); margin-top: 0.2rem;">
                ${escapeHtml(server.version || '1.20+')}
              </div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Allocated RAM</div>
              <div style="font-size: 0.875rem; font-weight: 600; color: var(--text-primary); margin-top: 0.2rem;">
                ${escapeHtml(server.ram || 'Aternos Standard')}
              </div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Region</div>
              <div style="font-size: 0.875rem; font-weight: 600; color: var(--text-primary); margin-top: 0.2rem;">
                ${escapeHtml(server.region || 'Global / Europe')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Online Players or Diagnostics -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span class="icon">${getIcon('users')}</span>
            <span>Online Realm Players</span>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${playersOnline} connected</span>
        </div>

        ${playerList.length > 0
      ? `
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; max-height: 180px; overflow-y: auto;">
            ${playerList
        .map(
          (p) => `
              <div style="display: inline-flex; align-items: center; gap: 0.4rem; background-color: var(--bg-surface-elevated); border: 1px solid var(--border-default); padding: 0.35rem 0.65rem; border-radius: var(--radius-sm); font-size: 0.8125rem;">
                <span class="icon" style="color: var(--color-online);">${getIcon('user')}</span>
                <span>${escapeHtml(typeof p === 'string' ? p : p.name)}</span>
              </div>
            `,
        )
        .join('')}
          </div>
        `
      : `
          <div style="padding: 1.5rem 0; text-align: center; color: var(--text-dim); font-size: 0.8125rem;">
            ${isOnline ? 'No players currently connected to the server.' : 'Server is offline. Start the server to see online players.'}
          </div>
        `
    }

        <div style="border-top: 1px solid var(--border-subtle); padding-top: 0.75rem; margin-top: auto; display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted);">
          <span>Discord Bot: ${bot.ready ? 'Connected' : 'Connecting...'}</span>
          <span>Guilds: ${bot.guildsCount ?? 0}</span>
        </div>
      </div>
    </div>
  `;

  // Attach Event Handlers
  container.querySelector('#banner-unlock-btn')?.addEventListener('click', openAuthModal);

  // Copy server address button
  const copyBtn = container.querySelector('#copy-addr-btn');
  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(fullAddress);
      copyBtn.innerHTML = `<span class="icon">${getIcon('check')}</span><span>Copied!</span>`;
      setTimeout(() => {
        copyBtn.innerHTML = `<span class="icon">${getIcon('copy')}</span><span>Copy</span>`;
      }, 2000);
      showToast('Server address copied to clipboard.', 'success');
    } catch {
      showToast('Failed to copy address.', 'error');
    }
  });

  // Server Control Button Listeners
  container.querySelector('#action-start-btn')?.addEventListener('click', async () => {
    await handleServerAction('start', api.startServer);
  });

  container.querySelector('#action-stop-btn')?.addEventListener('click', async () => {
    await handleServerAction('stop', api.stopServer);
  });

  container.querySelector('#action-restart-btn')?.addEventListener('click', async () => {
    await handleServerAction('restart', api.restartServer);
  });

  container.querySelector('#action-poll-btn')?.addEventListener('click', async () => {
    await handleServerAction('poll', api.pollServer);
  });
}

async function handleServerAction(actionName, apiFn) {
  showToast(`Initiating ${actionName}...`, 'info');
  const res = await apiFn();
  if (res.success) {
    showToast(res.message || `${actionName} command accepted.`, 'success');
    // Refresh status
    const statusRes = await api.getStatus();
    if (statusRes.success) {
      store.update({ status: statusRes });
    }
  } else if (!res.rateLimited) {
    showToast(res.error || `Failed to execute ${actionName}.`, 'error');
  }
}

function formatSeconds(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
