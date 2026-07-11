/**
 * Aternos CSS Selectors — stored as constants for rapid patching
 * if the Aternos UI updates (per PRD section 5.4 failure mitigation).
 */
export const ATERNOS_SELECTORS = {
  // Login page
  LOGIN_USERNAME: '#user',
  LOGIN_PASSWORD: '#password',
  LOGIN_BUTTON: '.login-button',
  LOGIN_ERROR: '.login-error',

  // Server panel status
  STATUS_LABEL: '.statuslabel-label',
  STATUS_CLASS_CONTAINER: '.server-status',

  // Action buttons
  START_BUTTON: '.btn-start',
  STOP_BUTTON: '.btn-stop',

  // Queue
  CONFIRM_QUEUE_BUTTON: '.btn-confirm',
  QUEUE_POSITION: '.queue-position',
  QUEUE_TIME: '.queue-time',

  // Modals / popups
  MODAL_CONFIRM_BUTTON: '.btn-success',
  CLOSE_MODAL_BUTTON: '.modal-close',

  // Server info
  SERVER_ADDRESS: '.server-ip .copy',
} as const;

/**
 * Aternos page URLs
 */
export const ATERNOS_URLS = {
  LOGIN: 'https://aternos.org/go/',
  SERVER_BASE: 'https://aternos.org/server/',
} as const;

/**
 * Timing constants for Puppeteer automation (in milliseconds)
 * Calibrated for India → Europe latency (140-200ms per PRD)
 */
export const PUPPETEER_TIMING = {
  /** Delay between keystrokes when typing credentials (simulates human) */
  TYPING_DELAY_MS: 80,
  /** Wait after page navigation before querying DOM */
  NAVIGATION_TIMEOUT_MS: 30_000,
  /** Wait for selector to appear in DOM */
  SELECTOR_TIMEOUT_MS: 15_000,
  /** Delay after button click before checking result */
  POST_CLICK_DELAY_MS: 2_000,
} as const;
