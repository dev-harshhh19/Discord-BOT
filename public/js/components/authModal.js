import { getIcon } from '../icons.js';
import { api } from '../api.js';
import { store } from '../state.js';
import { showToast } from './toast.js';

/**
 * Admin Password Authentication Modal Component
 */

let modalEl = null;

export function openAuthModal() {
  ensureModal();
  modalEl.classList.add('open');
  const input = modalEl.querySelector('#admin-password-input');
  if (input) {
    input.value = '';
    input.focus();
  }
}

export function closeAuthModal() {
  if (modalEl) {
    modalEl.classList.remove('open');
  }
}

function ensureModal() {
  if (modalEl) return modalEl;

  modalEl = document.createElement('div');
  modalEl.id = 'auth-modal-overlay';
  modalEl.className = 'modal-overlay';

  modalEl.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title">
          <span class="icon">${getIcon('lock')}</span>
          <span>Admin Authentication</span>
        </div>
        <button class="modal-close-btn" id="modal-close-btn" title="Close">
          ${getIcon('x')}
        </button>
      </div>
      <form id="admin-auth-form">
        <div class="modal-body">
          <p style="font-size: 0.8125rem; color: var(--text-secondary);">
            Enter the admin password configured in your environment (<code>DASHBOARD_ADMIN_PASSWORD</code>) to unlock server power controls, live terminal logs, and role management.
          </p>
          <div class="form-group">
            <label class="form-label" for="admin-password-input">Admin Password</label>
            <input
              type="password"
              id="admin-password-input"
              class="form-input"
              placeholder="Enter password..."
              autocomplete="current-password"
              required
            />
          </div>
          <div id="auth-error-msg" style="display: none; font-size: 0.75rem; color: var(--color-danger-text); background-color: var(--color-danger-bg); border: 1px solid var(--color-danger); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm);"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
          <button type="submit" class="btn btn-primary" id="modal-submit-btn">
            <span class="icon">${getIcon('key')}</span>
            <span>Unlock Admin Access</span>
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modalEl);

  // Close handlers
  modalEl.querySelector('#modal-close-btn')?.addEventListener('click', closeAuthModal);
  modalEl.querySelector('#modal-cancel-btn')?.addEventListener('click', closeAuthModal);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeAuthModal();
  });

  // Form submit
  const form = modalEl.querySelector('#admin-auth-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = modalEl.querySelector('#admin-password-input');
    const submitBtn = modalEl.querySelector('#modal-submit-btn');
    const errorBox = modalEl.querySelector('#auth-error-msg');

    const password = input?.value || '';
    if (!password) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Verifying...</span>`;
    errorBox.style.display = 'none';

    try {
      const res = await api.login(password);
      if (res.success && res.token) {
        store.setToken(res.token, true);
        showToast('Admin mode unlocked successfully!', 'success');
        closeAuthModal();
      } else {
        errorBox.textContent = res.error || 'Authentication failed.';
        errorBox.style.display = 'block';
      }
    } catch (err) {
      errorBox.textContent = 'Failed to connect to authentication endpoint.';
      errorBox.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span class="icon">${getIcon('key')}</span><span>Unlock Admin Access</span>`;
    }
  });

  return modalEl;
}
