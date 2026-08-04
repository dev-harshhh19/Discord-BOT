import { getIcon } from '../icons.js';
import { store } from '../state.js';

/**
 * Active Members & Minecraft Players Component
 */

let filterQuery = '';
let commandInputVal = '';

export function renderMembers(container) {
  const state = store.getState();
  const guild = state.guild || {};
  const members = state.members || [];
  const mc = state.minecraftPlayers || { online: 0, max: 0, list: [] };
  const registered = state.registeredPlayers || [];

  const filteredMembers = members.filter((m) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      m.username?.toLowerCase().includes(q) ||
      m.displayName?.toLowerCase().includes(q) ||
      m.id?.includes(q) ||
      m.minecraftPlayerName?.toLowerCase().includes(q) ||
      m.roles?.some((r) => r.name.toLowerCase().includes(q))
    );
  });

  const onlinePlayers = mc.list || [];

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 20px;">
      
      <!-- 1. Live Minecraft Players Card -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span class="icon">${getIcon('gamepad')}</span>
            <span>Live Minecraft Players</span>
          </div>
          <div>
            <span class="badge ${onlinePlayers.length > 0 ? 'online' : 'everyone'}">
              <span class="player-live-dot" style="${onlinePlayers.length > 0 ? '' : 'background: var(--text-muted); box-shadow: none;'}"></span>
              <span>${mc.online ?? onlinePlayers.length} / ${mc.max || 20} Online</span>
            </span>
          </div>
        </div>

        ${
          onlinePlayers.length > 0
            ? `
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
                  onerror="this.src='https://mc-heads.net/avatar/MHF_Steve/48'"
                />
                <div class="player-info">
                  <span class="player-ign-name">${escapeHtml(p)}</span>
                  <span class="player-subtext" style="color: var(--color-online);">
                    <span class="player-live-dot"></span> In Game
                  </span>
                </div>
              </div>
            `,
              )
              .join('')}
          </div>
        `
            : `
          <div style="padding: 18px 12px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
            <span>No players currently connected to the Minecraft server.</span>
          </div>
        `
        }
      </div>

      <!-- 2. Discord Slash Command Helper (/register playerName:[emptyBox]) -->
      <div class="discord-command-container">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 0.875rem; color: var(--text-primary);">
            <span class="icon" style="color: #5865f2;">${getIcon('command')}</span>
            <span>Discord Slash Command Reference</span>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Self-Service Player Whitelisting</span>
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
          <button id="copy-cmd-btn" class="btn btn-secondary btn-sm" style="padding: 4px 10px; font-size: 0.78rem;">
            <span class="icon">${getIcon('copy')}</span>
            <span id="copy-btn-text">Copy Command</span>
          </button>
        </div>

        <div class="cmd-hint-text">
          <span class="icon" style="flex-shrink: 0;">${getIcon('info')}</span>
          <span>
            Type <code>/register playerName:[your_name]</code> in Discord to link your Minecraft profile, get added to the whitelist, and receive Trusted access.
          </span>
        </div>
      </div>

      <!-- 3. Registered / Whitelisted Players Roster -->
      ${
        registered.length > 0
          ? `
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <span class="icon">${getIcon('shield')}</span>
              <span>Registered Players & Whitelist Roster</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">
              Total Registered: <strong>${registered.length}</strong>
            </div>
          </div>

          <div class="players-roster-grid">
            ${registered
              .map(
                (r) => `
              <div class="player-card">
                <img
                  src="${r.playerName ? `https://mc-heads.net/avatar/${encodeURIComponent(r.playerName)}/48` : 'https://mc-heads.net/avatar/MHF_Steve/48'}"
                  alt="${escapeHtml(r.playerName || 'Player')}"
                  class="player-avatar-mc"
                  loading="lazy"
                  onerror="this.src='https://mc-heads.net/avatar/MHF_Steve/48'"
                />
                <div class="player-info">
                  <span class="player-ign-name">${escapeHtml(r.playerName || 'IGN Unspecified')}</span>
                  <span class="player-subtext">${escapeHtml(r.tag)}</span>
                </div>
                <span class="badge trusted" style="font-size: 0.68rem; padding: 2px 6px;">
                  Whitelist
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

      <!-- 4. Guild Directory Table -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span class="icon">${getIcon('users')}</span>
            <span>Discord Guild: ${escapeHtml(guild.name || 'Connected Server')}</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">
            Total Guild Members: <strong>${guild.memberCount ?? members.length}</strong>
          </div>
        </div>

        <!-- Search & Filters -->
        <div style="display: flex; gap: 0.75rem; align-items: center; margin-bottom: 12px;">
          <div style="position: relative; flex: 1; max-width: 380px;">
            <input
              type="text"
              id="members-search-input"
              placeholder="Search by username, IGN, ID or role..."
              value="${escapeHtml(filterQuery)}"
              style="width: 100%; padding-left: 2.25rem;"
            />
            <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--text-muted);">
              ${getIcon('search')}
            </span>
          </div>
          <span style="font-size: 0.8125rem; color: var(--text-muted);">
            Showing ${filteredMembers.length} member${filteredMembers.length === 1 ? '' : 's'}
          </span>
        </div>

        <!-- Table of Members -->
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Minecraft IGN</th>
                <th>Permission Tier</th>
                <th>Roles</th>
                <th>Joined Date</th>
              </tr>
            </thead>
            <tbody>
              ${
                filteredMembers.length > 0
                  ? filteredMembers
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
                              ${m.isBot ? `<span class="badge everyone" style="font-size: 0.625rem; padding: 0.05rem 0.3rem; margin-left: 0.3rem;">BOT</span>` : ''}
                            </span>
                            <span class="user-id">${escapeHtml(m.id)}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        ${
                          m.minecraftPlayerName
                            ? `
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <img
                              src="https://mc-heads.net/avatar/${encodeURIComponent(m.minecraftPlayerName)}/24"
                              alt=""
                              style="width: 20px; height: 20px; border-radius: 4px; image-rendering: pixelated;"
                              onerror="this.style.display='none'"
                            />
                            <span class="font-mono" style="font-size: 0.8125rem; color: var(--text-primary); font-weight: 500;">
                              ${escapeHtml(m.minecraftPlayerName)}
                            </span>
                          </div>
                        `
                            : `<span style="color: var(--text-dim); font-size: 0.75rem;">Not linked</span>`
                        }
                      </td>
                      <td>
                        <span class="badge ${badgeClass}">
                          <span class="icon">${getPermissionIcon(m.permissionLevel)}</span>
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
                      <td style="font-size: 0.75rem; color: var(--text-dim);">
                        ${m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '--'}
                      </td>
                    </tr>
                  `;
                      })
                      .join('')
                  : `
                  <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-dim);">
                      ${members.length === 0 ? 'No member details available.' : 'No members match your search criteria.'}
                    </td>
                  </tr>
                `
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Search input handler
  const searchInput = container.querySelector('#members-search-input');
  searchInput?.addEventListener('input', (e) => {
    filterQuery = e.target.value;
    renderMembers(container);
  });

  // Command helper input handler
  const cmdInput = container.querySelector('#cmd-player-name-input');
  cmdInput?.addEventListener('input', (e) => {
    commandInputVal = e.target.value;
  });

  // Copy command button handler
  const copyBtn = container.querySelector('#copy-cmd-btn');
  copyBtn?.addEventListener('click', () => {
    const name = commandInputVal.trim() || 'YourMinecraftIGN';
    const textToCopy = `/register playerName:${name}`;
    navigator.clipboard?.writeText(textToCopy).then(() => {
      const btnText = container.querySelector('#copy-btn-text');
      if (btnText) {
        btnText.textContent = 'Copied!';
        setTimeout(() => {
          btnText.textContent = 'Copy Command';
        }, 2000);
      }
    });
  });
}

function getPermissionBadgeClass(level) {
  if (level >= 3) return 'owner';
  if (level === 2) return 'admin';
  if (level === 1) return 'trusted';
  return 'everyone';
}

function getPermissionIcon(level) {
  if (level >= 3) return getIcon('shield');
  if (level === 2) return getIcon('shield');
  if (level === 1) return getIcon('user');
  return getIcon('user');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
