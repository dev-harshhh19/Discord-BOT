import { getIcon } from '../icons.js';
import { store } from '../state.js';

/**
 * About Developer Component (Harshad Nikam - harshadnikam.me & dev-harshhh19)
 */

export function renderAboutDev(container) {
  const state = store.getState();
  const dev = state.devProfile?.developer || {
    name: 'Harshad Nikam',
    username: 'dev-harshhh19',
    avatar: 'https://cdn.harshadnikam.me/Profile.png',
    title: 'Full Stack & Systems Architect',
    bio: 'Passionate developer building high-performance Discord bots, automation architectures, and modern web applications.',
    website: 'https://harshadnikam.me',
    github: 'https://github.com/dev-harshhh19',
    techStack: [
      'TypeScript',
      'Node.js',
      'Discord.js v14',
      'Puppeteer Engine',
      'Express REST API',
      'Modern Component CSS',
      'Minecraft Query Protocol',
      'Docker & CI/CD',
    ],
  };

  const avatarUrl = dev.avatar || 'https://cdn.harshadnikam.me/Profile.png';

  container.innerHTML = `
    <!-- Developer Hero Section -->
    <div class="dev-hero">
      <div class="dev-avatar-box">
        <img
          src="${escapeHtml(avatarUrl)}"
          alt="${escapeHtml(dev.name)}"
          class="dev-avatar-img"
          loading="lazy"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <span class="icon dev-avatar-fallback" style="display: none; transform: scale(1.8);">${getIcon('code')}</span>
      </div>

      <div class="dev-info">
        <div class="dev-name">${escapeHtml(dev.name)}</div>
        <div class="dev-title">${escapeHtml(dev.title)}</div>
        <div class="dev-bio">${escapeHtml(dev.bio)}</div>

        <div class="dev-links">
          <a href="${escapeHtml(dev.website)}" target="_blank" rel="noopener noreferrer" class="dev-link-btn primary">
            <span class="icon">${getIcon('globe')}</span>
            <span>harshadnikam.me</span>
            <span class="icon">${getIcon('externalLink')}</span>
          </a>

          <a href="${escapeHtml(dev.github)}" target="_blank" rel="noopener noreferrer" class="dev-link-btn">
            <span class="icon">${getIcon('github')}</span>
            <span>GitHub (@${escapeHtml(dev.username)})</span>
            <span class="icon">${getIcon('externalLink')}</span>
          </a>
        </div>
      </div>
    </div>

    <!-- Tech Stack & Engineering Highlights Grid -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem;">
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span class="icon">${getIcon('cpu')}</span>
            <span>Core Competencies & Stack</span>
          </div>
        </div>

        <div class="tech-grid">
          ${(dev.techStack || [])
      .map(
        (tech) => `
            <div class="tech-tag">${escapeHtml(tech)}</div>
          `,
      )
      .join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span class="icon">${getIcon('shield')}</span>
            <span>Project Security & Architecture</span>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.5;">
          <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
            <span class="icon" style="color: var(--color-online); flex-shrink: 0; margin-top: 0.1rem;">${getIcon('check')}</span>
            <div><strong>DDoS & Rate Limiting:</strong> Multi-tiered sliding window IP rate limiting on API endpoints to prevent request flooding and brute force attacks.</div>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
            <span class="icon" style="color: var(--color-online); flex-shrink: 0; margin-top: 0.1rem;">${getIcon('check')}</span>
            <div><strong>Role-Based Access Control:</strong> Discord permission hierarchy with custom Minecraft role support and constant-time password verification.</div>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
            <span class="icon" style="color: var(--color-online); flex-shrink: 0; margin-top: 0.1rem;">${getIcon('check')}</span>
            <div><strong>Component Architecture:</strong> Vanilla ES module architecture with reactive state binding and static, mature color palette.</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
