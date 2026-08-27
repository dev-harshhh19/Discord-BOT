import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer';
import { IAternosService, ServerState, QueueInfo } from '../../types';
import { config } from '../../config/env';
import { logger } from '../logger/WinstonLogger';
import {
  ATERNOS_SELECTORS,
  ATERNOS_URLS,
  CONSENT_SELECTORS,
  TYPING_DELAY_MS,
} from '../../config/selectors';
import { AternosError } from '../../utils/errors';
import { Mutex } from '../../utils/mutex';
import { sleep } from '../../utils/time';
import { chromiumPathIsValid, describePlatform, platform } from '../../config/platform';

puppeteer.use(StealthPlugin());

/** Errors that mean "the page navigated out from under us", not "something broke". */
function isNavigationRace(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('detached') ||
    msg.includes('Execution context was destroyed') ||
    msg.includes('Target closed') ||
    msg.includes('Session closed')
  );
}

/**
 * Drives the Aternos web panel through a single long-lived Puppeteer page.
 *
 * Concurrency: Puppeteer gives no safety guarantees for concurrent operations on
 * one `Page`. The background poller and Discord interaction handlers both call
 * into this service, so every public method acquires a mutex. Private helpers
 * assume the lock is already held and must never take it themselves.
 */
export class PuppeteerAternosService implements IAternosService {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private readonly mutex = new Mutex();
  private shuttingDown = false;
  /** Set when Aternos has served a bot challenge, so callers get a real reason. */
  private lastChallengeAt: Date | null = null;

  // ─── Public API (mutex-guarded) ─────────────────────────────────────────────

  async init(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      await this.ensureSession();
    }, config.browser.operationTimeoutMs);
  }

  async authenticate(): Promise<void> {
    await this.init();
  }

  async getPanelStatus(): Promise<ServerState> {
    return this.mutex.runExclusive(async () => {
      const page = await this.ensureSession();
      await this.ensureOnPanel(page);
      const text = await this.readStatusText(page);
      const state = this.parseStatusText(text);
      logger.debug(`Aternos panel status: "${text}" -> ${state}`);
      return state;
    }, config.browser.operationTimeoutMs);
  }

  async getQueueInfo(): Promise<QueueInfo | null> {
    return this.mutex.runExclusive(async () => {
      const page = await this.ensureSession();
      if (!this.isOnPanel(page)) return null;

      const position = await this.readText(page, ATERNOS_SELECTORS.QUEUE_POSITION);
      const estimatedTime = await this.readText(page, ATERNOS_SELECTORS.QUEUE_TIME);

      if (position === '' && estimatedTime === '') return null;
      return { position, estimatedTime };
    }, config.browser.operationTimeoutMs);
  }

  async startServer(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      const page = await this.ensureSession();
      await this.ensureOnPanel(page);

      const currentState = this.parseStatusText(await this.readStatusText(page));
      if (
        currentState === ServerState.ONLINE ||
        currentState === ServerState.STARTING ||
        currentState === ServerState.QUEUEING
      ) {
        logger.warn(`startServer called while server is ${currentState}; skipping.`);
        return;
      }

      // Try DOM button first, fall back to AJAX endpoint
      let started = false;
      try {
        await this.clickOrThrow(page, ATERNOS_SELECTORS.START_BUTTON, 'Start');
        logger.info('Clicked the Aternos Start button.');
        started = true;
      } catch (err) {
        logger.warn(`Start button click failed (${String(err)}); attempting AJAX start endpoint...`);
        started = await this.executeAjaxAction(page, 'start');
        if (!started) {
          throw err;
        }
      }

      // Aternos may interrupt with an EULA acceptance or a notification prompt.
      await this.clickIfPresent(page, ATERNOS_SELECTORS.EULA_ACCEPT, 'EULA acceptance', 5176);
      await this.clickIfPresent(
        page,
        ATERNOS_SELECTORS.NOTIFICATION_DISMISS,
        'notification prompt',
        5176,
      );
    }, config.browser.operationTimeoutMs);
  }

  async stopServer(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      const page = await this.ensureSession();
      await this.ensureOnPanel(page);

      // Support stopping while booting/starting as well as normal stopping
      let stopped = false;
      const stopSelectors = [
        ATERNOS_SELECTORS.STOP_BUTTON,
        '#stop',
        '.btn-stop',
        '.btn-danger',
        '[data-action="stop"]',
      ];

      for (const sel of stopSelectors) {
        stopped = await this.clickIfPresent(page, sel, 'Stop button', 2000);
        if (stopped) {
          logger.info(`Clicked the Aternos Stop button (selector: ${sel}).`);
          break;
        }
      }

      if (!stopped) {
        logger.info('Stop button not clickable in DOM; executing direct AJAX /ajax/server/stop...');
        stopped = await this.executeAjaxAction(page, 'stop');
      }

      if (!stopped) {
        throw new AternosError('Could not stop server: neither the Stop button nor AJAX endpoint succeeded.');
      }
    }, config.browser.operationTimeoutMs);
  }

  /**
   * Restarts the server using Aternos AJAX restart endpoint or sequential fallback.
   */
  async restartServer(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      const page = await this.ensureSession();
      await this.ensureOnPanel(page);

      logger.info('Executing Aternos server restart...');

      // Try direct AJAX restart endpoint first
      let restarted = await this.executeAjaxAction(page, 'restart');

      if (!restarted) {
        // Try restart button in DOM if present
        const restartSelectors = ['#restart', '.btn-restart', '[data-action="restart"]'];
        for (const sel of restartSelectors) {
          restarted = await this.clickIfPresent(page, sel, 'Restart button', 2000);
          if (restarted) {
            logger.info(`Clicked the Aternos Restart button (selector: ${sel}).`);
            break;
          }
        }
      }

      if (!restarted) {
        logger.info('Direct restart not available; falling back to stop + start sequence.');
        await this.executeAjaxAction(page, 'stop');
        await sleep(5000);
        await this.executeAjaxAction(page, 'start');
      }

      logger.info('Aternos server restart dispatched successfully.');
    }, config.browser.operationTimeoutMs);
  }

  async confirmQueue(): Promise<boolean> {
    return this.mutex.runExclusive(async () => {
      const page = await this.ensureSession();
      await this.ensureOnPanel(page);

      const currentState = this.parseStatusText(await this.readStatusText(page));
      if (currentState !== ServerState.STARTING && currentState !== ServerState.QUEUEING) {
        return false;
      }

      // Preferred path: the confirmation button rendered in the panel.
      const clicked = await this.clickIfPresent(
        page,
        ATERNOS_SELECTORS.CONFIRM_BUTTON,
        'queue confirmation',
        5000,
      );
      if (clicked) {
        logger.info('Queue confirmed via the panel button.');
        return true;
      }

      // Fallback: call the same endpoint the panel's own JavaScript calls. The
      // page supplies the CSRF pair (SEC/TOKEN) on `window`.
      return this.confirmQueueViaAjax(page);
    }, config.browser.operationTimeoutMs);
  }

  /**
   * Reloads the Aternos panel webpage to flush cached DOM data and re-evaluate
   * the live server status and queue position.
   */
  async reloadPanel(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      const page = await this.ensureSession();
      try {
        logger.info('Reloading Aternos panel webpage to refresh state...');
        await page.reload({
          waitUntil: 'domcontentloaded',
          timeout: config.browser.navigationTimeoutMs,
        });
        await this.dismissConsentBanners(page);
        logger.info('Aternos panel webpage successfully reloaded.');
      } catch (err) {
        logger.warn(`Could not reload page directly (${String(err)}); navigating to panel instead.`);
        await this.navigateToPanel(page);
      }
    }, config.browser.operationTimeoutMs);
  }

  /** True when a browser session is live. Used by the health endpoint. */
  isReady(): boolean {
    return (
      this.browser !== null &&
      this.browser.isConnected() &&
      this.page !== null &&
      !this.page.isClosed()
    );
  }

  /** Timestamp of the most recent bot-challenge detection, if any. */
  getLastChallengeAt(): Date | null {
    return this.lastChallengeAt;
  }

  /**
   * Closes the browser.
   *
   * Called from the shutdown handler. Leaving Chromium running orphans the
   * process and leaves a lock file in the user-data directory, which makes the
   * *next* start fail — the failure mode that most often strands Termux
   * deployments after a crash.
   */
  async close(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;

    const browser = this.browser;
    this.browser = null;
    this.page = null;

    if (!browser) return;

    try {
      await Promise.race([browser.close(), sleep(10_000)]);
      logger.info('Aternos browser session closed.');
    } catch (err) {
      logger.warn(`Error while closing the browser: ${String(err)}`);
    }

    // `browser.close()` can hang if the renderer is wedged; make sure the OS
    // process is gone either way.
    try {
      const proc = browser.process();
      if (proc && proc.exitCode === null && !proc.killed) {
        proc.kill('SIGKILL');
        logger.debug('Force-killed the lingering Chromium process.');
      }
    } catch {
      // Nothing more we can do.
    }
  }

  /**
   * Forcibly destroys the current browser session to free memory, without permanently
   * shutting down the service. The next call to ensureSession() will launch a new browser.
   */
  async destroySession(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      if (!this.browser) return;
      logger.info('Destroying browser session to free memory...');
      const browser = this.browser;
      this.browser = null;
      this.page = null;
      
      try {
        await Promise.race([browser.close(), sleep(5_000)]);
      } catch {
        // Ignore
      }

      try {
        const proc = browser.process();
        if (proc && proc.exitCode === null && !proc.killed) {
          proc.kill('SIGKILL');
        }
      } catch {
        // Ignore
      }
    });
  }

  // ─── Session lifecycle (lock held) ──────────────────────────────────────────

  /** Returns a live page, creating or recreating the browser session as needed. */
  private async ensureSession(): Promise<Page> {
    if (this.shuttingDown) {
      throw new AternosError('The Aternos browser session is shutting down.');
    }

    if (this.isReady()) return this.page as Page;

    if (this.browser) {
      logger.warn('Browser or page is no longer usable; recreating the session.');
      const stale = this.browser;
      this.browser = null;
      this.page = null;
      await stale.close().catch(() => undefined);
    }

    logger.info(`Launching Chromium (${describePlatform()})...`);

    if (!chromiumPathIsValid(config.browser.executablePath)) {
      logger.warn(
        `PUPPETEER_EXECUTABLE_PATH points at "${String(config.browser.executablePath)}", ` +
        'which does not exist. Puppeteer will fall back to its bundled build ' +
        '(x64 only) and may fail on this machine.',
      );
    }

    let browser: Browser;
    try {
      browser = await puppeteer.launch({
        executablePath: config.browser.executablePath,
        headless: config.browser.headless,
        userDataDir: config.browser.userDataDir,
        args: config.browser.args,
        timeout: config.browser.navigationTimeoutMs,
      });
    } catch (err) {
      throw new AternosError(this.explainLaunchFailure(err));
    }

    try {
      const page = (await browser.pages())[0] ?? (await browser.newPage());
      await this.configurePage(page);

      this.browser = browser;
      this.page = page;

      browser.on('disconnected', () => {
        if (!this.shuttingDown) {
          logger.warn('Chromium disconnected unexpectedly; it will be relaunched on next use.');
        }
        this.browser = null;
        this.page = null;
      });

      await this.navigateToPanel(page);
      logger.info('Aternos browser session is ready.');
      return page;
    } catch (err) {
      await browser.close().catch(() => undefined);
      this.browser = null;
      this.page = null;
      throw err;
    }
  }

  /** Turns Chromium launch failures into messages that name the actual fix. */
  private explainLaunchFailure(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes('Could not find') || msg.includes('ENOENT')) {
      const install = platform.isTermux
        ? 'pkg install chromium'
        : platform.isDocker
          ? 'add chromium to your image'
          : 'apt install chromium (or chromium-browser)';
      return (
        `Chromium could not be launched on ${platform.kind}/${platform.arch}. ` +
        `Install a system Chromium (${install}) and set PUPPETEER_EXECUTABLE_PATH ` +
        `to its full path. Original error: ${msg}`
      );
    }

    if (msg.includes('Failed to move to new namespace') || msg.includes('No usable sandbox')) {
      return (
        'Chromium could not initialise its sandbox. Set PUPPETEER_NO_SANDBOX=true ' +
        `if this host cannot provide user namespaces. Original error: ${msg}`
      );
    }

    if (msg.includes('SingletonLock') || msg.includes('ProcessSingleton')) {
      return (
        `The browser profile at ${config.browser.userDataDir} is locked by another ` +
        'process. Stop any other instance of the bot, or delete the SingletonLock ' +
        `file in that directory. Original error: ${msg}`
      );
    }

    return `Failed to launch Chromium: ${msg}`;
  }

  private async configurePage(page: Page): Promise<void> {
    page.setDefaultTimeout(config.browser.selectorTimeoutMs);
    page.setDefaultNavigationTimeout(config.browser.navigationTimeoutMs);

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(config.browser.userAgent);

    // RESOURCE OPTIMIZATION (Essential for Render Free Tier)
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      const url = request.url().toLowerCase();

      // Cloudflare Turnstile strictly requires its own assets to pass the challenge
      if (url.includes('cloudflare') || url.includes('turnstile')) {
        request.continue().catch(() => {});
        return;
      }
      
      // Block heavy visual resources that the bot doesn't need to read DOM text
      if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
        request.abort().catch(() => {});
      } 
      // Block ads and analytics trackers that eat CPU and memory
      else if (
        url.includes('googleads') || 
        url.includes('doubleclick') || 
        url.includes('analytics') ||
        url.includes('quantserve') ||
        url.includes('scorecardresearch') ||
        url.includes('tracking')
      ) {
        request.abort().catch(() => {});
      }
      else {
        request.continue().catch(() => {});
      }
    });

    await page.evaluateOnNewDocument(`
      (function() {
        try {
          window.__name = window.__name || function(target) { return target; };
          Object.defineProperty(navigator, 'webdriver', { get: function() { return undefined; } });
          window.chrome = window.chrome || { runtime: {} };
          Object.defineProperty(navigator, 'languages', { get: function() { return ['en-US', 'en']; } });
          Object.defineProperty(navigator, 'plugins', { get: function() { return [1, 2, 3, 4, 5]; } });
        } catch (e) {}
      })();
    `);

    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error' || type === 'warn') {
        logger.debug(`[browser] ${type}: ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => {
      logger.debug(`[browser] uncaught: ${err.message}`);
    });
  }

  // ─── Navigation (lock held) ─────────────────────────────────────────────────

  private isOnPanel(page: Page): boolean {
    try {
      const url = page.url();
      return url.includes('/server') && !url.includes('/servers');
    } catch {
      return false;
    }
  }

  private async ensureOnPanel(page: Page): Promise<void> {
    if (!this.isOnPanel(page)) {
      await this.navigateToPanel(page);
    } else {
      await this.selectServerIfOnServerList(page);
    }
  }

  /** Navigate to a URL, tolerating client-side redirects that detach the frame. */
  private async safeGoto(page: Page, url: string): Promise<void> {
    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: config.browser.navigationTimeoutMs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isNavigationRace(err)) {
        logger.debug(`Navigation race on ${url} (${msg}); waiting for the new document.`);
        await page
          .waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10_000 })
          .catch(() => undefined);
      } else if (msg.includes('Navigation timeout')) {
        logger.debug(`Navigation to ${url} timed out; continuing with whatever loaded.`);
      } else {
        throw err;
      }
    }
  }

  /** If the account lands on the multi-server list (/servers/), clicks the target server card. */
  private async selectServerIfOnServerList(page: Page): Promise<void> {
    try {
      const url = page.url();
      if (!url.includes('/servers')) return;

      logger.info('Account has multiple servers; selecting target server card.');
      const targetId = config.aternos.serverId;

      await page.waitForSelector('.server-body, .servercard', { timeout: 10_000 });

      const clicked = await page.evaluate((id) => {
        let el: Element | null = null;
        if (id) {
          el =
            document.querySelector(`[data-id="${id}"]`) ||
            document.querySelector(`.servercard[data-id="${id}"]`) ||
            document.querySelector(`.server-body[data-id="${id}"]`);
        }
        if (!el && id) {
          const cards = Array.from(document.querySelectorAll('.server-body, .servercard'));
          el = cards.find((c) => (c as HTMLElement).innerText && (c as HTMLElement).innerText.includes(id)) ?? null;
        }
        if (!el) {
          el = document.querySelector('.server-body, .servercard');
        }
        if (el && 'click' in el && typeof (el as HTMLElement).click === 'function') {
          (el as HTMLElement).click();
          return true;
        }
        return false;
      }, targetId);

      if (clicked) {
        logger.debug('Clicked server card, waiting for server panel to load.');
        await page
          .waitForSelector(
            `${ATERNOS_SELECTORS.START_BUTTON}, ${ATERNOS_SELECTORS.STOP_BUTTON}, ${ATERNOS_SELECTORS.RESTART_BUTTON}, ${ATERNOS_SELECTORS.STATUS_LABEL}`,
            { timeout: config.browser.selectorTimeoutMs },
          )
          .catch(() => undefined);
      }
    } catch (err) {
      logger.warn(`Error selecting server from list: ${String(err)}`);
    }
  }

  /** Lands on the server panel, authenticating and seeding cookies as required. */
  private async navigateToPanel(page: Page): Promise<void> {
    // Cookies can only be set once an aternos.org document is loaded.
    await this.safeGoto(page, ATERNOS_URLS.ORIGIN);
    await this.dismissConsentBanners(page);
    await this.seedCookies(page);

    const target =
      config.aternos.serverId !== '' ? config.aternos.serverUrl : ATERNOS_URLS.SERVER_PANEL;
    await this.safeGoto(page, target);

    if (this.needsLogin(page)) {
      logger.info('Aternos session is not authenticated; logging in.');
      await this.performLogin(page);
      await this.safeGoto(page, target);
    }

    await this.selectServerIfOnServerList(page);

    // Give Cloudflare / the SPA a chance to render the status label or control buttons.
    try {
      await page.waitForSelector(
        `${ATERNOS_SELECTORS.STATUS_LABEL}, ${ATERNOS_SELECTORS.START_BUTTON}, ${ATERNOS_SELECTORS.STOP_BUTTON}, ${ATERNOS_SELECTORS.RESTART_BUTTON}`,
        {
          timeout: config.browser.selectorTimeoutMs,
        },
      );
      this.lastChallengeAt = null;
      logger.debug('Aternos server panel loaded.');
    } catch {
      if (await this.detectChallenge(page)) {
        this.lastChallengeAt = new Date();
        logger.warn(
          'Aternos served a bot challenge (Cloudflare/Turnstile). Status reads will fail ' +
          'until it clears. On a headless VPS, running headful under Xvfb usually helps.',
        );
      } else {
        logger.warn('Aternos status label did not appear; the panel may have changed.');
      }
    }
  }

  private needsLogin(page: Page): boolean {
    let url = '';
    try {
      url = page.url();
    } catch {
      return false;
    }
    return url.includes('/login') || url.includes('/go/?target') || url.endsWith('/go/');
  }

  private async seedCookies(page: Page): Promise<void> {
    const cookies: { name: string; value: string; domain: string; path: string }[] = [];

    if (config.aternos.serverId !== '') {
      cookies.push({
        name: 'ATERNOS_SERVER',
        value: config.aternos.serverId,
        domain: '.aternos.org',
        path: '/',
      });
    }
    if (config.aternos.session !== undefined) {
      cookies.push({
        name: 'ATERNOS_SESSION',
        value: config.aternos.session,
        domain: '.aternos.org',
        path: '/',
      });
    }

    for (const cookie of cookies) {
      try {
        await page.setCookie(cookie);
        logger.debug(`Seeded cookie ${cookie.name}.`);
      } catch (err) {
        logger.warn(`Failed to set the ${cookie.name} cookie: ${String(err)}`);
      }
    }
  }

  /** Detects an interstitial bot challenge in place of the expected panel. */
  private async detectChallenge(page: Page): Promise<boolean> {
    try {
      return await page.evaluate(() => {
        const title = document.title || '';
        if (title.includes('Just a moment') || title.includes('Attention Required')) return true;
        const markers = [
          '#challenge-running',
          '#cf-challenge-running',
          'iframe[src*="challenges.cloudflare.com"]',
          '.cf-turnstile',
        ];
        return markers.some((selector) => document.querySelector(selector) !== null);
      });
    } catch {
      return false;
    }
  }

  private async performLogin(page: Page): Promise<void> {
    await this.dismissConsentBanners(page);

    try {
      await page.waitForSelector(ATERNOS_SELECTORS.LOGIN_USERNAME, {
        timeout: config.browser.selectorTimeoutMs,
      });
    } catch {
      if (await this.detectChallenge(page)) {
        this.lastChallengeAt = new Date();
        throw new AternosError(
          'The Aternos login page is behind a bot challenge. Set ATERNOS_SESSION with a ' +
          'cookie captured from a real browser session, or run headful under Xvfb.',
        );
      }
      throw new AternosError('The Aternos login form did not load; the page layout may have changed.');
    }

    await page.click(ATERNOS_SELECTORS.LOGIN_USERNAME, { clickCount: 3 });
    await page.type(ATERNOS_SELECTORS.LOGIN_USERNAME, config.aternos.username, {
      delay: TYPING_DELAY_MS,
    });

    await page.click(ATERNOS_SELECTORS.LOGIN_PASSWORD, { clickCount: 3 });
    await page.type(ATERNOS_SELECTORS.LOGIN_PASSWORD, config.aternos.password, {
      delay: TYPING_DELAY_MS,
    });

    await page.click(ATERNOS_SELECTORS.LOGIN_BUTTON);

    try {
      await page.waitForFunction(
        (errorSelector: string) =>
          window.location.href.includes('/server') ||
          document.querySelector(errorSelector) !== null,
        { timeout: config.browser.navigationTimeoutMs },
        ATERNOS_SELECTORS.LOGIN_ERROR,
      );
    } catch (err) {
      if (!isNavigationRace(err)) {
        throw new AternosError(
          `The Aternos login did not complete in time; a CAPTCHA may be blocking it: ${String(err)}`,
        );
      }
      // A destroyed execution context here means the redirect fired — success.
      await sleep(1500);
    }

    // A visible error element means the credentials were rejected. A detached
    // frame at this point means we already navigated away, which is success.
    try {
      const loginError = await page.$(ATERNOS_SELECTORS.LOGIN_ERROR);
      if (loginError && (await loginError.isIntersectingViewport())) {
        throw new AternosError(
          'Aternos rejected the login. Check ATERNOS_USERNAME and ATERNOS_PASSWORD, ' +
          'and confirm the account is not locked.',
        );
      }
    } catch (err) {
      if (err instanceof AternosError) throw err;
      if (!isNavigationRace(err)) throw err;
      await sleep(1500);
    }

    logger.info('Authenticated with Aternos.');
  }

  private async dismissConsentBanners(page: Page): Promise<void> {
    const selectors = [
      ...CONSENT_SELECTORS,
      ATERNOS_SELECTORS.CLOSE_MODAL_BUTTON,
    ];

    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element && (await element.isIntersectingViewport())) {
          await element.click();
          await sleep(400);
          logger.debug(`Dismissed a banner matching ${selector}.`);
        }
      } catch {
        // Banner absent or already gone.
      }
    }
  }

  // ─── DOM reads and clicks (lock held) ───────────────────────────────────────

  private async readText(page: Page, selector: string): Promise<string> {
    try {
      return await page.$eval(selector, (el: Element) => el.textContent?.trim() ?? '');
    } catch {
      return '';
    }
  }

  /**
   * Reads the status label, retrying only for navigation races.
   *
   * With the mutex in place these should be rare (they were previously caused by
   * the poller and command handlers sharing the page), so the retry budget is
   * small.
   */
  private async readStatusText(page: Page, retries = 3): Promise<string> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await page.waitForSelector(ATERNOS_SELECTORS.STATUS_LABEL, {
          timeout: config.browser.selectorTimeoutMs,
        });
        const text = await page.$eval(
          ATERNOS_SELECTORS.STATUS_LABEL,
          (el: Element) => el.textContent ?? '',
        );
        return text.trim().toLowerCase();
      } catch (err) {
        if (isNavigationRace(err) && attempt < retries) {
          logger.debug(`Status read hit a navigation race (${attempt}/${retries}); retrying.`);
          await sleep(1500);
          continue;
        }
        logger.warn(`Could not read the Aternos status label: ${String(err)}`);
        return 'unknown';
      }
    }
    return 'unknown';
  }

  private async clickOrThrow(page: Page, selector: string, label: string): Promise<void> {
    try {
      await page.waitForSelector(selector, { timeout: config.browser.selectorTimeoutMs });
      await page.click(selector);
    } catch (err) {
      throw new AternosError(
        `Could not click the Aternos ${label} button. The panel layout may have changed — ` +
        `override the selector with SELECTOR_${label.toUpperCase()}_BUTTON in .env. ` +
        `(${String(err)})`,
      );
    }
  }

  private async clickIfPresent(
    page: Page,
    selector: string,
    label: string,
    timeoutMs: number,
  ): Promise<boolean> {
    try {
      const element = await page.waitForSelector(selector, { timeout: timeoutMs });
      if (!element) return false;
      await element.click();
      logger.debug(`Handled the ${label}.`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Executes a native Aternos AJAX action (/ajax/server/start, /ajax/server/stop, /ajax/server/restart)
   * using the session tokens (SEC, TOKEN) and SERVER id available on window.
   */
  private async executeAjaxAction(page: Page, action: 'start' | 'stop' | 'restart'): Promise<boolean> {
    try {
      const success = await page.evaluate(async (act: string, serverId: string) => {
        const w = window as unknown as { TOKEN?: unknown; SEC?: unknown; aternos?: { server?: { id?: string } } };
        if (typeof w.TOKEN !== 'string' || typeof w.SEC !== 'string') return false;

        const params = new URLSearchParams({ SEC: w.SEC, TOKEN: w.TOKEN });
        const targetServer = serverId || (typeof w.aternos?.server?.id === 'string' ? w.aternos.server.id : '');
        if (targetServer !== '') params.set('SERVER', targetServer);

        const res = await fetch(`/ajax/server/${act}?${params.toString()}`, {
          credentials: 'include',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
          },
        });
        return res.ok;
      }, action, config.aternos.serverId);

      if (success) {
        logger.info(`Aternos AJAX action /ajax/server/${action} accepted.`);
        return true;
      }
      logger.debug(`Aternos AJAX action /ajax/server/${action} was not accepted.`);
      return false;
    } catch (err) {
      logger.debug(`AJAX action /ajax/server/${action} failed: ${String(err)}`);
      return false;
    }
  }

  private async confirmQueueViaAjax(page: Page): Promise<boolean> {
    try {
      const confirmed = await page.evaluate(async (serverId: string) => {
        const w = window as unknown as { TOKEN?: unknown; SEC?: unknown };
        if (typeof w.TOKEN !== 'string' || typeof w.SEC !== 'string') return false;

        const params = new URLSearchParams({ SEC: w.SEC, TOKEN: w.TOKEN });
        if (serverId !== '') params.set('SERVER', serverId);

        const res = await fetch(`/ajax/server/confirm-queue?${params.toString()}`, {
          credentials: 'include',
        });
        return res.ok;
      }, config.aternos.serverId);

      if (confirmed) {
        logger.info('Queue confirmed via the Aternos AJAX endpoint.');
        return true;
      }
      logger.debug('AJAX queue confirmation was not accepted.');
      return false;
    } catch (err) {
      logger.debug(`AJAX queue confirmation failed: ${String(err)}`);
      return false;
    }
  }

  /** Maps the panel's status text onto the internal state enum. */
  private parseStatusText(text: string): ServerState {
    const t = text.trim().toLowerCase();
    if (!t) return ServerState.UNKNOWN;

    // Check transient / active transition states first
    if (
      t.includes('starting') ||
      t.includes('loading') ||
      t.includes('preparing') ||
      t.includes('booting')
    ) {
      return ServerState.STARTING;
    }
    if (t.includes('stopping') || t.includes('saving')) {
      return ServerState.STOPPING;
    }
    if (t.includes('queue') || t.includes('waiting') || t.includes('in queue')) {
      return ServerState.QUEUEING;
    }
    if (t.includes('crash')) {
      return ServerState.CRASHED;
    }
    if (t.includes('offline') || t.includes('stopped')) {
      return ServerState.OFFLINE;
    }
    // Only match online if it explicitly contains the whole word online and no starting/offline flags
    if (/\bonline\b/.test(t) || t === 'online') {
      return ServerState.ONLINE;
    }
    return ServerState.UNKNOWN;
  }
}
