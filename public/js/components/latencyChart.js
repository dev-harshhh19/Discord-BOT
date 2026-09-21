import { getIcon } from '../icons.js';
import { store } from '../state.js';

/**
 * Real-time D3 Latency Chart Component for 'tab-overview'
 * Visualizes Minecraft server ping & Discord bot gateway latency over time using telemetry data.
 */

export class LatencyChart {
  /**
   * @param {HTMLElement} container
   * @param {Object} [options]
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      maxPoints: 30,
      ...options,
    };

    this.activeFilter = 'all'; // 'all' | 'server' | 'bot'
    this.unsubscribeStore = null;
    this.resizeObserver = null;
    this.svg = null;
    this.id = 'latency-chart-' + Math.random().toString(36).slice(2, 9);
  }

  init() {
    this.renderContainer();
    this.setupResizeObserver();

    // Subscribe to store updates for real-time re-renders
    this.unsubscribeStore = store.subscribe(() => {
      if (document.body.contains(this.container)) {
        this.updateChart();
      } else {
        this.destroy();
      }
    });

    // Initial render
    this.updateChart();
  }

  setupResizeObserver() {
    const chartWrapper = this.container.querySelector(`#${this.id}-wrapper`);
    if (!chartWrapper || typeof ResizeObserver === 'undefined') return;

    this.resizeObserver = new ResizeObserver(() => {
      this.drawD3();
    });
    this.resizeObserver.observe(chartWrapper);
  }

  destroy() {
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.container && this.container._latencyChartInstance === this) {
      delete this.container._latencyChartInstance;
    }
  }

  renderContainer() {
    this.container.innerHTML = `
      <div class="card latency-chart-card" id="${this.id}">
        <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div class="stat-icon-wrapper" style="width: 2.25rem; height: 2.25rem; color: var(--color-primary);">
              ${getIcon('activity')}
            </div>
            <div>
              <div class="card-title" style="margin-bottom: 0.15rem;">
                <span>Real-Time Ping & Latency Telemetry</span>
                <span class="badge" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-default); color: var(--color-primary-text); font-size: 0.6875rem; font-family: var(--font-mono); padding: 0.1rem 0.4rem;">D3.js</span>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">
                High-resolution time-series monitoring of Minecraft server and Discord gateway ping
              </div>
            </div>
          </div>

          <!-- Series Filter Controls -->
          <div class="latency-filter-group" style="display: flex; align-items: center; gap: 0.35rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); padding: 0.2rem; border-radius: var(--radius-md);">
            <button class="filter-btn active" data-filter="all" style="padding: 0.3rem 0.65rem; font-size: 0.75rem; border-radius: var(--radius-sm); border: none; background: var(--bg-surface-active); color: var(--text-primary); font-weight: 500; cursor: pointer;">
              All Telemetry
            </button>
            <button class="filter-btn" data-filter="server" style="padding: 0.3rem 0.65rem; font-size: 0.75rem; border-radius: var(--radius-sm); border: none; background: transparent; color: var(--text-muted); font-weight: 500; cursor: pointer;">
              Minecraft Server
            </button>
            <button class="filter-btn" data-filter="bot" style="padding: 0.3rem 0.65rem; font-size: 0.75rem; border-radius: var(--radius-sm); border: none; background: transparent; color: var(--text-muted); font-weight: 500; cursor: pointer;">
              Discord Gateway
            </button>
          </div>
        </div>

        <!-- Latency Metrics Summary Strip -->
        <div class="latency-summary-strip" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; padding: 0.75rem 1rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); font-size: 0.8125rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="display: inline-block; width: 0.65rem; height: 0.65rem; border-radius: 50%; background: var(--color-online);"></span>
            <span style="color: var(--text-secondary);">Minecraft Ping:</span>
            <span id="${this.id}-current-server" style="font-family: var(--font-mono); font-weight: 700; color: var(--color-online-text);">--</span>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="display: inline-block; width: 0.65rem; height: 0.65rem; border-radius: 50%; background: var(--color-primary);"></span>
            <span style="color: var(--text-secondary);">Gateway Latency:</span>
            <span id="${this.id}-current-bot" style="font-family: var(--font-mono); font-weight: 700; color: var(--color-primary-text);">--</span>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="color: var(--text-muted);">Avg Latency:</span>
            <span id="${this.id}-avg-latency" style="font-family: var(--font-mono); font-weight: 600; color: var(--text-primary);">--</span>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="color: var(--text-muted);">Range (Min / Max):</span>
            <span id="${this.id}-minmax-latency" style="font-family: var(--font-mono); font-weight: 600; color: var(--text-secondary);">--</span>
          </div>
        </div>

        <!-- D3 SVG Chart Stage Wrapper -->
        <div id="${this.id}-wrapper" class="latency-chart-stage" style="position: relative; width: 100%; height: 260px; min-height: 240px; margin-top: 0.5rem;">
          <div id="${this.id}-d3-container" style="width: 100%; height: 100%;"></div>

          <!-- Interactive Tooltip Overlay -->
          <div id="${this.id}-tooltip" class="d3-chart-tooltip" style="position: absolute; display: none; pointer-events: none; background: var(--bg-surface-active); border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: 0.5rem 0.75rem; font-size: 0.75rem; box-shadow: var(--shadow-lg); z-index: 10; white-space: nowrap; transform: translate(-50%, -120%); transition: opacity 0.15s ease;">
          </div>
        </div>

        <!-- Chart Legend & Status Indicator -->
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); padding-top: 0.5rem; border-top: 1px solid var(--border-subtle); flex-wrap: wrap; gap: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span style="width: 12px; height: 3px; background: var(--color-online); border-radius: 2px;"></span>
              <span>Minecraft Server Ping</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span style="width: 12px; height: 3px; background: var(--color-primary); border-radius: 2px;"></span>
              <span>Discord Bot Ping</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.4rem;">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--color-online); animation: pulse-dot 2s infinite;"></span>
            <span>Real-time polling every 5s</span>
          </div>
        </div>
      </div>
    `;

    // Attach filter click handlers
    const filterBtns = this.container.querySelectorAll('.filter-btn');
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        filterBtns.forEach((b) => {
          b.classList.remove('active');
          b.style.background = 'transparent';
          b.style.color = 'var(--text-muted)';
        });
        const target = e.currentTarget;
        target.classList.add('active');
        target.style.background = 'var(--bg-surface-active)';
        target.style.color = 'var(--text-primary)';
        this.activeFilter = target.dataset.filter;
        this.drawD3();
      });
    });
  }

  updateChart() {
    this.updateSummaryMetrics();
    this.drawD3();
  }

  updateSummaryMetrics() {
    const history = store.getTelemetryHistory();
    const currentServerEl = this.container.querySelector(`#${this.id}-current-server`);
    const currentBotEl = this.container.querySelector(`#${this.id}-current-bot`);
    const avgEl = this.container.querySelector(`#${this.id}-avg-latency`);
    const minMaxEl = this.container.querySelector(`#${this.id}-minmax-latency`);

    if (!history || history.length === 0) return;

    const latest = history[history.length - 1];

    if (currentServerEl) {
      if (latest.serverLatency !== null) {
        currentServerEl.textContent = `${latest.serverLatency}ms`;
        currentServerEl.style.color = 'var(--color-online-text)';
      } else {
        currentServerEl.textContent = latest.state === 'OFFLINE' ? 'Offline (Proxy)' : 'Probing...';
        currentServerEl.style.color = 'var(--text-muted)';
      }
    }

    if (currentBotEl) {
      currentBotEl.textContent = latest.botPing !== null ? `${latest.botPing}ms` : '--';
    }

    // Compute averages and min/max across active points
    const activeValues = [];
    history.forEach((d) => {
      if (d.serverLatency !== null) activeValues.push(d.serverLatency);
      if (d.botPing !== null) activeValues.push(d.botPing);
    });

    if (activeValues.length > 0) {
      const min = Math.min(...activeValues);
      const max = Math.max(...activeValues);
      const avg = Math.round(activeValues.reduce((a, b) => a + b, 0) / activeValues.length);

      if (avgEl) avgEl.textContent = `${avg}ms`;
      if (minMaxEl) minMaxEl.textContent = `${min}ms / ${max}ms`;
    }
  }

  drawD3() {
    const d3 = window.d3;
    const mountEl = this.container.querySelector(`#${this.id}-d3-container`);
    if (!mountEl) return;

    if (!d3) {
      mountEl.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: 0.8125rem;">
          Loading D3 visualization engine...
        </div>
      `;
      return;
    }

    let history = store.getTelemetryHistory();
    if (!history || history.length === 0) {
      // Create fallback points based on current store status if available
      const st = store.getState().status;
      const curBotPing = st?.bot?.ping >= 0 ? st.bot.ping : 210;
      const curServerPing = st?.server?.latency ?? null;
      store.recordTelemetry({
        timestamp: Date.now(),
        serverLatency: curServerPing,
        botPing: curBotPing,
        state: st?.server?.state || 'OFFLINE',
      });
      history = store.getTelemetryHistory();
    }

    const width = mountEl.clientWidth || 600;
    const height = mountEl.clientHeight || 240;
    const margin = { top: 20, right: 30, bottom: 30, left: 45 };
    const innerWidth = Math.max(50, width - margin.left - margin.right);
    const innerHeight = Math.max(50, height - margin.top - margin.bottom);

    // Clear previous SVG
    mountEl.innerHTML = '';

    const svg = d3
      .select(mountEl)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('overflow', 'visible');

    // Gradients Definition
    const defs = svg.append('defs');

    // Soft Gradient for Server (Forest Slate)
    const serverGrad = defs
      .append('linearGradient')
      .attr('id', `${this.id}-server-grad`)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    serverGrad.append('stop').attr('offset', '0%').attr('stop-color', '#166534').attr('stop-opacity', 0.18);
    serverGrad.append('stop').attr('offset', '100%').attr('stop-color', '#166534').attr('stop-opacity', 0.0);

    // Soft Gradient for Bot Gateway (Deep Slate Teal)
    const botGrad = defs
      .append('linearGradient')
      .attr('id', `${this.id}-bot-grad`)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    botGrad.append('stop').attr('offset', '0%').attr('stop-color', '#235D69').attr('stop-opacity', 0.18);
    botGrad.append('stop').attr('offset', '100%').attr('stop-color', '#235D69').attr('stop-opacity', 0.0);

    // Main Group
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Prepare Scales
    const timeExtent = d3.extent(history, (d) => new Date(d.timestamp));
    if (!timeExtent[0] || !timeExtent[1] || timeExtent[0].getTime() === timeExtent[1].getTime()) {
      timeExtent[0] = new Date(Date.now() - 60000);
      timeExtent[1] = new Date();
    }

    const xScale = d3.scaleTime().domain(timeExtent).range([0, innerWidth]);

    // Find max latency for Y Domain
    let maxY = 100;
    history.forEach((d) => {
      if (d.serverLatency && d.serverLatency > maxY) maxY = d.serverLatency;
      if (d.botPing && d.botPing > maxY) maxY = d.botPing;
    });
    maxY = Math.ceil((maxY * 1.25) / 20) * 20; // Round up cleanly

    const yScale = d3.scaleLinear().domain([0, maxY]).range([innerHeight, 0]);

    // Horizontal Grid Lines
    const yGrid = d3.axisLeft(yScale).ticks(4).tickSize(-innerWidth).tickFormat('');
    g.append('g')
      .attr('class', 'grid y-grid')
      .call(yGrid)
      .selectAll('line')
      .attr('stroke', 'var(--border-subtle)')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-dasharray', '2,2');
    g.selectAll('.y-grid .domain').remove();

    // X Axis
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(Math.max(3, Math.floor(innerWidth / 120)))
      .tickFormat(d3.timeFormat('%H:%M:%S'));

    const xAxisG = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisG.selectAll('text')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-mono)')
      .attr('dy', '1em');

    xAxisG.select('.domain').attr('stroke', 'var(--border-subtle)');
    xAxisG.selectAll('line').attr('stroke', 'var(--border-subtle)');

    // Y Axis
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(4)
      .tickFormat((d) => `${d}ms`);

    const yAxisG = g.append('g').call(yAxis);

    yAxisG.selectAll('text')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-mono)');

    yAxisG.select('.domain').attr('stroke', 'var(--border-subtle)');
    yAxisG.selectAll('line').attr('stroke', 'var(--border-subtle)');

    // Generators
    const botLine = d3
      .line()
      .defined((d) => d.botPing !== null)
      .x((d) => xScale(new Date(d.timestamp)))
      .y((d) => yScale(d.botPing))
      .curve(d3.curveMonotoneX);

    const botArea = d3
      .area()
      .defined((d) => d.botPing !== null)
      .x((d) => xScale(new Date(d.timestamp)))
      .y0(innerHeight)
      .y1((d) => yScale(d.botPing))
      .curve(d3.curveMonotoneX);

    const serverLine = d3
      .line()
      .defined((d) => d.serverLatency !== null)
      .x((d) => xScale(new Date(d.timestamp)))
      .y((d) => yScale(d.serverLatency))
      .curve(d3.curveMonotoneX);

    const serverArea = d3
      .area()
      .defined((d) => d.serverLatency !== null)
      .x((d) => xScale(new Date(d.timestamp)))
      .y0(innerHeight)
      .y1((d) => yScale(d.serverLatency))
      .curve(d3.curveMonotoneX);

    // Draw Discord Bot Series (if active)
    if (this.activeFilter === 'all' || this.activeFilter === 'bot') {
      g.append('path')
        .datum(history)
        .attr('class', 'area bot-area')
        .attr('d', botArea)
        .attr('fill', `url(#${this.id}-bot-grad)`);

      g.append('path')
        .datum(history)
        .attr('class', 'line bot-line')
        .attr('d', botLine)
        .attr('fill', 'none')
        .attr('stroke', '#235D69')
        .attr('stroke-width', 2);

      // Latest Point Pulse
      const lastBotPoint = history.slice().reverse().find((d) => d.botPing !== null);
      if (lastBotPoint) {
        g.append('circle')
          .attr('cx', xScale(new Date(lastBotPoint.timestamp)))
          .attr('cy', yScale(lastBotPoint.botPing))
          .attr('r', 4)
          .attr('fill', '#235D69')
          .attr('stroke', 'var(--bg-surface)')
          .attr('stroke-width', 2);
      }
    }

    // Draw Minecraft Server Series (if active)
    if (this.activeFilter === 'all' || this.activeFilter === 'server') {
      const hasServerPoints = history.some((d) => d.serverLatency !== null);
      if (hasServerPoints) {
        g.append('path')
          .datum(history)
          .attr('class', 'area server-area')
          .attr('d', serverArea)
          .attr('fill', `url(#${this.id}-server-grad)`);

        g.append('path')
          .datum(history)
          .attr('class', 'line server-line')
          .attr('d', serverLine)
          .attr('fill', 'none')
          .attr('stroke', '#166534')
          .attr('stroke-width', 2.2);

        const lastServerPoint = history.slice().reverse().find((d) => d.serverLatency !== null);
        if (lastServerPoint) {
          g.append('circle')
            .attr('cx', xScale(new Date(lastServerPoint.timestamp)))
            .attr('cy', yScale(lastServerPoint.serverLatency))
            .attr('r', 4)
            .attr('fill', '#166534')
            .attr('stroke', 'var(--bg-surface)')
            .attr('stroke-width', 2);
        }
      }
    }

    // Interactive Hover Elements
    const tooltipEl = this.container.querySelector(`#${this.id}-tooltip`);
    const hoverLine = g
      .append('line')
      .attr('class', 'hover-guide-line')
      .attr('stroke', 'var(--text-secondary)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .style('opacity', 0)
      .style('pointer-events', 'none');

    const hoverCircleBot = g
      .append('circle')
      .attr('r', 5)
      .attr('fill', '#235D69')
      .attr('stroke', 'var(--bg-surface)')
      .attr('stroke-width', 2)
      .style('opacity', 0)
      .style('pointer-events', 'none');

    const hoverCircleServer = g
      .append('circle')
      .attr('r', 5)
      .attr('fill', '#166534')
      .attr('stroke', 'var(--bg-surface)')
      .attr('stroke-width', 2)
      .style('opacity', 0)
      .style('pointer-events', 'none');

    // Bisector for interactive mouse hover
    const bisectDate = d3.bisector((d) => new Date(d.timestamp)).left;

    // Overlay Rect for capture
    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event);
        const x0 = xScale.invert(mx);
        const idx = bisectDate(history, x0, 1);
        const d0 = history[idx - 1];
        const d1 = history[idx];
        let d = d0;
        if (d0 && d1) {
          d = x0 - new Date(d0.timestamp) > new Date(d1.timestamp) - x0 ? d1 : d0;
        } else if (!d0 && d1) {
          d = d1;
        }

        if (!d) return;

        const px = xScale(new Date(d.timestamp));
        hoverLine.attr('x1', px).attr('x2', px).style('opacity', 0.8);

        let tooltipContent = `
          <div style="font-weight: 600; color: #FFFFFF; margin-bottom: 0.25rem;">
            ${new Date(d.timestamp).toLocaleTimeString()}
          </div>
        `;

        if (d.serverLatency !== null) {
          hoverCircleServer
            .attr('cx', px)
            .attr('cy', yScale(d.serverLatency))
            .style('opacity', 1);
          tooltipContent += `
            <div style="color: #68D391; font-weight: 500;">
              ● Minecraft Server: <strong>${d.serverLatency}ms</strong>
            </div>
          `;
        } else {
          hoverCircleServer.style('opacity', 0);
          tooltipContent += `
            <div style="color: #A0AEC0; font-size: 0.7rem;">
              ● Minecraft Server: Offline / Inactive
            </div>
          `;
        }

        if (d.botPing !== null) {
          hoverCircleBot
            .attr('cx', px)
            .attr('cy', yScale(d.botPing))
            .style('opacity', 1);
          tooltipContent += `
            <div style="color: #BBD5DA; font-weight: 500;">
              ● Discord Gateway: <strong>${d.botPing}ms</strong>
            </div>
          `;
        } else {
          hoverCircleBot.style('opacity', 0);
        }

        if (tooltipEl) {
          tooltipEl.innerHTML = tooltipContent;
          tooltipEl.style.display = 'block';
          tooltipEl.style.left = `${px + margin.left}px`;
          tooltipEl.style.top = `${margin.top + 20}px`;
        }
      })
      .on('mouseleave', () => {
        hoverLine.style('opacity', 0);
        hoverCircleBot.style('opacity', 0);
        hoverCircleServer.style('opacity', 0);
        if (tooltipEl) tooltipEl.style.display = 'none';
      });
  }
}

/**
 * Helper to mount or update LatencyChart in a target container
 * @param {HTMLElement} container
 * @param {Object} [options]
 * @returns {LatencyChart}
 */
export function renderLatencyChart(container, options = {}) {
  if (!container) return null;

  if (container._latencyChartInstance) {
    container._latencyChartInstance.updateChart();
    return container._latencyChartInstance;
  }

  const chart = new LatencyChart(container, options);
  container._latencyChartInstance = chart;
  chart.init();
  return chart;
}
