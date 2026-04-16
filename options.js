// Default settings
const DEFAULT_SETTINGS = {
  aiProvider: 'anthropic',
  anthropicApiKey: '',
  openaiApiKey: '',
  openaiModel: 'gpt-4o',
  openrouterApiKey: '',
  openrouterModel: '',
  instapaperUsername: '',
  instapaperPassword: '',
  todoistApiToken: '',
  instapaperEnabled: true,
  todoistEnabled: false,
  thingsEnabled: false,
  domainRules: [],
  readwiseEnabled: false,
  readwiseAccessToken: '',
  raindropEnabled: false,
  raindropAccessToken: '',
  healthCheckEnabled: false,
  healthCheckInterval: 'weekly',
  healthCheckStaleDays: 365
};

let currentProvider = 'anthropic';
let domainRules = [];

// Load saved settings on page load
document.addEventListener('DOMContentLoaded', () => {
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

  loadSettings();

  // Provider tab switching
  document.querySelectorAll('.provider-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentProvider = tab.dataset.provider;
      updateProviderUI(currentProvider);
    });
  });

  document.getElementById('loadModelsBtn').addEventListener('click', () => loadOpenRouterModels());

  document.getElementById('addRuleBtn').addEventListener('click', () => {
    const domain = document.getElementById('newRuleDomain').value.trim();
    const folder = document.getElementById('newRuleFolder').value.trim();
    if (!domain || !folder) return;
    domainRules.push({ domain, folder });
    renderDomainRules();
    document.getElementById('newRuleDomain').value = '';
    document.getElementById('newRuleFolder').value = '';
  });
});

// Handle form submission
document.getElementById('settingsForm').addEventListener('submit', saveSettings);

// Handle reset button
document.getElementById('resetBtn').addEventListener('click', resetSettings);

function updateProviderUI(provider) {
  document.querySelectorAll('.provider-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.provider === provider);
  });
  document.getElementById('anthropicSection').style.display = provider === 'anthropic' ? 'block' : 'none';
  document.getElementById('openaiSection').style.display = provider === 'openai' ? 'block' : 'none';
  document.getElementById('openrouterSection').style.display = provider === 'openrouter' ? 'block' : 'none';
}

function renderDomainRules() {
  const list = document.getElementById('domainRulesList');
  list.textContent = '';
  if (domainRules.length === 0) return;
  domainRules.forEach((rule, idx) => {
    const item = document.createElement('div');
    item.className = 'rule-item';

    const domainEl = document.createElement('span');
    domainEl.className = 'rule-domain';
    domainEl.textContent = rule.domain;

    const arrow = document.createElement('span');
    arrow.className = 'rule-arrow';
    arrow.textContent = '→';

    const folderEl = document.createElement('span');
    folderEl.className = 'rule-folder';
    folderEl.textContent = rule.folder;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove rule';
    removeBtn.addEventListener('click', () => {
      domainRules.splice(idx, 1);
      renderDomainRules();
    });

    item.appendChild(domainEl);
    item.appendChild(arrow);
    item.appendChild(folderEl);
    item.appendChild(removeBtn);
    list.appendChild(item);
  });
}

async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

    currentProvider = settings.aiProvider || 'anthropic';
    updateProviderUI(currentProvider);

    document.getElementById('anthropicApiKey').value = settings.anthropicApiKey;
    document.getElementById('openaiApiKey').value = settings.openaiApiKey;
    document.getElementById('openaiModel').value = settings.openaiModel || 'gpt-4o';
    document.getElementById('openrouterApiKey').value = settings.openrouterApiKey;
    document.getElementById('instapaperUsername').value = settings.instapaperUsername;
    document.getElementById('instapaperPassword').value = settings.instapaperPassword;
    document.getElementById('todoistApiToken').value = settings.todoistApiToken;
    document.getElementById('instapaperEnabled').checked = settings.instapaperEnabled !== false;
    document.getElementById('todoistEnabled').checked = settings.todoistEnabled !== false;
    document.getElementById('thingsEnabled').checked = settings.thingsEnabled !== false;
    document.getElementById('readwiseEnabled').checked = settings.readwiseEnabled === true;
    document.getElementById('readwiseAccessToken').value = settings.readwiseAccessToken;
    document.getElementById('raindropEnabled').checked = settings.raindropEnabled === true;
    document.getElementById('raindropAccessToken').value = settings.raindropAccessToken;

    document.getElementById('healthCheckEnabled').checked = settings.healthCheckEnabled === true;
    document.getElementById('healthCheckStaleDays').value = settings.healthCheckStaleDays || 365;
    document.querySelectorAll('.interval-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.interval === (settings.healthCheckInterval || 'weekly'));
    });

    // trigger initial visibility
    const enabled = settings.healthCheckEnabled === true;
    document.getElementById('intervalGroup').style.opacity = enabled ? '1' : '0.4';
    document.getElementById('staleGroup').style.opacity = enabled ? '1' : '0.4';

    domainRules = Array.isArray(settings.domainRules) ? settings.domainRules : [];
    renderDomainRules();

    // If an OpenRouter model was previously saved, load the model list and pre-select it
    if (settings.openrouterApiKey && settings.openrouterModel) {
      await loadOpenRouterModels(settings.openrouterModel);
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Error loading settings', 'error');
  }
}

async function loadOpenRouterModels(preselectedModel = null) {
  const apiKey = document.getElementById('openrouterApiKey').value.trim();
  const select = document.getElementById('openrouterModel');
  const btn = document.getElementById('loadModelsBtn');

  btn.textContent = 'Loading...';
  btn.disabled = true;
  select.disabled = true;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch('https://openrouter.ai/api/v1/models', { headers });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const models = data.data || [];

    // Sort models by name
    models.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

    const currentValue = preselectedModel || select.value;
    select.textContent = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a model...';
    select.appendChild(defaultOption);

    for (const model of models) {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name || model.id;
      if (currentValue && model.id === currentValue) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    showStatus(`Loaded ${models.length} models`, 'success');
    setTimeout(hideStatus, 3000);
  } catch (error) {
    showStatus('Error loading models: ' + error.message, 'error');
  } finally {
    btn.textContent = 'Load Models';
    btn.disabled = false;
    select.disabled = false;
  }
}

async function saveSettings(event) {
  event.preventDefault();

  const anthropicApiKey = document.getElementById('anthropicApiKey').value.trim();
  const openaiApiKey = document.getElementById('openaiApiKey').value.trim();
  const openaiModel = document.getElementById('openaiModel').value;
  const openrouterApiKey = document.getElementById('openrouterApiKey').value.trim();
  const openrouterModel = document.getElementById('openrouterModel').value;
  const instapaperUsername = document.getElementById('instapaperUsername').value.trim();
  const instapaperPassword = document.getElementById('instapaperPassword').value;
  const todoistApiToken = document.getElementById('todoistApiToken').value.trim();

  // Validate based on selected provider
  if (currentProvider === 'anthropic') {
    if (!anthropicApiKey) {
      showStatus('Please enter your Anthropic API key', 'error');
      return;
    }
    if (!anthropicApiKey.startsWith('sk-ant-')) {
      showStatus('Anthropic API key should start with "sk-ant-"', 'error');
      return;
    }
  } else if (currentProvider === 'openai') {
    if (!openaiApiKey) {
      showStatus('Please enter your OpenAI API key', 'error');
      return;
    }
    if (!openaiApiKey.startsWith('sk-')) {
      showStatus('OpenAI API key should start with "sk-"', 'error');
      return;
    }
  } else if (currentProvider === 'openrouter') {
    if (!openrouterApiKey) {
      showStatus('Please enter your OpenRouter API key', 'error');
      return;
    }
    if (!openrouterModel) {
      showStatus('Please select an OpenRouter model', 'error');
      return;
    }
  }

  const instapaperEnabled = document.getElementById('instapaperEnabled').checked;
  const todoistEnabled = document.getElementById('todoistEnabled').checked;
  const thingsEnabled = document.getElementById('thingsEnabled').checked;
  const readwiseEnabled = document.getElementById('readwiseEnabled').checked;
  const readwiseAccessToken = document.getElementById('readwiseAccessToken').value.trim();
  const raindropEnabled = document.getElementById('raindropEnabled').checked;
  const raindropAccessToken = document.getElementById('raindropAccessToken').value.trim();
  const healthCheckEnabled = document.getElementById('healthCheckEnabled').checked;
  const healthCheckStaleDays = parseInt(document.getElementById('healthCheckStaleDays').value, 10) || 365;
  const activeTab = document.querySelector('.interval-tab.active');
  const healthCheckInterval = activeTab ? activeTab.dataset.interval : 'weekly';

  try {
    await chrome.storage.sync.set({
      aiProvider: currentProvider,
      anthropicApiKey,
      openaiApiKey,
      openaiModel,
      openrouterApiKey,
      openrouterModel,
      instapaperUsername,
      instapaperPassword,
      todoistApiToken,
      instapaperEnabled,
      todoistEnabled,
      thingsEnabled,
      domainRules,
      readwiseEnabled,
      readwiseAccessToken,
      raindropEnabled,
      raindropAccessToken,
      healthCheckEnabled,
      healthCheckInterval,
      healthCheckStaleDays
    });

    // Also set the alarm in background for health checks
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'setupHealthCheckAlarm' }).catch(() => {});
    }

    showStatus('Settings saved successfully!', 'success');
    setTimeout(hideStatus, 3000);
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('Error saving settings: ' + error.message, 'error');
  }
}

async function resetSettings() {
  try {
    await chrome.storage.sync.set({ ...DEFAULT_SETTINGS, todoistEnabled: false, thingsEnabled: false });
    await loadSettings();
    showStatus('Settings reset to default', 'success');
    setTimeout(hideStatus, 3000);
  } catch (error) {
    console.error('Error resetting settings:', error);
    showStatus('Error resetting settings: ' + error.message, 'error');
  }
}

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type} visible`;
}

function hideStatus() {
  const statusDiv = document.getElementById('status');
  statusDiv.classList.remove('visible');
}
