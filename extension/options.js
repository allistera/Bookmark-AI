// Default settings
const DEFAULT_SETTINGS = {
  apiEndpoint: '',
  apiKey: '',
  prependFolder: ''
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
    document.getElementById('apiEndpoint').value = settings.apiEndpoint;
    document.getElementById('apiKey').value = settings.apiKey;
    document.getElementById('prependFolder').value = settings.prependFolder || '';
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Error loading settings', 'error');
  }
}

async function saveSettings(event) {
  event.preventDefault();

  const apiEndpoint = document.getElementById('apiEndpoint').value.trim();
  const apiKey = document.getElementById('apiKey').value.trim();
  const prependFolder = document.getElementById('prependFolder').value.trim();

  // Validate API endpoint is not empty
  if (!apiEndpoint || apiEndpoint === '') {
    showStatus('Please enter an API endpoint URL', 'error');
    return;
  }

  // Validate API key is not empty
  if (!apiKey || apiKey === '') {
    showStatus('Please enter an API key', 'error');
    return;
  }

  // Validate URL format
  try {
    const url = new URL(apiEndpoint);
    // Ensure it's https
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      showStatus('API endpoint must use HTTP or HTTPS protocol', 'error');
      return;
    }
  } catch (error) {
    showStatus('Please enter a valid URL (e.g., https://bookmark-ai.your-account.workers.dev)', 'error');
    return;
  }

  // Save to storage
  try {
    await chrome.storage.sync.set({
      apiEndpoint: apiEndpoint,
      apiKey: apiKey,
      prependFolder: prependFolder
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
