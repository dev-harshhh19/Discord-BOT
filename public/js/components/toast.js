import { getIcon } from '../icons.js';

/**
 * Toast Notification Component
 */

let container = null;

function ensureContainer() {
  if (!container) {
    container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
  }
  return container;
}

export function showToast(message, type = 'info', durationMs = 4000) {
  const c = ensureContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconName = type === 'success' ? 'check'
    : type === 'error' ? 'alertCircle'
    : type === 'warning' ? 'alertTriangle'
    : 'info';

  toast.innerHTML = `
    <span class="icon">${getIcon(iconName)}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;

  c.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
