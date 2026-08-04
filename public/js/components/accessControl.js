import { getIcon } from '../icons.js';
import { store } from '../state.js';
import { openAuthModal } from './authModal.js';

/**
 * Access Control & Permissions Component
 */

export function renderAccessControl(container) {
  const state = store.getState();
  const isAdmin = state.isAdmin;
  const access = state.accessControl || {};
  const tiers = access.tiers || [];
  const commands = access.commands || [];

  container.innerHTML = `
    <!-- Rule Highlight Card -->
    <div class="card" style="border-left: 4px solid var(--color-online);">
      <div style="display: flex; align-items: flex-start; gap: 0.875rem;">
        <span class="icon" style="color: var(--color-online); flex-shrink: 0; margin-top: 0.15rem;">
          ${getIcon('shield')}
        </span>
        <div style="flex: 1;">
          <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">
            Minecraft Role Permission Enforcement
          </div>
          <div style="font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.5;">
            Members assigned the <strong>Minecraft Role</strong> in Discord (configured via <code>MINECRAFT_ROLE_IDS</code>) receive full Admin rights across all operations (including <code>/start</code>, <code>/stop</code>, <code>/players</code>, <code>/ping</code>) <strong>except</strong> the <code>/restart</code> command, which is strictly restricted to Owner level.
          </div>
        </div>
        ${
          !isAdmin
            ? `
          <button class="btn btn-secondary" id="access-quick-unlock-btn" style="flex-shrink: 0; font-size: 0.75rem;">
            <span class="icon">${getIcon('key')}</span>
            <span>Unlock Admin</span>
          </button>
        `
            : ''
        }
      </div>
    </div>

    <!-- Permission Tiers Grid -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <span class="icon">${getIcon('layers')}</span>
          <span>Configured Permission Tiers</span>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">
          ${isAdmin ? '<span style="color: var(--color-online);">● Admin View Active</span>' : 'Guest View (Snowflake IDs hidden)'}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem;">
        ${
          tiers.length > 0
            ? tiers
                .map((tier) => {
                  const badgeClass = getTierBadgeClass(tier.name);
                  return `
              <div style="background-color: var(--bg-surface-elevated); border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span class="badge ${badgeClass}">${escapeHtml(tier.name)}</span>
                  <span style="font-size: 0.6875rem; color: var(--text-dim); font-family: var(--font-mono);">Tier ${tier.level}</span>
                </div>
                <div style="font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.4;">
                  ${escapeHtml(tier.description)}
                </div>
                ${
                  isAdmin && tier.userIds && tier.userIds.length > 0
                    ? `
                  <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                    User IDs: <code style="color: var(--text-primary); font-size: 0.6875rem;">${escapeHtml(tier.userIds.join(', '))}</code>
                  </div>
                `
                    : ''
                }
                ${
                  isAdmin && tier.roleIds && tier.roleIds.length > 0
                    ? `
                  <div style="font-size: 0.75rem; color: var(--text-muted);">
                    Role IDs: <code style="color: var(--text-primary); font-size: 0.6875rem;">${escapeHtml(tier.roleIds.join(', '))}</code>
                  </div>
                `
                    : ''
                }
                ${
                  !isAdmin && tier.level > 0
                    ? `
                  <div style="font-size: 0.6875rem; color: var(--text-dim); margin-top: 0.25rem;">
                    <span class="icon" style="font-size: 0.625rem;">${getIcon('lock')}</span> Snowflake IDs protected
                  </div>
                `
                    : ''
                }
              </div>
            `;
                })
                .join('')
            : '<div style="color: var(--text-dim); padding: 1rem;">Loading permission tiers...</div>'
        }
      </div>
    </div>

    <!-- Commands Matrix Card -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <span class="icon">${getIcon('terminal')}</span>
          <span>Discord Command Authorization Matrix</span>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Slash Command</th>
              <th>Minimum Required Permission</th>
              <th>Minecraft Role Accessible?</th>
            </tr>
          </thead>
          <tbody>
            ${
              commands.length > 0
                ? commands
                    .map((cmd) => {
                      const isRestart = cmd.name === '/restart';
                      const badgeClass = getTierBadgeClass(cmd.requiredPermissionName);
                      return `
                  <tr>
                    <td>
                      <code style="font-weight: 600; color: var(--color-primary-text); font-size: 0.875rem;">
                        ${escapeHtml(cmd.name)}
                      </code>
                    </td>
                    <td>
                      <span class="badge ${badgeClass}">
                        ${escapeHtml(cmd.requiredPermissionName)}
                      </span>
                    </td>
                    <td>
                      ${
                        isRestart
                          ? `<span class="badge" style="background-color: var(--color-danger-bg); border-color: var(--color-danger); color: var(--color-danger-text); font-size: 0.75rem;">${getIcon('x')} No (Owner Only)</span>`
                          : `<span class="badge" style="background-color: var(--color-online-bg); border-color: var(--color-online); color: var(--color-online-text); font-size: 0.75rem;">${getIcon('check')} Allowed</span>`
                      }
                    </td>
                  </tr>
                `;
                    })
                    .join('')
                : '<tr><td colspan="3" style="text-align: center; padding: 1.5rem; color: var(--text-dim);">Loading command matrix...</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelector('#access-quick-unlock-btn')?.addEventListener('click', openAuthModal);
}

function getTierBadgeClass(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('owner')) return 'owner';
  if (n.includes('admin') || n.includes('minecraft')) return 'admin';
  if (n.includes('trusted')) return 'trusted';
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
