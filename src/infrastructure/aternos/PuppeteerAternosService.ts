import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import { IAternosService, ServerState, QueueInfo } from '../../types';
import { config } from '../../config/env';
import { logger } from '../logger/WinstonLogger';
import { ATERNOS_SELECTORS, PUPPETEER_TIMING } from '../../config/selectors';
import { AternosError } from '../../utils/errors';

puppeteer.use(StealthPlugin());

/** Sleep helper — replaces deprecated page.waitForTimeout() */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Navigate to a URL, tolerating the "frame detached" race condition that can occur on SPAs */
async function safeGoto(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: PUPPETEER_TIMING.NAVIGATION_TIMEOUT_MS,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('detached') || msg.includes('Execution context was destroyed')) {
      logger.debug(`safeGoto caught navigation race on ${url}: ${msg}. Waiting for new frame...`);
      // A client-side redirect interrupted the goto. Wait for it to finish so the frame attaches.
      try {
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 });
      } catch {
        // Ignore timeout
      }
    } else if (msg.includes('Navigation timeout')) {
      logger.debug(`safeGoto timeout on ${url}. Proceeding anyway.`);
    } else {
      throw err;
    }
  }
}

export class PuppeteerAternosService implements IAternosService {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async init(): Promise<void> {
    if (this.browser && this.page) return;
    logger.info('Initializing persistent Aternos browser session...');
    try {
      const [browser, page] = await this.createBrowserSession();
      this.browser = browser;
      this.page = page;
      await this.navigateToAternos(page);
      logger.info('Persistent Aternos browser session is ready.');
    } catch (err) {
      logger.error(`Failed to initialize Aternos session: ${String(err)}`);
      if (this.browser) await this.browser.close().catch(() => {});
      this.browser = null;
      this.page = null;
      throw err;
    }
  }

  private async getPage(): Promise<Page> {
    if (!this.browser || !this.browser.isConnected() || !this.page || this.page.isClosed()) {
      logger.warn('Browser or page disconnected, recreating session...');
      if (this.browser) await this.browser.close().catch(() => {});
      this.browser = null;
      this.page = null;
      await this.init();
    }
    return this.page!;
  }

  async authenticate(): Promise<void> {
    await this.init();
    logger.info('Aternos authentication test completed.');
  }

  /** Navigate to Aternos and ensure we land on the server page, handling logins and redirects */
  private async navigateToAternos(page: Page): Promise<void> {
    logger.debug('Preparing to navigate to Aternos...');
    
    // 1. Navigate to the root domain first to ensure setCookie works without throwing TargetCloseError
    await safeGoto(page, 'https://aternos.org/');

    // 2. Force the server ID cookie and session cookie to avoid /go/ redirects and logins
    const match = config.ATERNOS_SERVER_URL.match(/\/go\/([A-Za-z0-9_]+)/);
    if (match) {
      try {
        await page.setCookie({
          name: 'ATERNOS_SERVER',
          value: match[1],
          domain: 'aternos.org',
          path: '/',
        });
      } catch (err) {
        logger.warn(`Failed to set ATERNOS_SERVER cookie: ${String(err)}`);
      }
    }
    
    if (config.ATERNOS_SESSION) {
      try {
        await page.setCookie({
          name: 'ATERNOS_SESSION',
          value: config.ATERNOS_SESSION,
          domain: 'aternos.org',
          path: '/',
        });
        logger.debug('Injected ATERNOS_SESSION cookie.');
      } catch (err) {
        logger.warn(`Failed to set ATERNOS_SESSION cookie: ${String(err)}`);
      }
    }

    // 3. Navigate directly to the server panel
    await safeGoto(page, 'https://aternos.org/server/');
    
    // 3. Check if we got bounced to login
    let currentUrl = '';
    for (let i = 0; i < 15; i++) {
      try {
        currentUrl = page.url();
        if (currentUrl) break; // Frame is attached
      } catch {
        await sleep(500);
      }
    }

    if (currentUrl.includes('/login') || currentUrl.includes('/go/?target')) {
      logger.debug('Login required. Redirecting to authentication flow...');
      await this.authenticatePage(page);
      
      logger.debug('Authentication successful. Navigating back to target server URL...');
      await safeGoto(page, 'https://aternos.org/server/');
    }

    // 4. Wait for the status label to appear to ensure Cloudflare/loading is done
    try {
      await page.waitForSelector(ATERNOS_SELECTORS.STATUS_LABEL, { timeout: 15000 });
      logger.debug('Server panel loaded successfully.');
    } catch {
      logger.debug('Status label not found after navigation. Could be stuck on Turnstile.');
    }
  }

  async getPanelStatus(): Promise<ServerState> {
    const page = await this.getPage();
    
    // Ensure we are on the server page
    if (!page.url().includes('/server')) {
      await this.navigateToAternos(page);
    }
    
    const text = await this.getStatusText(page);
    const state = this.parseStatusText(text);
    logger.info(`Aternos panel status: "${text}" -> ${state}`);
    return state;
  }

  async getQueueInfo(): Promise<QueueInfo | null> {
    const page = await this.getPage();
    if (!page.url().includes('/server')) {
      return null;
    }

    try {
      const position = await page.$eval(
        ATERNOS_SELECTORS.QUEUE_POSITION,
        (el: Element) => el.textContent?.trim() ?? '',
      ).catch(() => '');

      const estimatedTime = await page.$eval(
        ATERNOS_SELECTORS.QUEUE_TIME,
        (el: Element) => el.textContent?.trim() ?? '',
      ).catch(() => '');

      if (!position && !estimatedTime) return null;

      return { position, estimatedTime };
    } catch {
      return null;
    }
  }

  async startServer(): Promise<void> {
    const page = await this.getPage();

    // Ensure we are on the server page
    if (!page.url().includes('/server')) {
      await this.navigateToAternos(page);
    }

    const statusText = await this.getStatusText(page);
    const currentState = this.parseStatusText(statusText);

    if (currentState === ServerState.ONLINE) {
      logger.warn('startServer called but server is already ONLINE. Skipping.');
      return;
    }
    if (currentState === ServerState.STARTING || currentState === ServerState.QUEUEING) {
      logger.warn(`startServer called but server is already ${currentState}. Skipping.`);
      return;
    }
    
    logger.debug('Clicking the START button on the Aternos DOM...');
    try {
      await page.waitForSelector('#start', { timeout: 10000 });
      await page.click('#start');
      logger.info('Clicked #start button.');
    } catch (err) {
      logger.error(`Failed to click #start button: ${String(err)}`);
      throw new Error('Failed to find or click the Aternos Start button. The UI might have changed.');
    }

    // Aternos often shows a EULA prompt after clicking start
    try {
      const acceptEulaBtn = await page.waitForSelector('.btn-success[id="accept-eula"], .btn-success[href*="eula"]', { timeout: 3000 });
      if (acceptEulaBtn) {
        await acceptEulaBtn.click();
        logger.info('Accepted EULA prompt automatically.');
      }
    } catch {
      // ignore, EULA prompt didn't appear
    }

    // Aternos often shows a notification prompt (Allow notifications -> continue without)
    try {
      const continueBtn = await page.waitForSelector('.btn-danger[onclick*="notification"]', { timeout: 3000 });
      if (continueBtn) {
        await continueBtn.click();
        logger.info('Dismissed notifications prompt automatically.');
      }
    } catch {
      // ignore
    }
  }

  async stopServer(): Promise<void> {
    const page = await this.getPage();

    // Ensure we are on the server page
    if (!page.url().includes('/server')) {
      await this.navigateToAternos(page);
    }

    logger.debug('Clicking the STOP button on the Aternos DOM...');
    try {
      await page.waitForSelector('#stop', { timeout: 10000 });
      await page.click('#stop');
      logger.info('Clicked #stop button.');
    } catch (err) {
      logger.error(`Failed to click #stop button: ${String(err)}`);
      throw new Error('Failed to find or click the Aternos Stop button.');
    }
  }

  async confirmQueue(): Promise<boolean> {
    const page = await this.getPage();

    // Ensure we are on the server page
    if (!page.url().includes('/server')) {
      await this.navigateToAternos(page);
    }

    const statusText = await this.getStatusText(page);
    const currentState = this.parseStatusText(statusText);
    
    // If we aren't starting or queuing, we probably don't need to confirm
    if (currentState !== ServerState.STARTING && currentState !== ServerState.QUEUEING) {
      return false;
    }
    logger.debug('Clicking the CONFIRM button on the Aternos DOM...');
    try {
      await page.waitForSelector('#confirm', { timeout: 5000 });
      await page.click('#confirm');
      logger.info('Clicked #confirm button (Queue confirmed!).');
      return true;
    } catch (err) {
      logger.debug(`Could not click #confirm button (maybe it's not present yet): ${String(err)}`);
      return false;
    }
  }

  /** Create a fresh browser session, authenticated to Aternos */
  private async createBrowserSession(): Promise<[Browser, Page]> {
    const browser = await (puppeteer).launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      headless: config.PUPPETEER_HEADLESS,
      userDataDir: './aternos-session',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--remote-debugging-port=9222',
        '--remote-debugging-address=0.0.0.0',
        '--no-zygote',
        '--single-process',
      ],
    });

    const page = await browser.newPage();
    
    // Log browser console and errors to the terminal
    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error' || type === 'warn' || type === 'info') {
        logger.debug(`[Browser UI] ${type.toUpperCase()}: ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => {
      logger.error(`[Browser UI] Uncaught Exception: ${err.message}`);
    });
    page.on('requestfailed', (req) => {
      logger.debug(`[Browser UI] Request Failed: ${req.url()} (${req.failure()?.errorText})`);
    });
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    );

    return [browser, page];
  }

  /** Authenticate on the Aternos login page */
  private async authenticatePage(page: Page): Promise<void> {
    logger.info('Authenticating with Aternos...');

    await this.dismissModals(page);

    await page.waitForSelector(ATERNOS_SELECTORS.LOGIN_USERNAME, {
      timeout: PUPPETEER_TIMING.SELECTOR_TIMEOUT_MS,
    });

    await page.click(ATERNOS_SELECTORS.LOGIN_USERNAME, { clickCount: 3 });
    await page.type(ATERNOS_SELECTORS.LOGIN_USERNAME, config.ATERNOS_USERNAME, {
      delay: PUPPETEER_TIMING.TYPING_DELAY_MS,
    });

    await page.click(ATERNOS_SELECTORS.LOGIN_PASSWORD, { clickCount: 3 });
    await page.type(ATERNOS_SELECTORS.LOGIN_PASSWORD, config.ATERNOS_PASSWORD, {
      delay: PUPPETEER_TIMING.TYPING_DELAY_MS,
    });

    await page.click(ATERNOS_SELECTORS.LOGIN_BUTTON);

    // Wait for navigation or state change — Aternos often uses SPA routing or has CAPTCHAs
    try {
      await page.waitForFunction(
        () => {
          return window.location.href.includes('/server') || 
                 document.querySelector('.login-error') !== null;
        },
        { timeout: PUPPETEER_TIMING.NAVIGATION_TIMEOUT_MS }
      );
    } catch (err: unknown) {
      const msg = String(err);
      if (!msg.includes('Execution context was destroyed') && !msg.includes('detached')) {
        throw new Error(`Aternos login timed out. A CAPTCHA might be blocking it: ${msg}`);
      }
      logger.debug('Login navigation triggered context destruction (success)');
    }

    try {
      const loginError = await page.$(ATERNOS_SELECTORS.LOGIN_ERROR);
      if (loginError) {
        const isVisible = await loginError.isIntersectingViewport();
        if (isVisible) {
          throw new AternosError(
            'Aternos login failed: Invalid credentials or account locked. ' +
              'Manual intervention required.',
          );
        }
      }
    } catch (err: unknown) {
      const msg = String(err);
      if (msg.includes('detached') || msg.includes('Execution context was destroyed')) {
        // Frame detached means the browser is navigating away from the login page.
        // This is a success state!
        logger.debug('Login frame detached (successful navigation expected).');
        await sleep(1500); // Give it time to load the next page
      } else {
        throw err;
      }
    }

    logger.info('Aternos authentication successful.');
  }

  /** Dismiss promotional modals, cookie banners, and EULA confirmations */
  private async dismissModals(page: Page): Promise<void> {
    const modalSelectors = [
      ATERNOS_SELECTORS.MODAL_CONFIRM_BUTTON,
      ATERNOS_SELECTORS.CLOSE_MODAL_BUTTON,
      '.fc-cta-consent', // Google CMP cookie banner
      '.fc-primary-button', // Google CMP alternative
      '.cc-btn.cc-allow', // Cookie consent
    ];

    for (const selector of modalSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const visible = await element.isIntersectingViewport();
          if (visible) {
            await element.click();
            await sleep(500);
            logger.debug(`Dismissed modal using selector: ${selector}`);
          }
        }
      } catch {
        // Modal not present — continue
      }
    }
  }

  /** Read the status label text from the Aternos panel DOM */
  private async getStatusText(page: Page, retries = 5): Promise<string> {
    for (let i = 0; i < retries; i++) {
      try {
        await page.waitForSelector(ATERNOS_SELECTORS.STATUS_LABEL, {
          timeout: PUPPETEER_TIMING.SELECTOR_TIMEOUT_MS,
        });
        const text = await page.$eval(
          ATERNOS_SELECTORS.STATUS_LABEL,
          (el: Element) => el.textContent ?? '',
        );
        return text.trim().toLowerCase();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if ((msg.includes('detached') || msg.includes('Execution context was destroyed')) && i < retries - 1) {
          logger.debug(`Retrying status text read due to frame detach (${i + 1}/${retries})...`);
          await sleep(2500);
          continue;
        }
        logger.warn(`Could not read Aternos status label: ${msg}`);
        return 'unknown';
      }
    }
    return 'unknown';
  }

  /** Map Aternos DOM status text to the internal ServerState enum */
  private parseStatusText(text: string): ServerState {
    if (text.includes('online')) return ServerState.ONLINE;
    if (text.includes('starting') || text.includes('loading') || text.includes('preparing'))
      return ServerState.STARTING;
    if (text.includes('queue') || text.includes('waiting')) return ServerState.QUEUEING;
    if (text.includes('stopping') || text.includes('saving')) return ServerState.STOPPING;
    if (text.includes('offline')) return ServerState.OFFLINE;
    if (text.includes('crash')) return ServerState.CRASHED;
    return ServerState.UNKNOWN;
  }
}
