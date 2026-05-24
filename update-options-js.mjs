import fs from 'fs';

let js = fs.readFileSync('options.js', 'utf8');

// Update DEFAULT_SETTINGS
js = js.replace("raindropAccessToken: ''\n};", `raindropAccessToken: '',
  healthCheckEnabled: false,
  healthCheckInterval: 'weekly',
  healthCheckStaleDays: 365
};`);

// Add Navigation logic in DOMContentLoaded
js = js.replace("document.addEventListener('DOMContentLoaded', () => {", `document.addEventListener('DOMContentLoaded', () => {
  // Navigation tab switching
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
      document.querySelectorAll('.settings-section').forEach(sec => sec.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(item.dataset.section).classList.add('active');
    });
  });

  // Health check interval tabs
  document.querySelectorAll('.interval-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.interval-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  document.getElementById('healthCheckEnabled').addEventListener('change', () => {
    const enabled = document.getElementById('healthCheckEnabled').checked;
    document.getElementById('intervalGroup').style.opacity = enabled ? '1' : '0.4';
    document.getElementById('staleGroup').style.opacity = enabled ? '1' : '0.4';
  });
`);

// Load Settings
js = js.replace("document.getElementById('raindropAccessToken').value = settings.raindropAccessToken;", `document.getElementById('raindropAccessToken').value = settings.raindropAccessToken;

    document.getElementById('healthCheckEnabled').checked = settings.healthCheckEnabled === true;
    document.getElementById('healthCheckStaleDays').value = settings.healthCheckStaleDays || 365;
    document.querySelectorAll('.interval-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.interval === (settings.healthCheckInterval || 'weekly'));
    });
    
    // trigger initial visibility
    const enabled = settings.healthCheckEnabled === true;
    document.getElementById('intervalGroup').style.opacity = enabled ? '1' : '0.4';
    document.getElementById('staleGroup').style.opacity = enabled ? '1' : '0.4';`);

// Save Settings
js = js.replace("const raindropAccessToken = document.getElementById('raindropAccessToken').value.trim();", `const raindropAccessToken = document.getElementById('raindropAccessToken').value.trim();
  const healthCheckEnabled = document.getElementById('healthCheckEnabled').checked;
  const healthCheckStaleDays = parseInt(document.getElementById('healthCheckStaleDays').value, 10) || 365;
  const activeTab = document.querySelector('.interval-tab.active');
  const healthCheckInterval = activeTab ? activeTab.dataset.interval : 'weekly';`);

js = js.replace("raindropAccessToken\n    });", `raindropAccessToken,
      healthCheckEnabled,
      healthCheckInterval,
      healthCheckStaleDays
    });
    
    // Also set the alarm in background for health checks
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'setupHealthCheckAlarm' }).catch(() => {});
    }`);

fs.writeFileSync('options.js', js);
console.log('Updated options.js');
