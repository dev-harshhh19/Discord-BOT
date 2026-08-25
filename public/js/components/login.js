import { getIcon } from '../icons.js';
import { store } from '../state.js';
import { api } from '../api.js';
import { showToast } from './toast.js';

export function renderLogin(container) {
  const state = store.getState();

  if (state.isAdmin) {
    container.innerHTML = `
      <div style="max-width: 400px; margin: 4rem auto; text-align: center; background: var(--bg-surface-elevated); border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: 2rem;">
        <div style="color: var(--color-online); margin-bottom: 1rem;">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
        </div>
        <h2 style="font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--text-primary);">You are already logged in</h2>
        <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.875rem;">Your admin session is active.</p>
        <button id="login-dash-btn" class="btn btn-primary" style="width: 100%;">
          Go to Dashboard
        </button>
      </div>
    `;
    container.querySelector('#login-dash-btn')?.addEventListener('click', () => {
      store.setCurrentTab('overview');
    });
    return;
  }

  container.innerHTML = `
    <div style="max-width: 400px; margin: 4rem auto; background: var(--bg-surface-elevated); border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: 2rem; box-shadow: var(--shadow-lg);">
      <div style="text-align: center; margin-bottom: 2rem;">
        <div style="color: var(--text-primary); margin-bottom: 1rem; display: flex; justify-content: center;">
          ${getIcon('lock')}
        </div>
        <h2 style="font-size: 1.5rem; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-primary);">Admin Authentication</h2>
        <p style="color: var(--text-muted); font-size: 0.875rem;">Enter the administrative password to unlock power management actions.</p>
      </div>
      
      <form id="admin-login-form" style="display: flex; flex-direction: column; gap: 1rem;">
        <div class="form-group" style="display: flex; flex-direction: column; gap: 0.5rem;">
          <label for="admin-password" style="font-size: 0.875rem; color: var(--text-secondary); font-weight: 500;">Password</label>
          <input type="password" id="admin-password" placeholder="••••••••" required style="padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-default); background: var(--bg-input); color: var(--text-primary); font-size: 1rem;">
        </div>
        <button type="submit" id="admin-submit-btn" class="btn btn-primary" style="padding: 0.75rem; margin-top: 0.5rem; font-size: 1rem; border-radius: var(--radius-md); font-weight: 500;">
          Unlock Access
        </button>
      </form>
    </div>
  `;

  const form = container.querySelector('#admin-login-form');
  const pwdInput = container.querySelector('#admin-password');
  const btn = container.querySelector('#admin-submit-btn');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = pwdInput.value.trim();
    if (!pwd) return;

    btn.disabled = true;
    btn.innerHTML = `<span class="icon">${getIcon('refreshCw')}</span> Authenticating...`;

    try {
      const res = await api.login(pwd);
      if (res.success && res.token) {
        store.setToken(res.token, true);
        showToast('Admin access granted.', 'success');
        store.setCurrentTab('overview');
      } else {
        showToast(res.error || 'Authentication failed.', 'error');
        pwdInput.value = '';
        pwdInput.focus();
      }
    } catch (err) {
      showToast('A network error occurred.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `Unlock Access`;
    }
  });
  
  setTimeout(() => {
    pwdInput?.focus();
  }, 100);
}
