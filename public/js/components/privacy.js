export function renderPrivacy(container) {
  container.innerHTML = `
    <div style="max-width: 800px; margin: 2rem auto; background: var(--bg-surface); padding: 2rem; border-radius: var(--radius-lg); border: 1px solid var(--border-default);">
      <h1 style="font-size: 2rem; margin-bottom: 1.5rem; color: var(--text-primary); border-bottom: 1px solid var(--border-subtle); padding-bottom: 1rem;">Privacy Policy</h1>
      
      <div style="color: var(--text-secondary); font-size: 0.95rem; line-height: 1.6; display: flex; flex-direction: column; gap: 1.25rem;">
        <p><strong>Effective Date:</strong> ${new Date().toLocaleDateString()}</p>
        
        <section>
          <h2 style="font-size: 1.25rem; color: var(--text-primary); margin-bottom: 0.5rem;">1. Information We Collect</h2>
          <p>When you use the TomMC-SMP Server Management Dashboard, we may collect the following information:</p>
          <ul style="margin-left: 1.5rem; margin-top: 0.5rem; color: var(--text-muted);">
            <li><strong>Discord Data:</strong> Member IDs, usernames, and server roles synchronized from the connected Discord guild.</li>
            <li><strong>Minecraft Data:</strong> Minecraft usernames submitted during the whitelist registration process.</li>
            <li><strong>Telemetry Data:</strong> IP addresses (anonymized in logs) and usage metrics for API endpoints to prevent abuse (Rate Limiting).</li>
          </ul>
        </section>

        <section>
          <h2 style="font-size: 1.25rem; color: var(--text-primary); margin-bottom: 0.5rem;">2. How We Use Information</h2>
          <p>The information collected is used solely for operating the TomMC-SMP server and its associated Discord bot. Specifically:</p>
          <ul style="margin-left: 1.5rem; margin-top: 0.5rem; color: var(--text-muted);">
            <li>To authenticate and authorize users executing management commands.</li>
            <li>To manage the Minecraft server whitelist seamlessly.</li>
            <li>To provide live player statistics and telemetry.</li>
          </ul>
        </section>

        <section>
          <h2 style="font-size: 1.25rem; color: var(--text-primary); margin-bottom: 0.5rem;">3. Data Sharing and Security</h2>
          <p>We do not sell, trade, or otherwise transfer to outside parties your personally identifiable information. Data is stored locally on the server instance hosting this bot. We implement reasonable security measures, including token-based authentication and secure headers, to protect the dashboard from unauthorized access.</p>
        </section>

        <section>
          <h2 style="font-size: 1.25rem; color: var(--text-primary); margin-bottom: 0.5rem;">4. Cookies and Local Storage</h2>
          <p>This application uses HTML5 Local Storage and Session Storage to store your administrative authentication token. No tracking cookies or third-party analytics are used.</p>
        </section>
      </div>
    </div>
  `;
}
