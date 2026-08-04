/**
 * Aternos DOM selectors.
 *
 * Aternos ships UI changes without notice, and a selector break takes the whole
 * bot down. Every selector is therefore overridable at runtime through a
 * `SELECTOR_<NAME>` environment variable, so a broken deployment can be patched
 * from `.env` without editing source, rebuilding, or waiting for a release.
 *
 *   SELECTOR_STATUS_LABEL=".new-status-class"
 *
 * Comma-separated lists are supported and tried in order, which lets a fix be
 * applied while keeping the old selector as a fallback.
 */

function selector(name: string, fallback: string): string {
  const override = process.env[`SELECTOR_${name}`]?.trim();
  return override && override !== '' ? override : fallback;
}

export const ATERNOS_SELECTORS = {
  // Login page
  LOGIN_USERNAME: selector('LOGIN_USERNAME', '#user'),
  LOGIN_PASSWORD: selector('LOGIN_PASSWORD', '#password'),
  LOGIN_BUTTON: selector('LOGIN_BUTTON', '.login-button'),
  LOGIN_ERROR: selector('LOGIN_ERROR', '.login-error'),

  // Server panel status
  STATUS_LABEL: selector('STATUS_LABEL', '.statuslabel-label, .status .statuslabel-label'),

  // Action buttons. Aternos uses ids here; the older `.btn-start` classes are
  // kept as trailing fallbacks.
  START_BUTTON: selector('START_BUTTON', '#start, .btn-start'),
  STOP_BUTTON: selector('STOP_BUTTON', '#stop, .btn-stop'),
  RESTART_BUTTON: selector('RESTART_BUTTON', '#restart, .btn-restart'),
  CONFIRM_BUTTON: selector('CONFIRM_BUTTON', '#confirm, .btn-confirm'),

  // Queue
  QUEUE_POSITION: selector('QUEUE_POSITION', '.queue-position, .server-status-label-queue'),
  QUEUE_TIME: selector('QUEUE_TIME', '.queue-time, .queue-waiting-time'),

  // Post-start prompts
  EULA_ACCEPT: selector('EULA_ACCEPT', '#accept-eula, .btn-success[href*="eula"]'),
  NOTIFICATION_DISMISS: selector(
    'NOTIFICATION_DISMISS',
    '.btn-danger[onclick*="notification"], .notification-decline',
  ),

  // Modals / consent banners
  MODAL_CONFIRM_BUTTON: selector('MODAL_CONFIRM_BUTTON', '.btn-success'),
  CLOSE_MODAL_BUTTON: selector('CLOSE_MODAL_BUTTON', '.modal-close'),
} as const;

/** Consent/cookie banners that must be dismissed before the panel is usable. */
export const CONSENT_SELECTORS: readonly string[] = [
  '.fc-cta-consent', // Google CMP
  '.fc-primary-button', // Google CMP (alternate layout)
  '.cc-btn.cc-allow', // cookieconsent.js
  '#onetrust-accept-btn-handler', // OneTrust
];

export const ATERNOS_URLS = {
  ORIGIN: 'https://aternos.org',
  LOGIN: 'https://aternos.org/go/',
  SERVER_PANEL: 'https://aternos.org/server/',
} as const;

/** Delay between simulated keystrokes when typing credentials. */
export const TYPING_DELAY_MS = 80;
