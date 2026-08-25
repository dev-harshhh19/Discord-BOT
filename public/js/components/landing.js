import { getIcon } from '../icons.js';
import { store } from '../state.js';

export function renderLanding(container) {
  const state = store.getState();
  const server = state.status?.server || {};
  const serverName = server.name || 'TomMC-SMP Server';

  container.innerHTML = `
    <div class="landing-hero" style="text-align: center; padding: 4rem 1rem;">
      <h1 style="font-size: 2.5rem; margin-bottom: 1rem; color: var(--text-primary); font-weight: 700; letter-spacing: -0.05em;">Welcome to ${serverName}</h1>
      <p style="font-size: 1.125rem; color: var(--text-secondary); max-width: 600px; margin: 0 auto 2rem;">
        The ultimate Discord bot & server telemetry hub. Monitor your Minecraft server performance, manage active members, and securely control access in real-time.
      </p>
      
      <div style="display: flex; gap: 1rem; justify-content: center;">
        <button id="landing-dash-btn" class="btn btn-primary" style="padding: 0.75rem 1.5rem; font-size: 1rem; border-radius: var(--radius-md);">
          <span class="icon">${getIcon('server')}</span> Go to Dashboard
        </button>
        ${!state.isAdmin ? `
          <button id="landing-login-btn" class="btn btn-secondary" style="padding: 0.75rem 1.5rem; font-size: 1rem; border-radius: var(--radius-md);">
            <span class="icon">${getIcon('key')}</span> Admin Login
          </button>
        ` : ''}
      </div>
      
      <div style="margin-top: 4rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 2rem; text-align: left; max-width: 900px; margin-left: auto; margin-right: auto;">
        <div class="feature-card" style="background: var(--bg-surface-elevated); padding: 1.5rem; border-radius: var(--radius-lg); border: 1px solid var(--border-default);">
          <div style="color: var(--color-primary-text); margin-bottom: 1rem;">${getIcon('activity')}</div>
          <h3 style="margin-bottom: 0.5rem; font-size: 1.125rem;">Real-time Telemetry</h3>
          <p style="color: var(--text-muted); font-size: 0.875rem; line-height: 1.5;">Monitor CPU usage, active memory limits, and overall Minecraft server latency instantly.</p>
        </div>
        
        <div class="feature-card" style="background: var(--bg-surface-elevated); padding: 1.5rem; border-radius: var(--radius-lg); border: 1px solid var(--border-default);">
          <div style="color: var(--color-primary-text); margin-bottom: 1rem;">${getIcon('users')}</div>
          <h3 style="margin-bottom: 0.5rem; font-size: 1.125rem;">Member Management</h3>
          <p style="color: var(--text-muted); font-size: 0.875rem; line-height: 1.5;">Keep track of active Discord members, whitelist sync, and online players in the realm.</p>
        </div>
        
        <div class="feature-card" style="background: var(--bg-surface-elevated); padding: 1.5rem; border-radius: var(--radius-lg); border: 1px solid var(--border-default);">
          <div style="color: var(--color-primary-text); margin-bottom: 1rem;">${getIcon('shield')}</div>
          <h3 style="margin-bottom: 0.5rem; font-size: 1.125rem;">Secure Access</h3>
          <p style="color: var(--text-muted); font-size: 0.875rem; line-height: 1.5;">Enterprise-grade access controls and role-based permissions managed through a secure interface.</p>
        </div>
      </div>
      
      <div style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid var(--border-subtle); font-size: 0.875rem; color: var(--text-muted);">
        <a href="#" id="link-terms" style="margin: 0 1rem;">Terms of Service</a>
        <a href="#" id="link-privacy" style="margin: 0 1rem;">Privacy Policy</a>
      </div>
    </div>
  `;

  container.querySelector('#landing-dash-btn')?.addEventListener('click', () => store.setCurrentTab('overview'));
  container.querySelector('#landing-login-btn')?.addEventListener('click', () => store.setCurrentTab('login'));
  
  container.querySelector('#link-terms')?.addEventListener('click', (e) => {
    e.preventDefault();
    store.setCurrentTab('terms');
  });
  
  container.querySelector('#link-privacy')?.addEventListener('click', (e) => {
    e.preventDefault();
    store.setCurrentTab('privacy');
  });
}
