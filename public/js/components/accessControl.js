import { getIcon } from '../icons.js';
import { store } from '../state.js';

/**
 * Modern Clean SaaS Access Control & Command Matrix Component
 * 5-Level Hierarchical Role-Based Permissions
 */

let cmdFilterQuery = '';

export function renderAccessControl(container) {
  const state = store.getState();
  const isAdmin = state.isAdmin;
  const access = state.accessControl || {};
  const tiers = access.tiers || [];
  const commands = access.commands || [];

  const filteredCommands = getFilteredCommands(commands);

  // If already mounted, update dynamically without breaking focus
  const existingTable = container.querySelector('#access-commands-tbody');
  if (existingTable) {
    updateAccessDOM(container, { tiers, commands, filteredCommands, isAdmin });
    return;
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      
      <!-- 1. Hero Permission Summary Card -->
      <div class="card">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: flex-start; gap: 0.875rem; flex: 1; min-width: 260px;">
            <div class="stat-icon-wrapper" style="width: 2.5rem; height: 2.5rem;">
              ${getIcon('shield')}
            </div>
            <div>
              <h2 style="font-family: var(--font-display); font-size: 1.15rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">
                5-Level Role-Based Permission Architecture
              </h2>
              <p style="font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.5; max-width: 680px;">
                Permissions are organized into 5 hierarchical tiers. Each level inherits all permissions from previous levels. Role assignments (<code>MINECRAFT_ROLE_IDS</code>, <code>TRUSTED_ROLE_IDS</code>, <code>ADMIN_ROLE_IDS</code>, <code>OWNER_ROLE_IDS</code>) map strictly to their respective tiers.
              </p>
            </div>
          </div>

          <div>
            ${
              isAdmin
                ? `
              <span class="badge admin" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;">
                <span class="player-live-dot" style="background: var(--color-online);"></span>
                <span>Admin View (Snowflakes Visible)</span>
              </span>
            `
                : `
              <button class="btn btn-secondary btn-sm" id="access-login-btn">
                <span class="icon">${getIcon('key')}</span>
                <span>Admin Login</span>
              </button>
            `
            }
          </div>
        </div>

        <!-- 5-Level Hierarchy Summary Pills -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid var(--border-subtle);">
          <div style="background-color: var(--bg-surface-subtle); border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: 0.75rem 0.85rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
              <span class="badge everyone">Everyone</span>
              <span style="font-size: 0.6875rem; font-family: var(--font-mono); color: var(--text-dim); font-weight: 700;">Level 0</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-secondary);">
              <code>/status</code>, <code>/info</code>, <code>/players</code>, <code>/ping</code>, <code>/help</code>, <code>/register</code>, <code>/privacy</code>, <code>/terms</code>, and dashboard Refresh button.
            </div>
          </div>

          <div style="background-color: var(--bg-surface-subtle); border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: 0.75rem 0.85rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
              <span class="badge minecraft">Minecraft_Role</span>
              <span style="font-size: 0.6875rem; font-family: var(--font-mono); color: var(--text-dim); font-weight: 700;">Level 1</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-secondary);">
              All Level 0 permissions + <code>/start</code>.
            </div>
          </div>

          <div style="background-color: var(--bg-surface-subtle); border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: 0.75rem 0.85rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
              <span class="badge trusted">Trusted</span>
              <span style="font-size: 0.6875rem; font-family: var(--font-mono); color: var(--text-dim); font-weight: 700;">Level 2</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-secondary);">
              All Level 0 + 1 permissions + <code>/stop</code>, dashboard Start &amp; Stop buttons, and Stop Confirmation button.
            </div>
          </div>

          <div style="background-color: var(--bg-surface-subtle); border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: 0.75rem 0.85rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
              <span class="badge admin">Admin</span>
              <span style="font-size: 0.6875rem; font-family: var(--font-mono); color: var(--text-dim); font-weight: 700;">Level 3</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-secondary);">
              All Level 0 + 1 + 2 permissions + <code>/force-refresh</code>, panel sync, and Web Admin management.
            </div>
          </div>

          <div style="background-color: var(--bg-surface-subtle); border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: 0.75rem 0.85rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
              <span class="badge owner">Owner</span>
              <span style="font-size: 0.6875rem; font-family: var(--font-mono); color: var(--text-dim); font-weight: 700;">Level 4</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-secondary);">
              Unrestricted: Full access to all commands, features, and controls, including <code>/restart</code>, with no restrictions.
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Configured Permission Tiers Detail Grid -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span class="icon">${getIcon('layers')}</span>
            <span>Role Configuration &amp; Tier Mapping</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">
            ${tiers.length} Active Tiers Configured
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem;">
          ${
            tiers.length > 0
              ? tiers
                  .map((tier) => {
                    const badgeClass = getTierBadgeClass(tier.name);
                    return `
                <div style="background-color: var(--bg-surface-subtle); border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span class="badge ${badgeClass}">${escapeHtml(tier.name)}</span>
                    <span style="font-size: 0.6875rem; color: var(--text-dim); font-family: var(--font-mono); font-weight: 700;">Level ${tier.level}</span>
                  </div>
                  <div style="font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.4;">
                    ${escapeHtml(tier.description)}
                  </div>
                  ${
                    isAdmin && tier.roleIds && tier.roleIds.length > 0
                      ? `
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px solid var(--border-subtle);">
                      Role IDs: <code style="font-size: 0.6875rem;">${escapeHtml(tier.roleIds.join(', '))}</code>
                    </div>
                  `
                      : ''
                  }
                  ${
                    isAdmin && tier.userIds && tier.userIds.length > 0
                      ? `
                    <div style="font-size: 0.75rem; color: var(--text-muted);">
                      Fallback IDs: <code style="font-size: 0.6875rem;">${escapeHtml(tier.userIds.join(', '))}</code>
                    </div>
                  `
                      : ''
                  }
                  ${
                    !isAdmin && tier.level > 0
                      ? `
                    <div style="font-size: 0.6875rem; color: var(--text-dim); margin-top: 0.25rem;">
                      <span class="icon" style="font-size: 0.625rem;">${getIcon('lock')}</span> Discord Snowflake IDs hidden
                    </div>
                  `
                      : ''
                  }
                </div>
              `;
                  })
                  .join('')
              : '<div style="color: var(--text-muted); padding: 1.5rem; text-align: center;">Loading permission tiers...</div>'
          }
        </div>
      </div>

      <!-- 3. Discord Slash Command Directory Table -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span class="icon">${getIcon('terminal')}</span>
            <span>Discord Slash Command Directory</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;" id="access-command-count">
            ${commands.length} Commands Registered
          </div>
        </div>

        <!-- Search Bar -->
        <div style="display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap;">
          <div style="position: relative; flex: 1; max-width: 380px;">
            <input
              type="text"
              id="access-search-input"
              placeholder="Search commands by name or description..."
              value="${escapeHtml(cmdFilterQuery)}"
              style="width: 100%; padding-left: 2.25rem;"
            />
            <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); display: flex;">
              ${getIcon('search')}
            </span>
          </div>
          <span style="font-size: 0.8125rem; color: var(--text-muted);" id="access-search-indicator">
            Showing ${filteredCommands.length} command${filteredCommands.length === 1 ? '' : 's'}
          </span>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="min-width: 140px;">Slash Command</th>
                <th>Description</th>
                <th style="min-width: 150px;">Required Tier</th>
                <th style="min-width: 220px;">Eligible Roles</th>
              </tr>
            </thead>
            <tbody id="access-commands-tbody">
              ${renderCommandRowsHTML(filteredCommands)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  attachAccessEvents(container);
}

function getFilteredCommands(commands) {
  if (!cmdFilterQuery) return commands;
  const q = cmdFilterQuery.toLowerCase();
  return commands.filter((cmd) => {
    return (
      cmd.name?.toLowerCase().includes(q) ||
      cmd.description?.toLowerCase().includes(q) ||
      cmd.requiredPermissionName?.toLowerCase().includes(q)
    );
  });
}

function renderCommandRowsHTML(commandsList) {
  if (commandsList.length === 0) {
    return `
      <tr>
        <td colspan="4" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
          No commands match your search query.
        </td>
      </tr>
    `;
  }

  return commandsList
    .map((cmd) => {
      const badgeClass = getTierBadgeClass(cmd.requiredPermissionName);
      const permName = cmd.requiredPermissionName || 'Everyone';
      return `
        <tr>
          <td>
            <code style="font-weight: 700; color: var(--color-primary); font-size: 0.875rem; letter-spacing: -0.01em;">
              ${escapeHtml(cmd.name)}
            </code>
          </td>
          <td style="color: var(--text-secondary); font-size: 0.8125rem;">
            ${escapeHtml(cmd.description || 'Executes server telemetry or lifecycle operation')}
          </td>
          <td>
            <span class="badge ${badgeClass}">
              <span>${escapeHtml(permName)}</span>
            </span>
          </td>
          <td style="font-size: 0.75rem; color: var(--text-muted);">
            ${describeEligibleRoles(cmd.name, cmd.requiredPermission)}
          </td>
        </tr>
      `;
    })
    .join('');
}

function describeEligibleRoles(cmdName, reqLevel) {
  if (reqLevel >= 4) {
    return '<span style="color: #7E22CE; font-weight: 600;">Owner Only</span>';
  }
  if (reqLevel === 3) {
    return '<span style="color: #DC2626; font-weight: 600;">Admin &bull; Owner</span>';
  }
  if (reqLevel === 2) {
    return '<span style="color: #1D4ED8; font-weight: 600;">Trusted &bull; Admin &bull; Owner</span>';
  }
  if (reqLevel === 1) {
    return '<span style="color: #EA580C; font-weight: 600;">Minecraft_Role &bull; Trusted &bull; Admin &bull; Owner</span>';
  }
  return '<span style="color: var(--text-secondary);">Everyone (Public)</span>';
}

function updateAccessDOM(container, data) {
  const { filteredCommands } = data;
  const tbody = container.querySelector('#access-commands-tbody');
  if (tbody) {
    tbody.innerHTML = renderCommandRowsHTML(filteredCommands);
  }
  const indicator = container.querySelector('#access-search-indicator');
  if (indicator) {
    indicator.textContent = `Showing ${filteredCommands.length} command${filteredCommands.length === 1 ? '' : 's'}`;
  }
}

function attachAccessEvents(container) {
  // Live search input handler
  const searchInput = container.querySelector('#access-search-input');
  searchInput?.addEventListener('input', (e) => {
    cmdFilterQuery = e.target.value;
    const access = store.getState().accessControl || {};
    const commands = access.commands || [];
    const filtered = getFilteredCommands(commands);

    const tbody = container.querySelector('#access-commands-tbody');
    if (tbody) {
      tbody.innerHTML = renderCommandRowsHTML(filtered);
    }

    const indicator = container.querySelector('#access-search-indicator');
    if (indicator) {
      indicator.textContent = `Showing ${filtered.length} command${filtered.length === 1 ? '' : 's'}`;
    }
  });

  // Admin Login button
  container.querySelector('#access-login-btn')?.addEventListener('click', () => {
    store.setCurrentTab('login');
  });
}

function getTierBadgeClass(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('owner')) return 'owner';
  if (n.includes('admin')) return 'admin';
  if (n.includes('trusted')) return 'trusted';
  if (n.includes('minecraft')) return 'minecraft';
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
