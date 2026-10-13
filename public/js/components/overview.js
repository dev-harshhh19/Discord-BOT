import { getIcon } from '../icons.js';
import { store } from '../state.js';
import { api } from '../api.js';
import { showToast } from './toast.js';
import { renderStatusCard } from './statusCard.js';
import { renderLatencyChart } from './latencyChart.js';

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

  // Check if already mounted
  const existingMount = container.querySelector('#overview-status-card-mount');
  if (existingMount) {
    updateOverviewDOM(container, {
      server,
      bot,
      isAdmin,
      serverState,
      isOnline,
      isStarting,
      isStopping,
      playersOnline,
      playersMax,
      playerList,
      fullAddress,
    });
    return;
  }

  container.innerHTML = `
    <!-- Reusable Health & Uptime Status Card Component -->
    <div id="overview-status-card-mount"></div>

    <!-- Real-time D3 Latency & Ping Chart Component -->
    <div id="overview-latency-chart-mount"></div>

    <!-- Top Metrics Row -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon-wrapper">
          ${getIcon('server')}
        </div>
        <div class="stat-content">
          <div class="stat-label">Server State</div>
          <div class="stat-value" id="overview-stat-server-state" style="color: ${isOnline ? 'var(--color-online-text)'
      : isStarting ? 'var(--color-starting-text)'
        : isStopping ? 'var(--color-danger-text)'
          : 'var(--text-muted)'
    };">
            ${escapeHtml(serverState)}
          </div>
          <div class="stat-subtext" id="overview-stat-server-subtext">${server.uptimeFormatted ? `Online for ${server.uptimeFormatted}` : 'Currently offline'}</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper">
          ${getIcon('users')}
        </div>
        <div class="stat-content">
          <div class="stat-label">Players Online</div>
          <div class="stat-value" id="overview-stat-players">${playersOnline} <span style="font-size: 0.875rem; color: var(--text-dim); font-weight: 500;">/ ${playersMax}</span></div>
          <div class="stat-subtext" id="overview-stat-players-subtext">${playersOnline > 0 ? `${playersOnline} active in realm` : 'No players currently online'}</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper">
          ${getIcon('activity')}
        </div>
        <div class="stat-content">
          <div class="stat-label">Network Latency</div>
          <div class="stat-value" id="overview-stat-latency">${server.latency !== null && server.latency !== undefined ? `${server.latency}ms` : '--'}</div>
          <div class="stat-subtext" id="overview-stat-latency-subtext">Bot Gateway Ping: ${bot.ping ?? '--'}ms</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper">
          ${getIcon('cpu')}
        </div>
        <div class="stat-content">
          <div class="stat-label">Bot Process Uptime</div>
          <div class="stat-value" id="overview-stat-uptime">${formatSeconds(bot.processUptimeSeconds || 0)}</div>
          <div class="stat-subtext" id="overview-stat-uptime-subtext">RSS: ${bot.memory?.rssMB ?? '--'} MB | Heap: ${bot.memory?.heapUsedMB ?? '--'} MB</div>
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

    <!-- 24/7 Keep-Alive & Health API Strip -->
    <div class="card" style="margin-top: 1.25rem;">
      <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div class="stat-icon-wrapper" style="width: 2.25rem; height: 2.25rem; background: var(--bg-surface-elevated); color: var(--color-online);">
            ${getIcon('radio')}
          </div>
          <div>
            <div class="card-title" style="margin-bottom: 0.15rem;">
              <span>24/7 Keep-Alive &amp; Health Probe Engine</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">
              Automated in-process self-ping &amp; external webhook monitoring keeps the service awake 24/7
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
          <div class="status-pill online">
            <span class="status-dot"></span>
            <span>24/7 ACTIVE</span>
          </div>
          <button class="btn btn-secondary" id="overview-ka-btn" type="button" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;">
            <span class="icon">${getIcon('externalLink')}</span>
            <span>Keep-Alive Hub</span>
          </button>
        </div>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 0.75rem 1rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8125rem;">
          <span style="color: var(--text-muted);">Health Endpoint:</span>
          <code style="font-family: var(--font-mono); color: var(--color-primary-text);">${window.location.origin}/api/health</code>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <button class="btn btn-secondary" id="overview-copy-health-btn" style="padding: 0.25rem 0.55rem; font-size: 0.75rem;">
            <span class="icon">${getIcon('copy')}</span>
            <span>Copy</span>
          </button>
          <button class="btn btn-primary" id="overview-test-ping-btn" style="padding: 0.25rem 0.65rem; font-size: 0.75rem;">
            <span class="icon">${getIcon('activity')}</span>
            <span>Test Ping</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // Attach Event Handlers
  container.querySelector('#overview-ka-btn')?.addEventListener('click', () => {
    store.setCurrentTab('keepalive');
  });

  container.querySelector('#overview-copy-health-btn')?.addEventListener('click', () => {
    const url = `${window.location.origin}/api/health`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => showToast('Health URL copied to clipboard!', 'success'));
    } else {
      showToast('Health URL: ' + url, 'info');
    }
  });

  container.querySelector('#overview-test-ping-btn')?.addEventListener('click', async () => {
    const btn = container.querySelector('#overview-test-ping-btn');
    if (btn) btn.disabled = true;
    try {
      const start = performance.now();
      const res = await api.triggerKeepAlivePing();
      const ms = Math.round(performance.now() - start);
      showToast(`Keep-Alive test ping successful (${ms}ms) - Status UP!`, 'success');
    } catch (err) {
      showToast('Probe failed: ' + err.message, 'danger');
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  container.querySelector('#banner-unlock-btn')?.addEventListener('click', () => {
    store.setCurrentTab('login');
  });

  // Copy server address button
  const copyBtn = container.querySelector('#copy-addr-btn');
  copyBtn?.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(fullAddress);
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = fullAddress;
        textArea.style.position = 'absolute';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (!successful) throw new Error('Copy command failed');
      }
      
      copyBtn.innerHTML = `<span class="icon">${getIcon('check')}</span><span>Copied!</span>`;
      setTimeout(() => {
        copyBtn.innerHTML = `<span class="icon">${getIcon('copy')}</span><span>Copy</span>`;
      }, 2000);
      showToast('Server address copied to clipboard.', 'success');
    } catch (err) {
      console.error('Copy failed:', err);
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

  // Mount Reusable Status Card Component (Store-driven updates with zero redundant network requests)
  const statusMount = container.querySelector('#overview-status-card-mount');
  if (statusMount) {
    renderStatusCard(statusMount, {
      autoRefresh: false,
      liveTicker: true,
    });
  }

  // Mount Real-Time D3 Latency Chart Component
  const chartMount = container.querySelector('#overview-latency-chart-mount');
  if (chartMount) {
    renderLatencyChart(chartMount);
  }
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

function updateOverviewDOM(container, data) {
  const {
    server,
    bot,
    isAdmin,
    serverState,
    isOnline,
    isStarting,
    isStopping,
    playersOnline,
    playersMax,
  } = data;

  const stateEl = container.querySelector('#overview-stat-server-state');
  if (stateEl) {
    stateEl.textContent = serverState;
    stateEl.style.color = isOnline
      ? 'var(--color-online-text)'
      : isStarting
      ? 'var(--color-starting-text)'
      : isStopping
      ? 'var(--color-danger-text)'
      : 'var(--text-muted)';
  }

  const serverSub = container.querySelector('#overview-stat-server-subtext');
  if (serverSub) {
    serverSub.textContent = server.uptimeFormatted
      ? `Online for ${server.uptimeFormatted}`
      : 'Currently offline';
  }

  const playersEl = container.querySelector('#overview-stat-players');
  if (playersEl) {
    playersEl.innerHTML = `${playersOnline} <span style="font-size: 0.875rem; color: var(--text-dim); font-weight: 500;">/ ${playersMax}</span>`;
  }
  const playersSub = container.querySelector('#overview-stat-players-subtext');
  if (playersSub) {
    playersSub.textContent = playersOnline > 0 ? `${playersOnline} active in realm` : 'No players currently online';
  }

  const latencyEl = container.querySelector('#overview-stat-latency');
  if (latencyEl) {
    latencyEl.textContent = server.latency !== null && server.latency !== undefined ? `${server.latency}ms` : '--';
  }
  const latencySub = container.querySelector('#overview-stat-latency-subtext');
  if (latencySub) {
    latencySub.textContent = `Bot Gateway Ping: ${bot.ping ?? '--'}ms`;
  }

  const uptimeEl = container.querySelector('#overview-stat-uptime');
  if (uptimeEl) {
    uptimeEl.textContent = formatSeconds(bot.processUptimeSeconds || 0);
  }
  const uptimeSub = container.querySelector('#overview-stat-uptime-subtext');
  if (uptimeSub) {
    uptimeSub.textContent = `RSS: ${bot.memory?.rssMB ?? '--'} MB | Heap: ${bot.memory?.heapUsedMB ?? '--'} MB`;
  }

  const startBtn = container.querySelector('#action-start-btn');
  if (startBtn) startBtn.disabled = !isAdmin || isOnline || isStarting;

  const stopBtn = container.querySelector('#action-stop-btn');
  if (stopBtn) stopBtn.disabled = !isAdmin || !isOnline;

  const restartBtn = container.querySelector('#action-restart-btn');
  if (restartBtn) restartBtn.disabled = !isAdmin || isStarting;

  const pollBtn = container.querySelector('#action-poll-btn');
  if (pollBtn) pollBtn.disabled = !isAdmin;

  const statusMount = container.querySelector('#overview-status-card-mount');
  if (statusMount) {
    renderStatusCard(statusMount);
  }

  const chartMount = container.querySelector('#overview-latency-chart-mount');
  if (chartMount) {
    renderLatencyChart(chartMount);
  }
}

