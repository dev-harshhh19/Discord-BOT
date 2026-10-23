import { getIcon } from '../icons.js';
import { store } from '../state.js';
import { api } from '../api.js';
import { showToast } from './toast.js';

/**
 * Modern Clean SaaS Overview & Server Dashboard
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
  const playersMax = server.players?.max ?? 20;
  const playerList = server.players?.list || [];

  // Check if already mounted
  const existingCard = container.querySelector('#hero-server-control-card');
  if (existingCard) {
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
    <!-- 1. Hero Server Control Card -->
    <div class="server-hero-card" id="hero-server-control-card">
      <div class="server-hero-top">
        <div class="server-identity">
          <div class="server-headline-row">
            <img class="brand-img" src="${escapeHtml(bot.user?.avatar || '/img/logo.svg')}" alt="Server Icon" onerror="this.src='/img/logo.svg'" style="width: 2.25rem; height: 2.25rem; border-radius: var(--radius-sm);" />
            <h1 class="server-headline">${escapeHtml(server.name || 'Minecraft Server')}</h1>
            <div class="status-pill ${serverState.toLowerCase()}" id="overview-hero-status-pill">
              <span class="status-dot"></span>
              <span id="overview-hero-status-text">${escapeHtml(serverState)}</span>
            </div>
          </div>
          <div class="server-subtext" id="overview-hero-subtext">
            ${server.uptimeFormatted ? `Online for ${server.uptimeFormatted}` : isStarting ? 'Server launch in progress...' : 'Server is currently powered off'}
          </div>
        </div>

        <!-- Address Bar with 1-Click Copy -->
        <div class="address-box">
          <span class="address-label">IP:</span>
          <span class="address-text" id="overview-server-addr">${escapeHtml(fullAddress)}</span>
          <button class="btn-copy" id="overview-copy-addr-btn" title="Click to copy server IP:Port">
            <span class="icon">${getIcon('copy')}</span>
            <span class="copy-label">Copy IP</span>
          </button>
        </div>
      </div>

      <!-- Guest Notice Banner if not logged in -->
      ${
        !isAdmin
          ? `
        <div style="background-color: var(--color-primary-surface); border: 1px solid var(--color-primary-border); border-radius: var(--radius-md); padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.6rem; font-size: 0.8125rem; color: var(--color-primary-text); font-weight: 500;">
            <span class="icon">${getIcon('shield')}</span>
            <span>You are viewing in read-only mode. Enter the admin password to start, stop, or restart the server.</span>
          </div>
          <button class="btn btn-secondary btn-sm" id="hero-unlock-admin-btn" style="border-color: var(--color-primary-border); color: var(--color-primary);">
            <span class="icon">${getIcon('key')}</span>
            <span>Admin Login</span>
          </button>
        </div>
      `
          : ''
      }

      <!-- Power Management Actions -->
      <div class="control-actions-row">
        <button class="btn btn-primary" id="overview-start-btn" ${!isAdmin || isOnline || isStarting ? 'disabled' : ''}>
          <span class="icon">${getIcon('play')}</span>
          <span class="btn-label">Start Server</span>
        </button>

        <button class="btn btn-danger" id="overview-stop-btn" ${!isAdmin || !isOnline ? 'disabled' : ''}>
          <span class="icon">${getIcon('square')}</span>
          <span class="btn-label">Stop Server</span>
        </button>

        <button class="btn btn-secondary" id="overview-restart-btn" ${!isAdmin || isStarting ? 'disabled' : ''}>
          <span class="icon">${getIcon('rotateCw')}</span>
          <span class="btn-label">Restart Server</span>
        </button>

        <div style="flex-grow: 1;"></div>

        <button class="btn btn-secondary" id="overview-refresh-btn" title="Force refresh server status">
          <span class="icon">${getIcon('refreshCw')}</span>
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- 2. Metrics 4-Column Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon-wrapper">
          ${getIcon('server')}
        </div>
        <div class="stat-content">
          <div class="stat-label">Server State</div>
          <div class="stat-value" id="overview-stat-state" style="color: ${
            isOnline ? 'var(--color-online-text)' : isStarting ? 'var(--color-starting-text)' : 'var(--text-muted)'
          };">
            ${escapeHtml(serverState)}
          </div>
          <div class="stat-subtext" id="overview-stat-state-sub">
            ${server.uptimeFormatted ? `Uptime: ${server.uptimeFormatted}` : 'Standby'}
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper">
          ${getIcon('users')}
        </div>
        <div class="stat-content">
          <div class="stat-label">Online Players</div>
          <div class="stat-value" id="overview-stat-players">
            ${playersOnline} <span style="font-size: 0.875rem; color: var(--text-dim); font-weight: 500;">/ ${playersMax}</span>
          </div>
          <div class="stat-subtext" id="overview-stat-players-sub">
            ${playersOnline > 0 ? `${playersOnline} active in realm` : 'No players currently online'}
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper">
          ${getIcon('activity')}
        </div>
        <div class="stat-content">
          <div class="stat-label">Network Latency</div>
          <div class="stat-value" id="overview-stat-latency">
            ${server.latency !== null && server.latency !== undefined ? `${server.latency}ms` : '--'}
          </div>
          <div class="stat-subtext" id="overview-stat-latency-sub">
            Bot Gateway Ping: ${bot.ping ?? '--'}ms
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrapper">
          ${getIcon('cpu')}
        </div>
        <div class="stat-content">
          <div class="stat-label">Host Memory (RAM)</div>
          <div class="stat-value" id="overview-stat-ram">
            ${bot.memory?.rssMB ? `${bot.memory.rssMB} MB` : '--'}
          </div>
          <div class="stat-subtext" id="overview-stat-ram-sub">
            Node Heap: ${bot.memory?.heapUsedMB ?? '--'} MB
          </div>
        </div>
      </div>
    </div>

    <!-- 3. Server Specs & Live Players Section -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem;">
      <!-- Server Details Card -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span class="icon">${getIcon('globe')}</span>
            <span>Server Configuration</span>
          </div>
          <span class="badge ${isOnline ? 'admin' : 'everyone'}">${escapeHtml(server.software || 'Paper / Purpur')}</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.5rem;">
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Software</div>
            <div style="font-size: 0.9375rem; font-weight: 700; color: var(--text-primary); margin-top: 0.2rem;" id="overview-spec-software">
              ${escapeHtml(server.software || 'Paper / Purpur')}
            </div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Minecraft Version</div>
            <div style="font-size: 0.9375rem; font-weight: 700; color: var(--text-primary); margin-top: 0.2rem;" id="overview-spec-version">
              ${escapeHtml(server.version || '1.21.4')}
            </div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">RAM Allocation</div>
            <div style="font-size: 0.9375rem; font-weight: 700; color: var(--text-primary); margin-top: 0.2rem;" id="overview-spec-ram">
              ${escapeHtml(server.ram || 'Aternos Standard')}
            </div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Discord Bot Status</div>
            <div style="font-size: 0.9375rem; font-weight: 700; color: var(--color-online-text); margin-top: 0.2rem;" id="overview-spec-bot">
              ${bot.ready ? 'Connected' : 'Connecting...'}
            </div>
          </div>
        </div>

        <div style="margin-top: 1.25rem; padding-top: 0.85rem; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted);">
          <span>Process Uptime: ${formatSeconds(bot.processUptimeSeconds || 0)}</span>
          <span>Node.js ${bot.nodeVersion || 'v20'}</span>
        </div>
      </div>

      <!-- Live Players Card -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span class="icon">${getIcon('users')}</span>
            <span>Online Realm Players</span>
          </div>
          <span class="badge ${playersOnline > 0 ? 'admin' : 'everyone'}" id="overview-players-badge">
            ${playersOnline} / ${playersMax} Online
          </span>
        </div>

        <div id="overview-players-list-mount">
          ${renderPlayerListHTML(playerList, isOnline)}
        </div>
      </div>
    </div>
  `;

  // Attach Event Handlers
  attachOverviewEvents(container, fullAddress);
}

function renderPlayerListHTML(playerList, isOnline) {
  if (playerList.length > 0) {
    return `
      <div class="players-roster-grid">
        ${playerList
          .map((p) => {
            const playerName = typeof p === 'string' ? p : p.name;
            return `
            <div class="player-card">
              <img
                src="https://mc-heads.net/avatar/${encodeURIComponent(playerName)}/48"
                alt="${escapeHtml(playerName)}"
                class="player-avatar"
                onerror="this.src='https://mc-heads.net/avatar/steve/48';"
              />
              <div class="player-info">
                <div class="player-name">${escapeHtml(playerName)}</div>
                <div class="player-tag">Active Now</div>
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    `;
  }

  return `
    <div class="empty-players">
      ${getIcon('users')}
      <div style="font-weight: 600; color: var(--text-secondary); margin-top: 0.25rem;">
        ${isOnline ? 'No players currently connected' : 'Server is powered off'}
      </div>
      <div style="font-size: 0.75rem; color: var(--text-muted); max-width: 240px; text-align: center;">
        ${isOnline ? 'Share the server address with friends to start playing together!' : 'Power on the server to allow players to connect.'}
      </div>
    </div>
  `;
}

function attachOverviewEvents(container, fullAddress) {
  // Copy IP Address
  const copyBtn = container.querySelector('#overview-copy-addr-btn');
  copyBtn?.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(fullAddress);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = fullAddress;
        textArea.style.position = 'absolute';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      showToast('Server address copied to clipboard!', 'success');
      const label = copyBtn.querySelector('.copy-label');
      if (label) {
        const originalText = label.textContent;
        label.textContent = 'Copied!';
        setTimeout(() => {
          label.textContent = originalText;
        }, 2000);
      }
    } catch {
      showToast('Address: ' + fullAddress, 'info');
    }
  });

  // Admin login banner button
  container.querySelector('#hero-unlock-admin-btn')?.addEventListener('click', () => {
    store.setCurrentTab('login');
  });

  // Start Server
  const startBtn = container.querySelector('#overview-start-btn');
  startBtn?.addEventListener('click', () => {
    handleServerAction('Start Server', startBtn, api.startServer);
  });

  // Stop Server
  const stopBtn = container.querySelector('#overview-stop-btn');
  stopBtn?.addEventListener('click', () => {
    handleServerAction('Stop Server', stopBtn, api.stopServer);
  });

  // Restart Server
  const restartBtn = container.querySelector('#overview-restart-btn');
  restartBtn?.addEventListener('click', () => {
    handleServerAction('Restart Server', restartBtn, api.restartServer);
  });

  // Force Refresh
  const refreshBtn = container.querySelector('#overview-refresh-btn');
  refreshBtn?.addEventListener('click', async () => {
    const icon = refreshBtn.querySelector('.icon');
    if (icon) icon.classList.add('spin');
    refreshBtn.disabled = true;

    try {
      const res = await api.getStatus();
      if (res.success) {
        store.update({ status: res });
        showToast('Server status refreshed.', 'success');
      } else {
        showToast('Failed to refresh status.', 'error');
      }
    } catch (err) {
      showToast('Error refreshing status: ' + err.message, 'error');
    } finally {
      if (icon) icon.classList.remove('spin');
      refreshBtn.disabled = false;
    }
  });
}

async function handleServerAction(actionName, btn, apiFn) {
  if (btn) {
    btn.disabled = true;
    const icon = btn.querySelector('.icon');
    if (icon) icon.classList.add('spin');
  }

  showToast(`Initiating ${actionName}...`, 'info');
  try {
    const res = await apiFn();
    if (res.success) {
      showToast(res.message || `${actionName} command accepted.`, 'success');
      const statusRes = await api.getStatus();
      if (statusRes.success) {
        store.update({ status: statusRes });
      }
    } else if (!res.rateLimited) {
      showToast(res.error || `Failed to execute ${actionName}.`, 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    if (btn) {
      const icon = btn.querySelector('.icon');
      if (icon) icon.classList.remove('spin');
      btn.disabled = false;
    }
  }
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
    playerList,
    fullAddress,
  } = data;

  const statusPill = container.querySelector('#overview-hero-status-pill');
  if (statusPill) {
    statusPill.className = `status-pill ${serverState.toLowerCase()}`;
    const txt = container.querySelector('#overview-hero-status-text');
    if (txt) txt.textContent = serverState;
  }

  const subtext = container.querySelector('#overview-hero-subtext');
  if (subtext) {
    subtext.textContent = server.uptimeFormatted
      ? `Online for ${server.uptimeFormatted}`
      : isStarting
      ? 'Server launch in progress...'
      : 'Server is currently powered off';
  }

  const addrText = container.querySelector('#overview-server-addr');
  if (addrText) addrText.textContent = fullAddress;

  const stateVal = container.querySelector('#overview-stat-state');
  if (stateVal) {
    stateVal.textContent = serverState;
    stateVal.style.color = isOnline
      ? 'var(--color-online-text)'
      : isStarting
      ? 'var(--color-starting-text)'
      : 'var(--text-muted)';
  }

  const stateSub = container.querySelector('#overview-stat-state-sub');
  if (stateSub) {
    stateSub.textContent = server.uptimeFormatted ? `Uptime: ${server.uptimeFormatted}` : 'Standby';
  }

  const playersVal = container.querySelector('#overview-stat-players');
  if (playersVal) {
    playersVal.innerHTML = `${playersOnline} <span style="font-size: 0.875rem; color: var(--text-dim); font-weight: 500;">/ ${playersMax}</span>`;
  }

  const playersSub = container.querySelector('#overview-stat-players-sub');
  if (playersSub) {
    playersSub.textContent = playersOnline > 0 ? `${playersOnline} active in realm` : 'No players currently online';
  }

  const latencyVal = container.querySelector('#overview-stat-latency');
  if (latencyVal) {
    latencyVal.textContent = server.latency !== null && server.latency !== undefined ? `${server.latency}ms` : '--';
  }

  const latencySub = container.querySelector('#overview-stat-latency-sub');
  if (latencySub) {
    latencySub.textContent = `Bot Gateway Ping: ${bot.ping ?? '--'}ms`;
  }

  const ramVal = container.querySelector('#overview-stat-ram');
  if (ramVal) {
    ramVal.textContent = bot.memory?.rssMB ? `${bot.memory.rssMB} MB` : '--';
  }

  const ramSub = container.querySelector('#overview-stat-ram-sub');
  if (ramSub) {
    ramSub.textContent = `Node Heap: ${bot.memory?.heapUsedMB ?? '--'} MB`;
  }

  const startBtn = container.querySelector('#overview-start-btn');
  if (startBtn) startBtn.disabled = !isAdmin || isOnline || isStarting;

  const stopBtn = container.querySelector('#overview-stop-btn');
  if (stopBtn) stopBtn.disabled = !isAdmin || !isOnline;

  const restartBtn = container.querySelector('#overview-restart-btn');
  if (restartBtn) restartBtn.disabled = !isAdmin || isStarting;

  const playersMount = container.querySelector('#overview-players-list-mount');
  if (playersMount) {
    playersMount.innerHTML = renderPlayerListHTML(playerList, isOnline);
  }

  const playersBadge = container.querySelector('#overview-players-badge');
  if (playersBadge) {
    playersBadge.className = `badge ${playersOnline > 0 ? 'admin' : 'everyone'}`;
    playersBadge.textContent = `${playersOnline} / ${playersMax} Online`;
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
