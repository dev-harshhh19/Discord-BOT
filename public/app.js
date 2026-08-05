/**
 * ═════════════════════════════════════════════════════════════════════════════
 * TomMC-SMP BOT DASHBOARD — CLIENT SCRIPT (app.js)
 * ═════════════════════════════════════════════════════════════════════════════
 */

// ── Application State ────────────────────────────────────────────────────────
const state = {
  isAutoRefreshActive: true,
  refreshIntervalMs: 5000,
  refreshTimerId: null,
  activeTab: 'overview',
  botStartTime: null,
  botUptimeSeconds: 0,
  members: [],
  membersFilter: 'all',
  membersSearch: '',
  logs: [],
  logLevelFilter: 'all',
  logSearch: '',
  isAutoScrollEnabled: true,
  pendingAction: null,
  lastLogTimestamp: 0
};

// ── DOM Elements ─────────────────────────────────────────────────────────────
const elements = {
  // Live Header
  liveClock: document.getElementById('liveClock'),
  botName: document.getElementById('botName'),
  botTagBadge: document.getElementById('botTagBadge'),
  botStatusDot: document.getElementById('botStatusDot'),
  botAvatarIcon: document.getElementById('botAvatarIcon'),
  botAvatarWrapper: document.getElementById('botAvatarWrapper'),
  btnToggleRefresh: document.getElementById('btnToggleRefresh'),
  refreshPlayPauseIcon: document.getElementById('refreshPlayPauseIcon'),
  refreshTimerLabel: document.getElementById('refreshTimerLabel'),
  btnManualRefresh: document.getElementById('btnManualRefresh'),
  manualRefreshIcon: document.getElementById('manualRefreshIcon'),

  // KPIs
  serverStatePill: document.getElementById('serverStatePill'),
  serverStateDot: document.getElementById('serverStateDot'),
  serverStateText: document.getElementById('serverStateText'),
  serverAddressText: document.getElementById('serverAddressText'),
  btnCopyAddress: document.getElementById('btnCopyAddress'),
  serverLatencyText: document.getElementById('serverLatencyText'),
  serverSoftwareBadge: document.getElementById('serverSoftwareBadge'),

  botUptimeTicker: document.getElementById('botUptimeTicker'),
  mcUptimeText: document.getElementById('mcUptimeText'),
  uptimeStatusBadge: document.getElementById('uptimeStatusBadge'),

  mcPlayersCount: document.getElementById('mcPlayersCount'),
  discordMemberCount: document.getElementById('discordMemberCount'),
  guildNameText: document.getElementById('guildNameText'),
  channelsCountBadge: document.getElementById('channelsCountBadge'),

  wsPingText: document.getElementById('wsPingText'),
  ramUsageText: document.getElementById('ramUsageText'),
  nodeVersionText: document.getElementById('nodeVersionText'),
  platformText: document.getElementById('platformText'),
  overallHealthBadge: document.getElementById('overallHealthBadge'),

  // Overview Tab
  overviewStateBadge: document.getElementById('overviewStateBadge'),
  specHost: document.getElementById('specHost'),
  specPort: document.getElementById('specPort'),
  specSoftware: document.getElementById('specSoftware'),
  specVersion: document.getElementById('specVersion'),
  specRam: document.getElementById('specRam'),
  specRegion: document.getElementById('specRegion'),
  specOnlineSince: document.getElementById('specOnlineSince'),
  playersContainer: document.getElementById('playersContainer'),
  playerListCount: document.getElementById('playerListCount'),
  playerSlotsBadge: document.getElementById('playerSlotsBadge'),

  // Bot Diagnostics
  diagBotTag: document.getElementById('diagBotTag'),
  diagBotReady: document.getElementById('diagBotReady'),
  diagWsPing: document.getElementById('diagWsPing'),
  diagHeap: document.getElementById('diagHeap'),
  diagPlatform: document.getElementById('diagPlatform'),
  diagNode: document.getElementById('diagNode'),

  // Members Tab
  guildSubtitle: document.getElementById('guildSubtitle'),
  memberSearchInput: document.getElementById('memberSearchInput'),
  membersTableBody: document.getElementById('membersTableBody'),
  filterCountAll: document.getElementById('filterCountAll'),
  filterCountOwner: document.getElementById('filterCountOwner'),
  filterCountAdmin: document.getElementById('filterCountAdmin'),
  filterCountTrusted: document.getElementById('filterCountTrusted'),
  filterCountEveryone: document.getElementById('filterCountEveryone'),

  // Access Control Tab
  accessTiersContainer: document.getElementById('accessTiersContainer'),
  commandsTableBody: document.getElementById('commandsTableBody'),

  // Logs Tab
  terminalLogContainer: document.getElementById('terminalLogContainer'),
  logSearchInput: document.getElementById('logSearchInput'),
  autoScrollCheck: document.getElementById('autoScrollCheck'),
  btnCopyLogs: document.getElementById('btnCopyLogs'),
  btnClearLogsView: document.getElementById('btnClearLogsView'),

  // Modal
  actionModal: document.getElementById('actionModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalDescription: document.getElementById('modalDescription'),
  modalWarningBox: document.getElementById('modalWarningBox'),
  modalConfirmBtn: document.getElementById('modalConfirmBtn'),
  toastContainer: document.getElementById('toastContainer')
};

// ── Initialization ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initLiveClock();
  initTabs();
  initEventListeners();
  startUptimeLocalTicker();

  // Initial Data Fetch
  fetchAllData();

  // Start polling
  startAutoRefresh();
});

// ── Live IST / Local Clock ───────────────────────────────────────────────────
function initLiveClock() {
  const updateClock = () => {
    const now = new Date();
    // Format in IST (Indian Standard Time) and Local Time
    const istTimeStr = now.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    elements.liveClock.textContent = `${istTimeStr} IST`;
  };
  updateClock();
  setInterval(updateClock, 1000);
}

// ── Local Ticker for Bot Uptime ──────────────────────────────────────────────
function startUptimeLocalTicker() {
  setInterval(() => {
    if (state.botUptimeSeconds > 0) {
      state.botUptimeSeconds++;
      elements.botUptimeTicker.textContent = formatDuration(state.botUptimeSeconds);
    }
  }, 1000);
}

function formatDuration(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00:00';
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');

  if (d > 0) {
    return `${d}d ${hh}:${mm}:${ss}`;
  }
  return `${hh}:${mm}:${ss}`;
}

// ── Tab Management ───────────────────────────────────────────────────────────
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      state.activeTab = tabId;
      const targetPane = document.getElementById(`pane-${tabId}`);
      if (targetPane) targetPane.classList.add('active');

      // Fetch tab specific data on first tab switch
      if (tabId === 'members' && state.members.length === 0) fetchMembers();
      if (tabId === 'access') fetchAccessControl();
      if (tabId === 'logs') fetchLogs();
    });
  });
}

// ── Event Listeners ──────────────────────────────────────────────────────────
function initEventListeners() {
  // Auto refresh pause/resume
  elements.btnToggleRefresh.addEventListener('click', () => {
    state.isAutoRefreshActive = !state.isAutoRefreshActive;
    if (state.isAutoRefreshActive) {
      elements.refreshPlayPauseIcon.textContent = '⏸';
      elements.refreshTimerLabel.textContent = 'Auto: 5s';
      startAutoRefresh();
      showToast('Auto-refresh resumed (5s)', 'info');
    } else {
      elements.refreshPlayPauseIcon.textContent = '▶';
      elements.refreshTimerLabel.textContent = 'Paused';
      clearInterval(state.refreshTimerId);
      showToast('Auto-refresh paused', 'info');
    }
  });

  // Manual Refresh
  elements.btnManualRefresh.addEventListener('click', () => {
    elements.manualRefreshIcon.classList.add('spinning');
    fetchAllData().finally(() => {
      setTimeout(() => elements.manualRefreshIcon.classList.remove('spinning'), 500);
    });
  });

  // Copy Server Address
  elements.btnCopyAddress.addEventListener('click', () => {
    const text = elements.serverAddressText.textContent.trim();
    if (text && text !== 'Loading address...') {
      navigator.clipboard.writeText(text).then(() => {
        showToast(`Copied "${text}" to clipboard!`, 'success');
      });
    }
  });

  // Member Search
  elements.memberSearchInput.addEventListener('input', (e) => {
    state.membersSearch = e.target.value.toLowerCase().trim();
    renderMembersTable();
  });

  // Member Tier Filter Pills
  document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.membersFilter = btn.getAttribute('data-filter');
      renderMembersTable();
    });
  });

  // Log Filter Pills
  document.querySelectorAll('.log-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.log-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.logLevelFilter = btn.getAttribute('data-level');
      renderLogs();
    });
  });

  // Log Search
  elements.logSearchInput.addEventListener('input', (e) => {
    state.logSearch = e.target.value.toLowerCase().trim();
    renderLogs();
  });

  // Log Auto-scroll toggle
  elements.autoScrollCheck.addEventListener('change', (e) => {
    state.isAutoScrollEnabled = e.target.checked;
  });

  // Copy Logs
  elements.btnCopyLogs.addEventListener('click', () => {
    const text = state.logs
      .map(l => `[${new Date(l.timestamp).toISOString()}] [${l.level.toUpperCase()}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {
      showToast('All logs copied to clipboard!', 'success');
    });
  });

  // Clear Logs View
  elements.btnClearLogsView.addEventListener('click', () => {
    state.logs = [];
    renderLogs();
    showToast('Log view cleared', 'info');
  });

  // Modal Confirm
  elements.modalConfirmBtn.addEventListener('click', () => {
    if (state.pendingAction) {
      executeAction(state.pendingAction);
      closeActionModal();
    }
  });
}

// ── Auto Refresh Management ──────────────────────────────────────────────────
function startAutoRefresh() {
  if (state.refreshTimerId) clearInterval(state.refreshTimerId);
  state.refreshTimerId = setInterval(() => {
    if (state.isAutoRefreshActive) {
      fetchStatus();
      if (state.activeTab === 'logs') fetchLogs();
      if (state.activeTab === 'members') fetchMembers();
    }
  }, state.refreshIntervalMs);
}

// ── API Fetchers ─────────────────────────────────────────────────────────────
async function fetchAllData() {
  return Promise.allSettled([
    fetchStatus(),
    fetchMembers(),
    fetchAccessControl(),
    fetchLogs()
  ]);
}

async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderStatus(data);
  } catch (err) {
    console.error('Failed to fetch status:', err);
  }
}

async function fetchMembers() {
  try {
    const res = await fetch('/api/members');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.members = data.members || [];
    renderMembersTable(data);
  } catch (err) {
    console.error('Failed to fetch members:', err);
  }
}

async function fetchAccessControl() {
  try {
    const res = await fetch('/api/access-control');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderAccessControl(data);
  } catch (err) {
    console.error('Failed to fetch access control:', err);
  }
}

async function fetchLogs() {
  try {
    const res = await fetch('/api/logs?limit=250');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.logs = data.logs || [];
    renderLogs();
  } catch (err) {
    console.error('Failed to fetch logs:', err);
  }
}

// ── Render Functions ─────────────────────────────────────────────────────────

function renderStatus(data) {
  const { bot, minecraft, guild } = data;

  // 1. Bot Info
  if (bot) {
    elements.botName.textContent = bot.tag || 'TomMC-SMP Bot';
    elements.botTagBadge.textContent = bot.ready ? 'ONLINE' : 'CONNECTING';
    elements.botStatusDot.className = `status-indicator-dot ${bot.ready ? 'online' : 'connecting'}`;

    if (bot.avatarUrl) {
      elements.botAvatarWrapper.innerHTML = `
        <img src="${bot.avatarUrl}" alt="Bot Avatar" />
        <span class="status-indicator-dot ${bot.ready ? 'online' : 'connecting'}"></span>
      `;
    }

    state.botUptimeSeconds = bot.uptimeSeconds || 0;
    elements.botUptimeTicker.textContent = formatDuration(state.botUptimeSeconds);

    elements.wsPingText.textContent = `${bot.ping || 0} ms`;
    elements.ramUsageText.textContent = `${bot.memory?.rssMB || '--'} MB`;
    elements.nodeVersionText.textContent = bot.nodeVersion || '--';
    elements.platformText.textContent = bot.platform || '--';

    // Diagnostics
    elements.diagBotTag.textContent = bot.tag || '--';
    elements.diagBotReady.textContent = bot.ready ? 'Connected & Ready' : 'Connecting...';
    elements.diagWsPing.textContent = `${bot.ping || 0} ms`;
    elements.diagHeap.textContent = `${bot.memory?.heapUsedMB || '--'} MB / ${bot.memory?.heapTotalMB || '--'} MB`;
    elements.diagPlatform.textContent = `${bot.platform} (${bot.arch})`;
    elements.diagNode.textContent = bot.nodeVersion;

    if (bot.ping < 100) {
      elements.overallHealthBadge.className = 'footer-badge badge-success';
      elements.overallHealthBadge.textContent = 'Optimal';
    } else {
      elements.overallHealthBadge.className = 'footer-badge badge-warning';
      elements.overallHealthBadge.textContent = 'Degraded';
    }
  }

  // 2. Minecraft Server Status
  if (minecraft) {
    const rawStatus = (minecraft.status || 'OFFLINE').toUpperCase();
    elements.serverStateText.textContent = rawStatus;

    // Server State Pill Styling
    elements.serverStatePill.className = 'state-pill-large';
    if (rawStatus === 'ONLINE') {
      elements.serverStatePill.classList.add('online');
      elements.overviewStateBadge.className = 'badge badge-success';
    } else if (rawStatus === 'STARTING' || rawStatus === 'QUEUEING' || rawStatus === 'PREPARING') {
      elements.serverStatePill.classList.add('starting');
      elements.overviewStateBadge.className = 'badge badge-warning';
    } else {
      elements.overviewStateBadge.className = 'badge badge-danger';
    }
    elements.overviewStateBadge.textContent = rawStatus;

    // Address
    const addr = minecraft.port ? `${minecraft.ip}:${minecraft.port}` : minecraft.ip;
    elements.serverAddressText.textContent = addr || 'tikdi.aternos.me:25565';
    elements.serverLatencyText.textContent = minecraft.latencyMs ? `${minecraft.latencyMs} ms` : 'N/A';
    elements.serverSoftwareBadge.textContent = minecraft.software || 'Paper / Vanilla';

    // MC Uptime
    if (minecraft.onlineSince) {
      const sinceDate = new Date(minecraft.onlineSince);
      const diffSec = Math.floor((Date.now() - sinceDate.getTime()) / 1000);
      elements.mcUptimeText.textContent = formatDuration(diffSec);
      elements.specOnlineSince.textContent = sinceDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }) + ' IST';
    } else {
      elements.mcUptimeText.textContent = rawStatus === 'ONLINE' ? 'Active' : 'Offline';
      elements.specOnlineSince.textContent = rawStatus === 'ONLINE' ? 'Session active' : 'Server is currently offline';
    }

    // Players
    const currentP = minecraft.playersOnline ?? 0;
    const maxP = minecraft.maxPlayers ?? 20;
    elements.mcPlayersCount.textContent = `${currentP} / ${maxP}`;
    elements.playerListCount.textContent = currentP;
    elements.playerSlotsBadge.textContent = `Max ${maxP} Slots`;

    // Overview Specs
    elements.specHost.textContent = minecraft.ip || '--';
    elements.specPort.textContent = minecraft.port ? String(minecraft.port) : '25565';
    elements.specSoftware.textContent = minecraft.software || 'Aternos Vanilla';
    elements.specVersion.textContent = minecraft.version || 'Latest';
    elements.specRam.textContent = minecraft.ram || '2400 MB (Standard)';
    elements.specRegion.textContent = 'Europe / Frankfurt';

    // Player Grid
    renderPlayerGrid(minecraft.playerList || []);
  }

  // 3. Discord Guild
  if (guild) {
    elements.discordMemberCount.textContent = guild.memberCount || '--';
    elements.guildNameText.textContent = guild.name || 'Discord Guild';
    elements.channelsCountBadge.textContent = `${guild.channelsCount || 0} Channels`;
    elements.guildSubtitle.textContent = `${guild.name} • ${guild.memberCount} members`;
  }
}

function renderPlayerGrid(playerNames) {
  if (!playerNames || playerNames.length === 0) {
    elements.playersContainer.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🎮</span>
        <p>No players currently connected to the server.</p>
      </div>
    `;
    return;
  }

  elements.playersContainer.innerHTML = playerNames.map(name => {
    const avatarUrl = `https://mc-heads.net/avatar/${encodeURIComponent(name)}/28`;
    return `
      <div class="player-card">
        <img class="player-head" src="${avatarUrl}" alt="${name}" onerror="this.src='https://mc-heads.net/avatar/steve/28'" />
        <span class="player-name" title="${name}">${name}</span>
      </div>
    `;
  }).join('');
}

function renderMembersTable(data) {
  if (!data && state.members.length === 0) return;
  const members = state.members;

  // Update filter counters
  const ownerCount = members.filter(m => m.permissionTier === 'OWNER').length;
  const adminCount = members.filter(m => m.permissionTier === 'ADMIN').length;
  const trustedCount = members.filter(m => m.permissionTier === 'TRUSTED').length;
  const everyoneCount = members.filter(m => m.permissionTier === 'EVERYONE').length;

  elements.filterCountAll.textContent = members.length;
  elements.filterCountOwner.textContent = ownerCount;
  elements.filterCountAdmin.textContent = adminCount;
  elements.filterCountTrusted.textContent = trustedCount;
  elements.filterCountEveryone.textContent = everyoneCount;

  // Filter & Search
  let filtered = members.filter(m => {
    // Tier filter
    if (state.membersFilter === 'owner' && m.permissionTier !== 'OWNER') return false;
    if (state.membersFilter === 'admin' && m.permissionTier !== 'ADMIN') return false;
    if (state.membersFilter === 'trusted' && m.permissionTier !== 'TRUSTED') return false;
    if (state.membersFilter === 'everyone' && m.permissionTier !== 'EVERYONE') return false;

    // Search filter
    if (state.membersSearch) {
      const q = state.membersSearch;
      const matchName = m.displayName.toLowerCase().includes(q) || m.username.toLowerCase().includes(q);
      const matchId = m.id.includes(q);
      const matchRole = m.roles.some(r => r.name.toLowerCase().includes(q));
      return matchName || matchId || matchRole;
    }
    return true;
  });

  if (filtered.length === 0) {
    elements.membersTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="table-loading">No members matching current criteria.</td>
      </tr>
    `;
    return;
  }

  elements.membersTableBody.innerHTML = filtered.map(m => {
    // Permission badge
    let tierBadgeClass = 'badge-subtle';
    if (m.permissionTier === 'OWNER') tierBadgeClass = 'badge-danger';
    else if (m.permissionTier === 'ADMIN') tierBadgeClass = 'badge-warning';
    else if (m.permissionTier === 'TRUSTED') tierBadgeClass = 'badge-blurple';

    // Role tags
    const roleTagsHtml = m.roles.length > 0
      ? m.roles.map(r => {
        const color = r.color ? `#${r.color.toString(16).padStart(6, '0')}` : '#94a3b8';
        return `<span class="role-tag" style="border-color: ${color}40; color: ${color}">${r.name}</span>`;
      }).join('')
      : '<span class="text-muted" style="font-size:0.75rem">No roles</span>';

    return `
      <tr>
        <td>
          <div class="member-cell">
            <img class="member-avatar" src="${m.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}" alt="${m.username}" />
            <div class="member-name-block">
              <span class="member-display">${escapeHtml(m.displayName)}</span>
              <span class="member-user">@${escapeHtml(m.username)}</span>
            </div>
          </div>
        </td>
        <td><code class="code-pill">${m.id}</code></td>
        <td><span class="badge ${tierBadgeClass}">${m.permissionTier}</span></td>
        <td><div class="role-tags-list">${roleTagsHtml}</div></td>
        <td><span class="badge badge-subtle">${m.isBot ? '🤖 BOT' : '👤 USER'}</span></td>
      </tr>
    `;
  }).join('');
}

function renderAccessControl(data) {
  if (!data || !data.tiers) return;

  // 1. Render Tiers
  elements.accessTiersContainer.innerHTML = data.tiers.map(t => {
    let tierBadgeClass = 'badge-subtle';
    if (t.tier === 'OWNER') tierBadgeClass = 'badge-danger';
    else if (t.tier === 'ADMIN') tierBadgeClass = 'badge-warning';
    else if (t.tier === 'TRUSTED') tierBadgeClass = 'badge-blurple';

    const usersPills = t.configuredUserIds && t.configuredUserIds.length > 0
      ? t.configuredUserIds.map(id => `<span class="tier-id-pill">👤 ${id}</span>`).join(' ')
      : '<span class="text-muted" style="font-size:0.75rem">None configured</span>';

    const rolesPills = t.configuredRoleIds && t.configuredRoleIds.length > 0
      ? t.configuredRoleIds.map(id => `<span class="tier-id-pill">🛡️ Role: ${id}</span>`).join(' ')
      : '<span class="text-muted" style="font-size:0.75rem">None configured</span>';

    return `
      <div class="access-tier-card">
        <div class="tier-title-row">
          <div class="tier-name">${escapeHtml(t.name)}</div>
          <span class="badge ${tierBadgeClass}">Level ${t.level} &bull; ${t.tier}</span>
        </div>
        <p class="tier-desc">${escapeHtml(t.description)}</p>
        <div class="tier-ids-block">
          <div><strong style="font-size:0.75rem; color:#94a3b8">Authorized Users:</strong> ${usersPills}</div>
          <div style="margin-top:4px"><strong style="font-size:0.75rem; color:#94a3b8">Authorized Roles:</strong> ${rolesPills}</div>
        </div>
      </div>
    `;
  }).join('');

  // 2. Render Commands Matrix
  if (data.commandMatrix) {
    elements.commandsTableBody.innerHTML = data.commandMatrix.map(cmd => {
      let tierBadgeClass = 'badge-subtle';
      if (cmd.requiredTier === 'OWNER') tierBadgeClass = 'badge-danger';
      else if (cmd.requiredTier === 'ADMIN') tierBadgeClass = 'badge-warning';
      else if (cmd.requiredTier === 'TRUSTED') tierBadgeClass = 'badge-blurple';

      return `
        <tr>
          <td><code class="code-pill">/${cmd.command}</code></td>
          <td><span class="badge ${tierBadgeClass}">${cmd.requiredTier}</span></td>
          <td><span style="font-size:0.78rem; color:#94a3b8">${cmd.description}</span></td>
        </tr>
      `;
    }).join('');
  }
}

function renderLogs() {
  if (!state.logs || state.logs.length === 0) {
    elements.terminalLogContainer.innerHTML = `
      <div class="log-line log-info">
        <span class="log-ts">[Ready]</span> <span class="log-msg">No logs currently in buffer.</span>
      </div>
    `;
    return;
  }

  let filtered = state.logs.filter(l => {
    // Level filter
    if (state.logLevelFilter !== 'all' && l.level.toLowerCase() !== state.logLevelFilter) {
      return false;
    }
    // Search filter
    if (state.logSearch) {
      return l.message.toLowerCase().includes(state.logSearch);
    }
    return true;
  });

  elements.terminalLogContainer.innerHTML = filtered.map(l => {
    const timeStr = new Date(l.timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const level = (l.level || 'info').toLowerCase();
    const badgeText = level.toUpperCase().padEnd(5, ' ');

    return `
      <div class="log-line log-${level}">
        <span class="log-ts">[${timeStr}]</span>
        <span class="log-badge">[${badgeText}]</span>
        <span class="log-msg">${escapeHtml(l.message)}</span>
      </div>
    `;
  }).join('');

  if (state.isAutoScrollEnabled) {
    elements.terminalLogContainer.scrollTop = elements.terminalLogContainer.scrollHeight;
  }
}

// ── Action Modal Management ──────────────────────────────────────────────────
function openActionModal(actionType) {
  state.pendingAction = actionType;
  const titles = {
    start: 'Start Minecraft Server',
    stop: 'Stop Minecraft Server',
    restart: 'Restart Minecraft Server'
  };
  const descriptions = {
    start: 'This will issue a command via the Aternos automation pipeline to boot up the Minecraft server.',
    stop: 'Are you sure you want to shut down the server? Active players will be disconnected.',
    restart: 'This will perform a full restart sequence on the server.'
  };

  elements.modalTitle.textContent = titles[actionType] || 'Execute Action';
  elements.modalDescription.textContent = descriptions[actionType] || 'Confirm operation.';
  elements.actionModal.classList.add('open');
}

function closeActionModal() {
  elements.actionModal.classList.remove('open');
  state.pendingAction = null;
}

async function executeAction(actionType) {
  try {
    showToast(`Dispatching "${actionType}" command...`, 'info');
    const res = await fetch(`/api/actions/${actionType}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();

    if (res.ok && data.success) {
      showToast(`Success: ${data.message}`, 'success');
      // Trigger status refresh right away
      setTimeout(fetchStatus, 1000);
    } else {
      showToast(`Error: ${data.error || data.message || 'Operation failed'}`, 'error');
    }
  } catch (err) {
    showToast(`Network error executing ${actionType}`, 'error');
  }
}

async function triggerForcePoll() {
  try {
    showToast('Triggering force status poll...', 'info');
    const res = await fetch('/api/actions/poll', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      showToast('Poll completed successfully', 'success');
      fetchStatus();
    }
  } catch (err) {
    showToast('Failed to force poll', 'error');
  }
}

// ── Toast System ─────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = {
    success: '',
    error: '❌',
    info: 'ℹ️'
  };

  toast.innerHTML = `
    <span>${icons[type] || 'ℹ️'}</span>
    <span>${escapeHtml(message)}</span>
  `;

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── Helper Utilities ─────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
