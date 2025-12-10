// Default settings
const DEFAULT_SETTINGS = {
  anthropicApiKey: '',
  instapaperUsername: '',
  instapaperPassword: '',
  todoistApiToken: ''
};

// Load saved settings on page load
document.addEventListener('DOMContentLoaded', loadSettings);

// Handle form submission
document.getElementById('settingsForm').addEventListener('submit', saveSettings);

// Handle reset button
document.getElementById('resetBtn').addEventListener('click', resetSettings);

async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

    // Populate form fields
    document.getElementById('anthropicApiKey').value = settings.anthropicApiKey;
    document.getElementById('instapaperUsername').value = settings.instapaperUsername;
    document.getElementById('instapaperPassword').value = settings.instapaperPassword;
    document.getElementById('todoistApiToken').value = settings.todoistApiToken;
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Error loading settings', 'error');
  }
}

async function saveSettings(event) {
  event.preventDefault();

  const anthropicApiKey = document.getElementById('anthropicApiKey').value.trim();
  const instapaperUsername = document.getElementById('instapaperUsername').value.trim();
  const instapaperPassword = document.getElementById('instapaperPassword').value;
  const todoistApiToken = document.getElementById('todoistApiToken').value.trim();

  // Validate Anthropic API key is not empty
  if (!anthropicApiKey || anthropicApiKey === '') {
    showStatus('Please enter your Anthropic API key', 'error');
    return;
  }

  // Validate API key format (basic check)
  if (!anthropicApiKey.startsWith('sk-ant-')) {
    showStatus('Anthropic API key should start with "sk-ant-"', 'error');
    return;
  }

  // Save to storage
  try {
    await chrome.storage.sync.set({
      anthropicApiKey: anthropicApiKey,
      instapaperUsername: instapaperUsername,
      instapaperPassword: instapaperPassword,
      todoistApiToken: todoistApiToken
    });

    showStatus('Settings saved successfully!', 'success');

    // Clear status after 3 seconds
    setTimeout(() => {
      hideStatus();
    }, 3000);
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('Error saving settings: ' + error.message, 'error');
  }
}

async function resetSettings() {
  try {
    // Reset to defaults
    await chrome.storage.sync.set(DEFAULT_SETTINGS);

    // Reload form
    await loadSettings();

    showStatus('Settings reset to default', 'success');

    // Clear status after 3 seconds
    setTimeout(() => {
      hideStatus();
    }, 3000);
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
