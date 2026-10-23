import { getIcon } from '../icons.js';
import { store } from '../state.js';

/**
 * Modern Clean SaaS Members & Minecraft Players Directory
 */

let filterQuery = '';
let commandInputVal = '';

export function renderMembers(container) {
  const state = store.getState();
  const guild = state.guild || {};
  const members = state.members || [];
  const mc = state.minecraftPlayers || { online: 0, max: 0, list: [] };
  const registered = state.registeredPlayers || [];

  const onlinePlayers = mc.list || [];

  // Check if structure already mounted - if so, just update dynamic sections
  const existingTable = container.querySelector('#members-table-body');
  if (existingTable) {
    updateMembersDOM(container, { guild, members, mc, registered, onlinePlayers });
    return;
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      
      <!-- 1. Live Minecraft Players in Realm -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span class="icon">${getIcon('gamepad')}</span>
            <span>Live Minecraft Players</span>
          </div>
          <div>
            <span class="badge ${onlinePlayers.length > 0 ? 'admin' : 'everyone'}" id="members-mc-badge">
              <span class="player-live-dot" style="${onlinePlayers.length > 0 ? '' : 'background: var(--text-dim);'}"></span>
              <span>${mc.online ?? onlinePlayers.length} / ${mc.max || 20} Online</span>
            </span>
          </div>
        </div>

        <div id="members-online-players-mount">
          ${renderLivePlayersHTML(onlinePlayers)}
        </div>
      </div>

      <!-- 2. Discord Whitelist Command Helper -->
      <div class="discord-command-container">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700; font-size: 0.9375rem; color: var(--text-primary);">
            <span class="icon" style="color: var(--color-primary);">${getIcon('command')}</span>
            <span>Discord Whitelist Command</span>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">Self-Service Player Registration</span>
        </div>

        <div class="discord-command-box">
          <span class="cmd-slash">/register</span>
          <span class="cmd-param-pill">playerName:</span>
          <div class="cmd-input-preview">
            <input
              type="text"
              id="cmd-player-name-input"
              placeholder="YourMinecraftIGN"
              value="${escapeHtml(commandInputVal)}"
              autocomplete="off"
              spellcheck="false"
            />
          </div>
          <button id="copy-cmd-btn" class="btn btn-secondary btn-sm" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;">
            <span class="icon">${getIcon('copy')}</span>
            <span id="copy-btn-text">Copy Command</span>
          </button>
        </div>

        <div class="cmd-hint-text">
          <span class="icon" style="flex-shrink: 0; color: var(--color-primary);">${getIcon('info')}</span>
          <span>
            Type <code>/register playerName:[your_name]</code> in Discord to link your Minecraft username and get whitelisted instantly.
          </span>
        </div>
      </div>

      <!-- 3. Registered / Whitelisted Players -->
      ${
        registered.length > 0
          ? `
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <span class="icon">${getIcon('shield')}</span>
              <span>Whitelisted Players Roster</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
              Total Whitelisted: <strong style="color: var(--text-primary);">${registered.length}</strong>
            </div>
          </div>

          <div class="players-roster-grid">
            ${registered
              .map(
                (r) => `
              <div class="player-card">
                <img
                  src="${r.playerName ? `https://mc-heads.net/avatar/${encodeURIComponent(r.playerName)}/48` : 'https://mc-heads.net/avatar/steve/48'}"
                  alt="${escapeHtml(r.playerName || 'Player')}"
                  class="player-avatar-mc"
                  loading="lazy"
                  onerror="this.src='https://mc-heads.net/avatar/steve/48';"
                />
                <div class="player-info">
                  <span class="player-ign-name">${escapeHtml(r.playerName || 'Unspecified')}</span>
                  <span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(r.tag)}</span>
                </div>
                <span class="badge trusted" style="margin-left: auto; font-size: 0.65rem;">
                  Whitelisted
                </span>
              </div>
            `,
              )
              .join('')}
          </div>
        </div>
      `
          : ''
      }

      <!-- 4. Discord Guild Members Directory Table -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span class="icon">${getIcon('users')}</span>
            <span>Discord Community: ${escapeHtml(guild.name || 'Server Members')}</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
            Total Members: <strong style="color: var(--text-primary);">${guild.memberCount ?? members.length}</strong>
          </div>
        </div>

        <!-- Search Bar -->
        <div style="display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap;">
          <div style="position: relative; flex: 1; max-width: 380px;">
            <input
              type="text"
              id="members-search-input"
              placeholder="Search by username, IGN, ID, or role..."
              value="${escapeHtml(filterQuery)}"
              style="width: 100%; padding-left: 2.25rem;"
            />
            <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); display: flex;">
              ${getIcon('search')}
            </span>
          </div>
          <span style="font-size: 0.8125rem; color: var(--text-muted);" id="members-count-indicator">
            Showing ${getFilteredMembers(members).length} member${getFilteredMembers(members).length === 1 ? '' : 's'}
          </span>
        </div>

        <!-- Table -->
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Minecraft IGN</th>
                <th>Permission Tier</th>
                <th>Roles</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody id="members-table-body">
              ${renderTableRowsHTML(getFilteredMembers(members), members.length)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Attach event handlers
  attachMembersEvents(container);
}

function getFilteredMembers(members) {
  if (!filterQuery) return members;
  const q = filterQuery.toLowerCase();
  return members.filter((m) => {
    return (
      m.username?.toLowerCase().includes(q) ||
      m.displayName?.toLowerCase().includes(q) ||
      m.id?.includes(q) ||
      m.minecraftPlayerName?.toLowerCase().includes(q) ||
      m.roles?.some((r) => r.name.toLowerCase().includes(q))
    );
  });
}

function renderLivePlayersHTML(onlinePlayers) {
  if (onlinePlayers.length > 0) {
    return `
      <div class="players-roster-grid">
        ${onlinePlayers
          .map(
            (p) => `
          <div class="player-card">
            <img
              src="https://mc-heads.net/avatar/${encodeURIComponent(p)}/48"
              alt="${escapeHtml(p)}"
              class="player-avatar-mc"
              loading="lazy"
              onerror="this.src='https://mc-heads.net/avatar/steve/48';"
            />
            <div class="player-info">
              <span class="player-ign-name">${escapeHtml(p)}</span>
              <span class="player-tag">In Game</span>
            </div>
          </div>
        `,
          )
          .join('')}
      </div>
    `;
  }

  return `
    <div class="empty-players" style="padding: 1.5rem 1rem;">
      ${getIcon('gamepad')}
      <div style="font-weight: 600; color: var(--text-secondary); margin-top: 0.25rem;">
        No players currently online
      </div>
      <div style="font-size: 0.75rem; color: var(--text-muted);">
        Connect to the server to appear on the live players roster.
      </div>
    </div>
  `;
}

function renderTableRowsHTML(filteredMembers, totalMembers) {
  if (filteredMembers.length === 0) {
    return `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
          ${totalMembers === 0 ? 'No member details available.' : 'No members match your search criteria.'}
        </td>
      </tr>
    `;
  }

  return filteredMembers
    .map((m) => {
      const badgeClass = getPermissionBadgeClass(m.permissionLevel);
      return `
        <tr>
          <td>
            <div class="user-cell">
              ${
                m.avatar
                  ? `<img src="${escapeHtml(m.avatar)}" class="user-avatar" alt="${escapeHtml(m.username)}" loading="lazy" />`
                  : `<div class="user-avatar fallback">${escapeHtml(m.username?.charAt(0)?.toUpperCase() || '?')}</div>`
              }
              <div class="user-details">
                <span class="user-name">
                  ${escapeHtml(m.displayName || m.username)}
                  ${m.isBot ? `<span class="badge everyone" style="font-size: 0.625rem; padding: 0.05rem 0.3rem;">BOT</span>` : ''}
                </span>
                <span class="user-id">${escapeHtml(m.id)}</span>
              </div>
            </div>
          </td>
          <td>
            ${
              m.minecraftPlayerName
                ? `
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <img
                  src="https://mc-heads.net/avatar/${encodeURIComponent(m.minecraftPlayerName)}/24"
                  alt=""
                  style="width: 20px; height: 20px; border-radius: 4px; image-rendering: pixelated; border: 1px solid var(--border-default);"
                  onerror="this.style.display='none'"
                />
                <span style="font-family: var(--font-mono); font-size: 0.8125rem; color: var(--text-primary); font-weight: 600;">
                  ${escapeHtml(m.minecraftPlayerName)}
                </span>
              </div>
            `
                : `<span style="color: var(--text-dim); font-size: 0.75rem;">Not linked</span>`
            }
          </td>
          <td>
            <span class="badge ${badgeClass}">
              <span>${escapeHtml(m.permissionName)}</span>
            </span>
          </td>
          <td>
            <div style="max-width: 280px; display: flex; flex-wrap: wrap; gap: 4px;">
              ${
                m.roles && m.roles.length > 0
                  ? m.roles.map((r) => `<span class="role-tag">${escapeHtml(r.name)}</span>`).join('')
                  : `<span style="color: var(--text-dim); font-size: 0.75rem;">No custom roles</span>`
              }
            </div>
          </td>
          <td style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">
            ${m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '--'}
          </td>
        </tr>
      `;
    })
    .join('');
}

function updateMembersDOM(container, data) {
  const { members, mc, onlinePlayers } = data;
  const filtered = getFilteredMembers(members);

  const mcBadge = container.querySelector('#members-mc-badge');
  if (mcBadge) {
    mcBadge.className = `badge ${onlinePlayers.length > 0 ? 'admin' : 'everyone'}`;
    mcBadge.innerHTML = `
      <span class="player-live-dot" style="${onlinePlayers.length > 0 ? '' : 'background: var(--text-dim);'}"></span>
      <span>${mc.online ?? onlinePlayers.length} / ${mc.max || 20} Online</span>
    `;
  }

  const tbody = container.querySelector('#members-table-body');
  if (tbody) {
    tbody.innerHTML = renderTableRowsHTML(filtered, members.length);
  }

  const indicator = container.querySelector('#members-count-indicator');
  if (indicator) {
    indicator.textContent = `Showing ${filtered.length} member${filtered.length === 1 ? '' : 's'}`;
  }
}

function attachMembersEvents(container) {
  // Live search handler (updates table without destroying the search input)
  const searchInput = container.querySelector('#members-search-input');
  searchInput?.addEventListener('input', (e) => {
    filterQuery = e.target.value;
    const state = store.getState();
    const members = state.members || [];
    const filtered = getFilteredMembers(members);

    const tbody = container.querySelector('#members-table-body');
    if (tbody) {
      tbody.innerHTML = renderTableRowsHTML(filtered, members.length);
    }

    const indicator = container.querySelector('#members-count-indicator');
    if (indicator) {
      indicator.textContent = `Showing ${filtered.length} member${filtered.length === 1 ? '' : 's'}`;
    }
  });

  // Whitelist command input
  const cmdInput = container.querySelector('#cmd-player-name-input');
  cmdInput?.addEventListener('input', (e) => {
    commandInputVal = e.target.value;
  });

  // Whitelist copy command button
  const copyBtn = container.querySelector('#copy-cmd-btn');
  copyBtn?.addEventListener('click', async () => {
    const name = commandInputVal.trim() || 'YourMinecraftIGN';
    const textToCopy = `/register playerName:${name}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'absolute';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      const btnText = container.querySelector('#copy-btn-text');
      if (btnText) {
        const originalText = btnText.textContent;
        btnText.textContent = 'Copied!';
        setTimeout(() => {
          btnText.textContent = originalText;
        }, 2000);
      }
    } catch {
      // Fallback
    }
  });
}

function getPermissionBadgeClass(level) {
  if (level >= 4) return 'owner';
  if (level === 3) return 'admin';
  if (level === 2) return 'trusted';
  if (level === 1) return 'admin';
  return 'everyone';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
