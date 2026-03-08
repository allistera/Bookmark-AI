let currentUrl = '';
let currentTitle = '';

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab) {
    currentUrl = tab.url;
    currentTitle = tab.title;
    document.getElementById('urlDisplay').textContent = currentUrl;
  }

  const settings = await chrome.storage.sync.get({
    aiProvider: 'anthropic',
    anthropicApiKey: '',
    openrouterApiKey: '',
    openrouterModel: ''
  });
  const provider = settings.aiProvider || 'anthropic';
  let configWarning = null;
  if (provider === 'anthropic' && (!settings.anthropicApiKey || settings.anthropicApiKey.trim() === '')) {
    configWarning = 'API key not configured. Open Settings to add your Anthropic API key.';
  } else if (provider === 'openrouter' && (!settings.openrouterApiKey || settings.openrouterApiKey.trim() === '')) {
    configWarning = 'OpenRouter API key not configured. Open Settings to add it.';
  } else if (provider === 'openrouter' && (!settings.openrouterModel || settings.openrouterModel.trim() === '')) {
    configWarning = 'No OpenRouter model selected. Open Settings to choose one.';
  }
  if (configWarning) {
    showStatus(configWarning, 'warning');
    document.getElementById('analyzeBtn').disabled = true;
  }

  document.getElementById('analyzeBtn').addEventListener('click', analyzeAndBookmark);
  document.getElementById('cancelBtn').addEventListener('click', () => window.close());
  document.getElementById('settingsLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});

async function analyzeAndBookmark() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const autoBookmark = document.getElementById('autoBookmark').checked;
  const createTodoist = document.getElementById('createTodoist').checked;

  analyzeBtn.disabled = true;
  showStatus('Analyzing page...', 'loading');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'analyzeBookmark',
      url: currentUrl,
      title: currentTitle,
      createTodoist: createTodoist,
      autoBookmark: autoBookmark
    });

    if (response.success) {
      displayResults(response.data);
      if (autoBookmark && response.data.bookmarkCreated) {
        showStatus('Saved to ' + response.data.matchedCategory, 'success');
      } else if (response.data.isArticle && response.data.instapaper?.saved) {
        showStatus('Article saved to Instapaper', 'success');
      } else {
        showStatus('Analysis complete', 'success');
      }
    } else {
      showStatus(response.error, 'error');
    }
  } catch (error) {
    showStatus(error.message, 'error');
  } finally {
    analyzeBtn.disabled = false;
  }
}

function showStatus(message, type) {
  const container = document.getElementById('statusContainer');
  const icons = {
    loading: '<svg class="status-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/></svg>',
    success: '<svg class="status-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
    error: '<svg class="status-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
    warning: '<svg class="status-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>'
  };

  container.innerHTML = '';
  const statusDiv = document.createElement('div');
  statusDiv.className = `status ${type}`;
  statusDiv.innerHTML = icons[type] || '';

  const span = document.createElement('span');
  span.textContent = message;
  statusDiv.appendChild(span);

  container.appendChild(statusDiv);
}

function displayResults(data) {
  const resultsDiv = document.getElementById('results');
  resultsDiv.classList.add('visible');

  if (data.matchedCategory && !data.isArticle) {
    document.getElementById('matchedCategory').textContent = data.matchedCategory;
    document.getElementById('matchedCategoryContainer').style.display = 'block';
  } else {
    document.getElementById('matchedCategoryContainer').style.display = 'none';
  }

  document.getElementById('resultTitle').textContent = data.title || 'N/A';
  document.getElementById('resultSummary').textContent = data.summary || 'N/A';
  document.getElementById('contentType').textContent = data.isArticle ? 'Article' : (data.contentType || 'N/A');

  if (data.categories && data.categories.length > 0) {
    const categoriesContainer = document.getElementById('categories');
    categoriesContainer.innerHTML = '';
    data.categories.forEach(cat => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = cat;
      categoriesContainer.appendChild(span);
    });
    document.getElementById('categoriesContainer').style.display = 'block';
  } else {
    document.getElementById('categoriesContainer').style.display = 'none';
  }

  if (data.instapaper) {
    const el = document.getElementById('instapaperStatus');
    el.innerHTML = '';
    const dot = document.createElement('span');
    dot.className = `dot ${data.instapaper.saved ? 'success' : 'error'}`;
    el.appendChild(dot);

    if (data.instapaper.saved) {
      const link = document.createElement('a');
      link.href = 'https://www.instapaper.com/u';
      link.target = '_blank';
      link.style.color = 'inherit';
      link.textContent = 'Saved';
      el.appendChild(link);
    } else {
      el.appendChild(document.createTextNode('Not saved'));
    }
    document.getElementById('instapaperContainer').style.display = 'block';
  }

  if (data.todoist) {
    const el = document.getElementById('todoistStatus');
    el.innerHTML = '';
    const dot = document.createElement('span');
    dot.className = `dot ${data.todoist.created ? 'success' : 'error'}`;
    el.appendChild(dot);

    const text = document.createTextNode(data.todoist.created ? 'Task created' : 'Not created');
    el.appendChild(text);

    document.getElementById('todoistContainer').style.display = 'block';
  }
}
