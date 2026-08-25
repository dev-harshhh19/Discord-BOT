export function renderTerms(container) {
  container.innerHTML = `
    <div style="max-width: 800px; margin: 2rem auto; background: var(--bg-surface); padding: 2rem; border-radius: var(--radius-lg); border: 1px solid var(--border-default);">
      <h1 style="font-size: 2rem; margin-bottom: 1.5rem; color: var(--text-primary); border-bottom: 1px solid var(--border-subtle); padding-bottom: 1rem;">Terms of Service</h1>
      
      <div style="color: var(--text-secondary); font-size: 0.95rem; line-height: 1.6; display: flex; flex-direction: column; gap: 1.25rem;">
        <p><strong>Effective Date:</strong> ${new Date().toLocaleDateString()}</p>
        
        <section>
          <h2 style="font-size: 1.25rem; color: var(--text-primary); margin-bottom: 0.5rem;">1. Acceptance of Terms</h2>
          <p>By accessing and using the TomMC-SMP Server Management Dashboard and Discord Bot (the "Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.</p>
        </section>

        <section>
          <h2 style="font-size: 1.25rem; color: var(--text-primary); margin-bottom: 0.5rem;">2. Use of Service</h2>
          <p>This Service is provided for the management and telemetry of the TomMC-SMP Minecraft server. Authorized administrators are granted access to execute power commands (start, stop, restart) and manage the whitelist.</p>
          <ul style="margin-left: 1.5rem; margin-top: 0.5rem; color: var(--text-muted);">
            <li>Do not abuse the polling or power management API endpoints.</li>
            <li>Maintain the confidentiality of your administrative passwords.</li>
            <li>Use the Service in compliance with Discord's Terms of Service and Aternos' Terms of Service.</li>
          </ul>
        </section>

        <section>
          <h2 style="font-size: 1.25rem; color: var(--text-primary); margin-bottom: 0.5rem;">3. Modification of Service</h2>
          <p>We reserve the right to modify, suspend, or discontinue the Service (or any part or content thereof) at any time with or without notice to you. We shall not be liable to you or to any third party for any modification, suspension, or discontinuance of the Service.</p>
        </section>

        <section>
          <h2 style="font-size: 1.25rem; color: var(--text-primary); margin-bottom: 0.5rem;">4. Disclaimer of Warranties</h2>
          <p>The Service is provided on an "as is" and "as available" basis without any warranties of any kind, either express or implied, including, but not limited to, the implied warranties of merchantability, fitness for a particular purpose, or non-infringement.</p>
        </section>
      </div>
    </div>
  `;
}
