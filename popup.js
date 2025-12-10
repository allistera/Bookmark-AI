let currentUrl = '';
let currentTitle = '';

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab) {
    currentUrl = tab.url;
    currentTitle = tab.title;
    document.getElementById('urlDisplay').textContent = currentUrl;
  }

  const settings = await chrome.storage.sync.get({ anthropicApiKey: '' });
  if (!settings.anthropicApiKey || settings.anthropicApiKey.trim() === '') {
    showStatus('API key not configured. Open Settings to add your Anthropic API key.', 'warning');
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
  container.innerHTML = `<div class="status ${type}">${icons[type] || ''}<span>${message}</span></div>`;
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
    document.getElementById('categories').innerHTML = data.categories
      .map(cat => `<span class="tag">${cat}</span>`)
      .join('');
    document.getElementById('categoriesContainer').style.display = 'block';
  } else {
    document.getElementById('categoriesContainer').style.display = 'none';
  }

  if (data.instapaper) {
    const el = document.getElementById('instapaperStatus');
    if (data.instapaper.saved) {
      el.innerHTML = '<span class="dot success"></span><a href="https://www.instapaper.com/u" target="_blank" style="color: inherit;">Saved</a>';
    } else {
      el.innerHTML = '<span class="dot error"></span>Not saved';
    }
    document.getElementById('instapaperContainer').style.display = 'block';
  }

  if (data.todoist) {
    const el = document.getElementById('todoistStatus');
    if (data.todoist.created) {
      el.innerHTML = '<span class="dot success"></span>Task created';
    } else {
      el.innerHTML = '<span class="dot error"></span>Not created';
    }
    document.getElementById('todoistContainer').style.display = 'block';
  }
}
