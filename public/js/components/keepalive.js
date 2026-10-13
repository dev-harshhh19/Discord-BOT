import { api } from '../api.js';
import { getIcon } from '../icons.js';
import { store } from '../state.js';
import { showToast } from './toast.js';

/**
 * 24/7 Keep-Alive & Health API Hub Component
 * Dedicated to external monitors (cron-job.org & UptimeMonitor).
 * Zero internal self-looping to prevent booming the API internally.
 */

let keepAlivePollTimer = null;

export function renderKeepAlive(container) {
  const origin = window.location.origin;

  // Initial structure if container is empty or needs mount
  if (!container.querySelector('#keepalive-hub-content')) {
    container.innerHTML = `
      <div id="keepalive-hub-content" class="keepalive-container">
        <!-- Hero Header -->
        <div class="card" style="margin-bottom: 1.25rem;">
          <div class="card-header" style="flex-wrap: wrap; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.85rem;">
              <div class="stat-icon-wrapper" style="width: 2.75rem; height: 2.75rem; background: var(--bg-surface-elevated); color: var(--color-online);">
                ${getIcon('radio')}
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 0.65rem;">
                  <h2 style="font-family: var(--font-display); font-size: 1.25rem; font-weight: 700; margin: 0; color: var(--text-primary);">
                    24/7 Keep-Alive &amp; Health API
                  </h2>
                  <span class="status-pill online" id="keepalive-status-pill">
                    <span class="status-dot"></span>
                    <span id="keepalive-status-text">EXTERNAL MONITORS READY</span>
                  </span>
                </div>
                <div style="font-size: 0.8125rem; color: var(--text-muted); margin-top: 0.2rem;">
                  Optimized for <strong>cron-job.org</strong> and <strong>UptimeMonitor</strong> to keep the app alive 24/7 with zero internal overhead.
                </div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <button class="btn btn-secondary" id="keepalive-refresh-btn" type="button" style="padding: 0.45rem 0.85rem; font-size: 0.8125rem;">
                <span class="icon">${getIcon('refreshCw')}</span>
                <span>Refresh Metrics</span>
              </button>
              <button class="btn btn-primary" id="keepalive-send-ping-btn" type="button" style="padding: 0.45rem 0.95rem; font-size: 0.8125rem;">
                <span class="icon">${getIcon('activity')}</span>
                <span>Test Probe Once</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Telemetry Stats Grid -->
        <div class="stats-grid" style="margin-bottom: 1.25rem;">
          <div class="stat-card">
            <div class="stat-icon-wrapper" style="color: var(--color-online);">
              ${getIcon('heart')}
            </div>
            <div class="stat-content">
              <div class="stat-label">Health API Status</div>
              <div class="stat-value" id="stat-ka-status" style="color: var(--color-online-text); font-size: 1.25rem;">UP (200 OK)</div>
              <div class="stat-subtext" id="stat-ka-bot-ready">Discord Gateway: Active</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon-wrapper" style="color: var(--color-primary);">
              ${getIcon('activity')}
            </div>
            <div class="stat-content">
              <div class="stat-label">External Probes Logged</div>
              <div class="stat-value" id="stat-ka-total-pings" style="font-family: var(--font-mono); font-size: 1.25rem;">0</div>
              <div class="stat-subtext" id="stat-ka-last-source">Ready for cronjob.org / uptimemonitor</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon-wrapper" style="color: var(--color-info);">
              ${getIcon('clock')}
            </div>
            <div class="stat-content">
              <div class="stat-label">Latest External Probe</div>
              <div class="stat-value" id="stat-ka-last-time" style="font-size: 1.125rem;">--</div>
              <div class="stat-subtext" id="stat-ka-last-ip">Awaiting incoming ping</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon-wrapper" style="color: var(--color-online);">
              ${getIcon('shield')}
            </div>
            <div class="stat-content">
              <div class="stat-label">Internal Loop Status</div>
              <div class="stat-value" id="stat-ka-self-pinger" style="font-size: 1.125rem; color: var(--color-online-text);">Disabled (Zero Booming)</div>
              <div class="stat-subtext" id="stat-ka-self-next">100% External Monitoring Mode</div>
            </div>
          </div>
        </div>

        <!-- Primary URL Highlight Bar -->
        <div class="card" style="margin-bottom: 1.25rem;">
          <div class="card-header">
            <div class="card-title">
              <span class="icon" style="color: var(--color-primary);">${getIcon('globe')}</span>
              <span>Keep-Alive Health Probe URL</span>
            </div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">
              Plug this into cron-job.org or UptimeMonitor (responds 200 OK &amp; JSON telemetry)
            </span>
          </div>

          <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
              <div style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-primary-text);">
                Target URL (Use this in cron-job.org or UptimeMonitor)
              </div>
              <span class="badge everyone" style="font-family: var(--font-mono); font-size: 0.6875rem;">GET / HEAD</span>
            </div>

            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <input type="text" id="ka-primary-url-input" readonly value="${origin}/api/health" 
                style="flex: 1; min-width: 260px; font-family: var(--font-mono); font-size: 0.875rem; padding: 0.55rem 0.75rem; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-primary);" />
              <button class="btn btn-secondary" id="ka-copy-primary-btn" type="button" style="padding: 0.55rem 0.85rem; font-size: 0.8125rem;">
                <span class="icon">${getIcon('copy')}</span>
                <span>Copy URL</span>
              </button>
              <button class="btn btn-primary" id="ka-test-primary-btn" type="button" style="padding: 0.55rem 0.85rem; font-size: 0.8125rem;">
                <span class="icon">${getIcon('play')}</span>
                <span>Send One Probe</span>
              </button>
            </div>
          </div>

          <!-- Secondary/Alternative Endpoints Table -->
          <div style="overflow-x: auto;">
            <table class="table" style="width: 100%; border-collapse: collapse; font-size: 0.8125rem;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-subtle); text-align: left; color: var(--text-muted);">
                  <th style="padding: 0.6rem 0.75rem;">Probe Endpoint</th>
                  <th style="padding: 0.6rem 0.75rem;">Allowed Methods</th>
                  <th style="padding: 0.6rem 0.75rem;">Standard Purpose</th>
                  <th style="padding: 0.6rem 0.75rem; text-align: right;">Copy</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid var(--border-subtle);">
                  <td style="padding: 0.65rem 0.75rem; font-family: var(--font-mono); font-weight: 600; color: var(--color-primary-text);">${origin}/api/health</td>
                  <td style="padding: 0.65rem 0.75rem;"><span class="badge everyone">GET / HEAD</span></td>
                  <td style="padding: 0.65rem 0.75rem; color: var(--text-secondary);">Full telemetry payload for cron-job.org and UptimeMonitor</td>
                  <td style="padding: 0.65rem 0.75rem; text-align: right;">
                    <button class="btn btn-secondary ka-row-copy-btn" data-url="${origin}/api/health" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Copy</button>
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border-subtle);">
                  <td style="padding: 0.65rem 0.75rem; font-family: var(--font-mono); font-weight: 600; color: var(--color-primary-text);">${origin}/health</td>
                  <td style="padding: 0.65rem 0.75rem;"><span class="badge everyone">GET / HEAD</span></td>
                  <td style="padding: 0.65rem 0.75rem; color: var(--text-secondary);">Root health path for PaaS containers &amp; Docker</td>
                  <td style="padding: 0.65rem 0.75rem; text-align: right;">
                    <button class="btn btn-secondary ka-row-copy-btn" data-url="${origin}/health" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Copy</button>
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border-subtle);">
                  <td style="padding: 0.65rem 0.75rem; font-family: var(--font-mono); font-weight: 600; color: var(--color-primary-text);">${origin}/ping</td>
                  <td style="padding: 0.65rem 0.75rem;"><span class="badge everyone">GET / HEAD / POST</span></td>
                  <td style="padding: 0.65rem 0.75rem; color: var(--text-secondary);">Lightweight heartbeat endpoint for simple pingers</td>
                  <td style="padding: 0.65rem 0.75rem; text-align: right;">
                    <button class="btn btn-secondary ka-row-copy-btn" data-url="${origin}/ping" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Copy</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- External Setup Guides (cron-job.org & UptimeMonitor) -->
        <div class="card" style="margin-bottom: 1.25rem;">
          <div class="card-header">
            <div class="card-title">
              <span class="icon" style="color: var(--color-info);">${getIcon('info')}</span>
              <span>24/7 Setup Guides: cron-job.org &amp; UptimeMonitor</span>
            </div>
            <span style="font-size: 0.75rem; color: var(--color-online-text); font-weight: 600;">
              Zero Internal Booming • 100% Free
            </span>
          </div>

          <div style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); display: grid; gap: 1rem;">
            
            <!-- cron-job.org Card -->
            <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.15rem; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem;">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-weight: 700; color: var(--text-primary); font-size: 1rem;">cron-job.org</span>
                    <span class="badge everyone" style="font-size: 0.6875rem;">Webcron</span>
                  </div>
                  <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" style="font-size: 0.75rem; color: var(--color-primary-text); text-decoration: underline;">Open Site ↗</a>
                </div>

                <div style="font-size: 0.8125rem; color: var(--text-muted); margin-bottom: 0.85rem; line-height: 1.4;">
                  A free cloud cron engine that sends HTTP requests to your app every few minutes from external servers, keeping the host alive 24/7.
                </div>

                <ol style="padding-left: 1.25rem; font-size: 0.8125rem; color: var(--text-secondary); margin: 0 0 1rem 0; line-height: 1.6;">
                  <li>Log in or register for free at <a href="https://cron-job.org" target="_blank" rel="noopener" style="color: var(--color-primary-text);">cron-job.org</a></li>
                  <li>Click <strong>Create Cronjob</strong> in the console</li>
                  <li>Title: <strong>TomMC Bot 24/7 Keepalive</strong></li>
                  <li>URL: <code style="font-family: var(--font-mono); font-size: 0.75rem; background: var(--bg-surface); padding: 0.15rem 0.35rem; border-radius: 3px; word-break: break-all;">${origin}/api/health</code></li>
                  <li>Schedule: <strong>Every 5 minutes</strong> (or 10 minutes)</li>
                  <li>Request Method: <strong>GET</strong></li>
                  <li>Save the cronjob — it will now ping the app 24/7!</li>
                </ol>
              </div>

              <button class="btn btn-primary ka-copy-guide-url-btn" data-url="${origin}/api/health" style="width: 100%; font-size: 0.8125rem; justify-content: center;">
                <span class="icon">${getIcon('copy')}</span>
                <span>Copy URL for cron-job.org</span>
              </button>
            </div>

            <!-- UptimeMonitor / UptimeRobot Card -->
            <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.15rem; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem;">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-weight: 700; color: var(--text-primary); font-size: 1rem;">UptimeMonitor / UptimeRobot</span>
                    <span class="badge owner" style="font-size: 0.6875rem;">Free Monitor</span>
                  </div>
                  <a href="https://uptimerobot.com" target="_blank" rel="noopener noreferrer" style="font-size: 0.75rem; color: var(--color-primary-text); text-decoration: underline;">Open Site ↗</a>
                </div>

                <div style="font-size: 0.8125rem; color: var(--text-muted); margin-bottom: 0.85rem; line-height: 1.4;">
                  Standard uptime monitor that probes the endpoint continuously, logs response latency, and alerts you if the Discord bot ever disconnects.
                </div>

                <ol style="padding-left: 1.25rem; font-size: 0.8125rem; color: var(--text-secondary); margin: 0 0 1rem 0; line-height: 1.6;">
                  <li>Log in or register at <a href="https://uptimerobot.com" target="_blank" rel="noopener" style="color: var(--color-primary-text);">uptimerobot.com</a> (or Uptime Kuma)</li>
                  <li>Click <strong>+ Add New Monitor</strong></li>
                  <li>Monitor Type: <strong>HTTP(s)</strong></li>
                  <li>Friendly Name: <strong>TomMC Bot Status</strong></li>
                  <li>URL: <code style="font-family: var(--font-mono); font-size: 0.75rem; background: var(--bg-surface); padding: 0.15rem 0.35rem; border-radius: 3px; word-break: break-all;">${origin}/api/health</code></li>
                  <li>Monitoring Interval: <strong>5 minutes</strong></li>
                  <li>Click <strong>Create Monitor</strong></li>
                </ol>
              </div>

              <button class="btn btn-primary ka-copy-guide-url-btn" data-url="${origin}/api/health" style="width: 100%; font-size: 0.8125rem; justify-content: center;">
                <span class="icon">${getIcon('copy')}</span>
                <span>Copy URL for UptimeMonitor</span>
              </button>
            </div>

          </div>

          <!-- Why External Monitors Callout -->
          <div style="margin-top: 1rem; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--radius-sm); padding: 0.85rem 1rem;">
            <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
              <span class="icon" style="color: var(--color-primary); flex-shrink: 0; margin-top: 0.15rem;">${getIcon('check')}</span>
              <div style="font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.5;">
                <strong style="color: var(--text-primary);">Why external requests prevent downtime:</strong> If a cloud platform (Cloud Run, Render, Glitch) idles or puts a container to sleep, an internal timer cannot run because the process is frozen. Only an incoming HTTP probe from <em>cron-job.org</em> or <em>UptimeMonitor</em> wakes up the container and keeps it alive 24/7 without consuming internal CPU cycles.
              </div>
            </div>
          </div>

          <!-- Redirection to __cookie_check.html Diagnostic Notice -->
          <div style="margin-top: 0.75rem; background: var(--bg-surface-elevated); border: 1px solid #FCA311; border-radius: var(--radius-sm); padding: 0.85rem 1rem;">
            <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
              <span class="icon" style="color: #FCA311; flex-shrink: 0; margin-top: 0.15rem;">${getIcon('alertTriangle')}</span>
              <div style="font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.5;">
                <strong style="color: #FCA311;">Notice regarding "Redirection detected" (<code>__cookie_check.html</code>):</strong><br />
                If cron-job.org or UptimeMonitor shows a redirect to <code>__cookie_check.html</code>, this is because the <strong>Development Preview URL</strong> (<code>ais-dev-...run.app</code>) is protected by Google's development session cookie to prevent unauthorized web scraping.
                <br /><br />
                <strong>To resolve this:</strong>
                <ul style="margin: 0.25rem 0 0 1.25rem; padding: 0;">
                  <li><strong>Click Deploy:</strong> Deploy the app via the <strong>Deploy</strong> button in AI Studio (or deploy to your production host/VPS). The deployed public production URL does not have Google's dev cookie gate and responds directly with <strong>HTTP 200 OK</strong>!</li>
                  <li>In cron-job.org, make sure to enter the <strong>deployed production URL</strong> (e.g. <code>https://&lt;your-deployed-app&gt;/api/health</code>).</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- Manual Single Probe Tester Console -->
        <div class="card" style="margin-bottom: 1.25rem;">
          <div class="card-header">
            <div class="card-title">
              <span class="icon" style="color: var(--color-online);">${getIcon('terminal')}</span>
              <span>Manual Single Probe Tester</span>
            </div>
            <span id="ka-test-latency-badge" class="badge everyone" style="display: none; font-family: var(--font-mono);">
              0ms
            </span>
          </div>

          <div style="font-size: 0.8125rem; color: var(--text-muted); margin-bottom: 0.75rem;">
            Test the health endpoint on-demand to preview the exact JSON payload returned to cron-job.org and UptimeMonitor (does not trigger any recurring loop):
          </div>

          <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap;">
            <button class="btn btn-secondary" id="ka-console-ping-btn" style="padding: 0.5rem 1rem;">
              <span class="icon">${getIcon('zap')}</span>
              <span>Send Single Test Probe</span>
            </button>
            <button class="btn btn-secondary" id="ka-copy-curl-btn" data-curl="curl -fsS &quot;${origin}/api/health&quot;" style="padding: 0.5rem 1rem;">
              <span class="icon">${getIcon('copy')}</span>
              <span>Copy cURL Command</span>
            </button>
          </div>

          <div id="ka-console-output-container">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
              <span style="font-size: 0.6875rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Expected Payload for External Monitors (HTTP 200 OK)</span>
              <span id="ka-console-timestamp" style="font-size: 0.6875rem; font-family: var(--font-mono); color: var(--text-dim);">Ready</span>
            </div>
            <pre id="ka-console-output" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 0.75rem; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-secondary); max-height: 200px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; margin: 0;">Click "Send Single Test Probe" to inspect the health payload...</pre>
          </div>
        </div>

        <!-- Live Incoming Ping Audit Stream -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <span class="icon" style="color: var(--color-primary);">${getIcon('activity')}</span>
              <span>Incoming Probes Audit Log</span>
            </div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">
              Logs requests from cron-job.org, UptimeMonitor, and external monitors
            </span>
          </div>

          <div style="overflow-x: auto;">
            <table class="table" style="width: 100%; border-collapse: collapse; font-size: 0.8125rem;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-subtle); text-align: left; color: var(--text-muted);">
                  <th style="padding: 0.6rem 0.75rem;">Time</th>
                  <th style="padding: 0.6rem 0.75rem;">Method</th>
                  <th style="padding: 0.6rem 0.75rem;">Endpoint</th>
                  <th style="padding: 0.6rem 0.75rem;">Detected Monitor</th>
                  <th style="padding: 0.6rem 0.75rem;">Origin IP</th>
                  <th style="padding: 0.6rem 0.75rem;">Latency</th>
                  <th style="padding: 0.6rem 0.75rem; text-align: right;">Status</th>
                </tr>
              </thead>
              <tbody id="ka-pings-table-body">
                <tr>
                  <td colspan="7" style="padding: 1.5rem; text-align: center; color: var(--text-muted);">
                    Loading probe history...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    attachKeepAliveEvents(container);
  }

  // Fetch fresh stats immediately
  void fetchKeepAliveStats(container);

  // Setup calm periodic refresh (every 20 seconds, paused when inactive — no booming)
  if (keepAlivePollTimer) clearInterval(keepAlivePollTimer);
  keepAlivePollTimer = setInterval(() => {
    if (document.body.contains(container)) {
      if (!document.hidden) {
        void fetchKeepAliveStats(container, true);
      }
    } else {
      clearInterval(keepAlivePollTimer);
      keepAlivePollTimer = null;
    }
  }, 20000);
}

async function fetchKeepAliveStats(container, isBackground = false) {
  try {
    const res = await api.getKeepAlive(isBackground);
    if (res && res.success) {
      store.update({ keepalive: res });
      updateKeepAliveUI(container, res);
    }
  } catch (err) {
    console.error('Failed to fetch keepalive stats:', err);
  }
}

function updateKeepAliveUI(container, data) {
  if (!container) return;

  const stats = data.stats || {};
  const recentPings = data.recentPings || [];

  // Update Status Pill
  const statusPill = container.querySelector('#keepalive-status-pill');
  const statusText = container.querySelector('#keepalive-status-text');
  if (statusPill && statusText) {
    const isUp = data.status === 'UP' && data.botReady;
    statusPill.className = `status-pill ${isUp ? 'online' : 'offline'}`;
    statusText.textContent = isUp ? '24/7 ACTIVE' : (data.status || 'STANDBY');
  }

  // Update Metric Cards
  const statStatus = container.querySelector('#stat-ka-status');
  if (statStatus) {
    statStatus.textContent = `${data.status || 'UP'} (200 OK)`;
  }

  const statBotReady = container.querySelector('#stat-ka-bot-ready');
  if (statBotReady) {
    statBotReady.textContent = data.botReady ? `Bot Gateway Ping: ${data.botPing ?? 0}ms` : 'Bot Connecting...';
  }

  const statTotalPings = container.querySelector('#stat-ka-total-pings');
  if (statTotalPings) {
    statTotalPings.textContent = (stats.totalPings ?? 0).toLocaleString();
  }

  const statLastSource = container.querySelector('#stat-ka-last-source');
  if (statLastSource) {
    if (stats.lastPingSource) {
      statLastSource.textContent = `Via ${stats.lastPingSource.path} (${stats.lastPingSource.method})`;
    } else {
      statLastSource.textContent = 'Ready for cronjob.org / uptimemonitor';
    }
  }

  const statLastTime = container.querySelector('#stat-ka-last-time');
  if (statLastTime) {
    statLastTime.textContent = stats.lastPingAt ? formatRelativeTime(stats.lastPingAt) : 'Awaiting ping';
  }

  const statLastIp = container.querySelector('#stat-ka-last-ip');
  if (statLastIp) {
    statLastIp.textContent = stats.lastPingSource ? `IP: ${stats.lastPingSource.ip}` : 'No external pings yet';
  }

  const statSelfPinger = container.querySelector('#stat-ka-self-pinger');
  if (statSelfPinger) {
    statSelfPinger.textContent = 'Disabled (Zero Booming)';
  }

  const statSelfNext = container.querySelector('#stat-ka-self-next');
  if (statSelfNext) {
    statSelfNext.textContent = '100% External Monitoring Mode';
  }

  // Update Pings Audit Table
  const tbody = container.querySelector('#ka-pings-table-body');
  if (tbody) {
    if (recentPings.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 2rem 1rem; text-align: center; color: var(--text-muted);">
            No external probes recorded yet. Set up a free monitor at <strong>cron-job.org</strong> or <strong>uptimemonitor</strong> to begin logging 24/7 requests!
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = recentPings.map((p) => {
        let badgeClass = 'everyone';
        if (p.source.includes('cron-job') || p.source.includes('Cron')) badgeClass = 'owner';
        else if (p.source.includes('Uptime') || p.source.includes('Monitor')) badgeClass = 'owner';
        else if (p.source.includes('cURL')) badgeClass = 'trusted';

        return `
        <tr style="border-bottom: 1px solid var(--border-subtle);">
          <td style="padding: 0.6rem 0.75rem; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">
            ${formatTimeOnly(p.timestamp)}
          </td>
          <td style="padding: 0.6rem 0.75rem;">
            <span class="badge everyone" style="font-family: var(--font-mono); font-size: 0.6875rem;">
              ${escapeHtml(p.method)}
            </span>
          </td>
          <td style="padding: 0.6rem 0.75rem; font-family: var(--font-mono); font-size: 0.75rem; color: var(--color-primary-text);">
            ${escapeHtml(p.path)}
          </td>
          <td style="padding: 0.6rem 0.75rem;">
            <span class="badge ${badgeClass}" style="font-size: 0.6875rem; font-weight: 600;">
              ${escapeHtml(p.source)}
            </span>
          </td>
          <td style="padding: 0.6rem 0.75rem; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">
            ${escapeHtml(p.ip)}
          </td>
          <td style="padding: 0.6rem 0.75rem; font-family: var(--font-mono); font-size: 0.75rem; color: var(--color-online-text);">
            ${p.responseTimeMs}ms
          </td>
          <td style="padding: 0.6rem 0.75rem; text-align: right;">
            <span class="status-pill online" style="display: inline-flex; font-size: 0.6875rem; padding: 0.15rem 0.45rem;">
              <span class="status-dot"></span>
              <span>${p.status} OK</span>
            </span>
          </td>
        </tr>
      `;
      }).join('');
    }
  }
}

function attachKeepAliveEvents(container) {
  const origin = window.location.origin;

  // Primary Copy Button
  container.querySelector('#ka-copy-primary-btn')?.addEventListener('click', () => {
    copyToClipboard(`${origin}/api/health`, 'Target URL copied for cron-job.org / UptimeMonitor!');
  });

  // Table row copy buttons
  container.querySelectorAll('.ka-row-copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      if (url) copyToClipboard(url, 'Endpoint URL copied!');
    });
  });

  // Guide copy buttons
  container.querySelectorAll('.ka-copy-guide-url-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      if (url) copyToClipboard(url, 'URL copied for monitor setup!');
    });
  });

  // cURL copy button
  container.querySelector('#ka-copy-curl-btn')?.addEventListener('click', () => {
    copyToClipboard(`curl -fsS "${origin}/api/health"`, 'cURL command copied to clipboard!');
  });

  // Refresh Stats Button
  container.querySelector('#keepalive-refresh-btn')?.addEventListener('click', async () => {
    const btn = container.querySelector('#keepalive-refresh-btn');
    const icon = btn?.querySelector('.icon');
    if (icon) icon.style.animation = 'spin 1s linear infinite';
    await fetchKeepAliveStats(container);
    if (icon) icon.style.animation = '';
    showToast('Metrics updated.', 'info');
  });

  // Test Ping buttons (Hero button & Console button & Primary button)
  const runPing = async () => {
    const pingBtn = container.querySelector('#ka-console-ping-btn');
    const heroBtn = container.querySelector('#keepalive-send-ping-btn');
    const primaryTestBtn = container.querySelector('#ka-test-primary-btn');
    const outputEl = container.querySelector('#ka-console-output');
    const latencyBadge = container.querySelector('#ka-test-latency-badge');
    const timeEl = container.querySelector('#ka-console-timestamp');

    if (pingBtn) pingBtn.disabled = true;
    if (heroBtn) heroBtn.disabled = true;
    if (primaryTestBtn) primaryTestBtn.disabled = true;

    if (outputEl) outputEl.textContent = 'Executing manual probe test to /api/health...';

    const start = performance.now();
    try {
      const res = await api.triggerKeepAlivePing();
      const elapsed = Math.round(performance.now() - start);

      if (latencyBadge) {
        latencyBadge.style.display = 'inline-block';
        latencyBadge.textContent = `${elapsed}ms Roundtrip`;
      }

      if (timeEl) {
        timeEl.textContent = new Date().toLocaleTimeString();
      }

      if (outputEl) {
        outputEl.textContent = JSON.stringify(res, null, 2);
      }

      showToast(`Health probe returned 200 OK (${elapsed}ms)!`, 'success');
      await fetchKeepAliveStats(container);
    } catch (err) {
      if (outputEl) outputEl.textContent = `Error during probe: ${err.message}`;
      showToast('Probe failed: ' + err.message, 'danger');
    } finally {
      if (pingBtn) pingBtn.disabled = false;
      if (heroBtn) heroBtn.disabled = false;
      if (primaryTestBtn) primaryTestBtn.disabled = false;
    }
  };

  container.querySelector('#ka-console-ping-btn')?.addEventListener('click', runPing);
  container.querySelector('#keepalive-send-ping-btn')?.addEventListener('click', runPing);
  container.querySelector('#ka-test-primary-btn')?.addEventListener('click', runPing);
}

function copyToClipboard(text, successMsg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg, 'success');
    }).catch(() => {
      fallbackCopy(text, successMsg);
    });
  } else {
    fallbackCopy(text, successMsg);
  }
}

function fallbackCopy(text, successMsg) {
  const input = document.createElement('textarea');
  input.value = text;
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  document.body.removeChild(input);
  showToast(successMsg, 'success');
}

function formatRelativeTime(iso) {
  if (!iso) return '--';
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return 'Just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

function formatTimeOnly(iso) {
  if (!iso) return '--';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
