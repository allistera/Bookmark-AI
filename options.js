// Default settings
const DEFAULT_SETTINGS = {
  aiProvider: 'anthropic',
  anthropicApiKey: '',
  openrouterApiKey: '',
  openrouterModel: '',
  instapaperUsername: '',
  instapaperPassword: '',
  todoistApiToken: ''
};

let currentProvider = 'anthropic';

// Load saved settings on page load
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

  // Provider tab switching
  document.querySelectorAll('.provider-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentProvider = tab.dataset.provider;
      updateProviderUI(currentProvider);
    });
  });

  document.getElementById('loadModelsBtn').addEventListener('click', () => loadOpenRouterModels());
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
  document.getElementById('openrouterSection').style.display = provider === 'openrouter' ? 'block' : 'none';
}

async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

    currentProvider = settings.aiProvider || 'anthropic';
    updateProviderUI(currentProvider);

    document.getElementById('anthropicApiKey').value = settings.anthropicApiKey;
    document.getElementById('openrouterApiKey').value = settings.openrouterApiKey;
    document.getElementById('instapaperUsername').value = settings.instapaperUsername;
    document.getElementById('instapaperPassword').value = settings.instapaperPassword;
    document.getElementById('todoistApiToken').value = settings.todoistApiToken;

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
    select.innerHTML = '<option value="">Select a model...</option>';

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

  try {
    await chrome.storage.sync.set({
      aiProvider: currentProvider,
      anthropicApiKey,
      openrouterApiKey,
      openrouterModel,
      instapaperUsername,
      instapaperPassword,
      todoistApiToken
    });

    showStatus('Settings saved successfully!', 'success');
    setTimeout(hideStatus, 3000);
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('Error saving settings: ' + error.message, 'error');
  }
}

async function resetSettings() {
  try {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
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
