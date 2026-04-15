let currentUrl = '';
let currentTitle = '';

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab) {
    currentUrl = tab.url;
    currentTitle = tab.title;
  }

  document.getElementById('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const query = e.target.value.trim();
      if (query) {
        chrome.tabs.create({ url: chrome.runtime.getURL('search.html') + '?q=' + encodeURIComponent(query) });
      }
    }
  });

  const settings = await chrome.storage.sync.get({
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
    readwiseEnabled: false,
    readwiseAccessToken: '',
    raindropEnabled: false,
    raindropAccessToken: ''
  });

  function isMacOrIOS() {
    return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.platform === 'MacIntel';
  }
  const provider = settings.aiProvider || 'anthropic';
  let configWarning = null;
  if (provider === 'anthropic' && (!settings.anthropicApiKey || settings.anthropicApiKey.trim() === '')) {
    configWarning = 'API key not configured. Open Settings to add your Providers API key.';
  } else if (provider === 'openai' && (!settings.openaiApiKey || settings.openaiApiKey.trim() === '')) {
    configWarning = 'OpenAI API key not configured. Open Settings to add it.';
  } else if (provider === 'openrouter' && (!settings.openrouterApiKey || settings.openrouterApiKey.trim() === '')) {
    configWarning = 'OpenRouter API key not configured. Open Settings to add it.';
  } else if (provider === 'openrouter' && (!settings.openrouterModel || settings.openrouterModel.trim() === '')) {
    configWarning = 'No OpenRouter model selected. Open Settings to choose one.';
  }
  if (configWarning) {
    showStatus(configWarning, 'warning');
    document.getElementById('analyzeBtn').disabled = true;
  }

  // Only show Instapaper option if enabled in settings and credentials are set
  const instapaperRow = document.getElementById('saveToInstapaperRow');
  if (instapaperRow) {
    if (settings.instapaperEnabled !== false && settings.instapaperUsername?.trim() && settings.instapaperPassword) {
      instapaperRow.style.display = '';
    } else {
      instapaperRow.style.display = 'none';
      const instapaperCheckbox = document.getElementById('saveToInstapaper');
      if (instapaperCheckbox) instapaperCheckbox.checked = false;
    }
  }

  // Only show Todoist option if enabled in settings and token is set
  const todoistRow = document.getElementById('createTodoistRow');
  if (todoistRow) {
    if (settings.todoistEnabled !== false && settings.todoistApiToken?.trim()) {
      todoistRow.style.display = '';
    } else {
      todoistRow.style.display = 'none';
      const todoistCheckbox = document.getElementById('createTodoist');
      if (todoistCheckbox) todoistCheckbox.checked = false;
    }
  }

  // Only show Things option if enabled in settings and on Mac/iOS (where Things app runs)
  const thingsRow = document.getElementById('createThingsRow');
  if (thingsRow) {
    if (settings.thingsEnabled !== false && isMacOrIOS()) {
      thingsRow.style.display = '';
    } else {
      thingsRow.style.display = 'none';
      const thingsCheckbox = document.getElementById('createThings');
      if (thingsCheckbox) thingsCheckbox.checked = false;
    }
  }

  // Only show Readwise option if enabled and token is set
  const readwiseRow = document.getElementById('saveToReadwiseRow');
  if (readwiseRow) {
    if (settings.readwiseEnabled && settings.readwiseAccessToken?.trim()) {
      readwiseRow.style.display = '';
    } else {
      readwiseRow.style.display = 'none';
      const readwiseCheckbox = document.getElementById('saveToReadwise');
      if (readwiseCheckbox) readwiseCheckbox.checked = false;
    }
  }

  // Only show Raindrop option if enabled and token is set
  const raindropRow = document.getElementById('saveToRaindropRow');
  if (raindropRow) {
    if (settings.raindropEnabled && settings.raindropAccessToken?.trim()) {
      raindropRow.style.display = '';
    } else {
      raindropRow.style.display = 'none';
      const raindropCheckbox = document.getElementById('saveToRaindrop');
      if (raindropCheckbox) raindropCheckbox.checked = false;
    }
  }

  document.getElementById('analyzeBtn').addEventListener('click', analyzeAndBookmark);
  document.getElementById('cancelBtn').addEventListener('click', () => window.close());
  document.getElementById('settingsLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('searchLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('search.html') });
  });

  document.getElementById('healthCheckLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('health-check.html') });
  });
});

async function analyzeAndBookmark() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const autoBookmark = document.getElementById('autoBookmark').checked;
  const saveToInstapaper = document.getElementById('saveToInstapaper').checked;
  const createTodoist = document.getElementById('createTodoist').checked;
  const createThings = document.getElementById('createThings').checked;
  const saveToReadwise = document.getElementById('saveToReadwise').checked;
  const saveToRaindrop = document.getElementById('saveToRaindrop').checked;

  analyzeBtn.disabled = true;
  showStatus('Analyzing page...', 'loading');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'analyzeBookmark',
      url: currentUrl,
      title: currentTitle,
      saveToInstapaper: saveToInstapaper,
      createTodoist: createTodoist,
      createThings: createThings,
      autoBookmark: autoBookmark,
      saveToReadwise: saveToReadwise,
      saveToRaindrop: saveToRaindrop
    });

    if (response.success) {
      displayResults(response.data);
      if (autoBookmark && response.data.bookmarkCreated) {
        showStatus('Saved to ' + response.data.matchedCategory, 'success');
        if (response.data.chromeBookmarkId) {
          showUndoButton(response.data.chromeBookmarkId);
        }
      } else if (saveToInstapaper && response.data.isArticle && response.data.instapaper?.saved) {
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
    loading: '<svg xmlns="http://www.w3.org/2000/svg" class="status-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/></svg>',
    success: '<svg xmlns="http://www.w3.org/2000/svg" class="status-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
    error: '<svg xmlns="http://www.w3.org/2000/svg" class="status-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
    warning: '<svg xmlns="http://www.w3.org/2000/svg" class="status-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>'
  };

  container.textContent = '';
  const statusDiv = document.createElement('div');
  statusDiv.className = `status ${type}`;

  if (icons[type]) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(icons[type], 'image/svg+xml');
    statusDiv.appendChild(doc.documentElement);
  }

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
    categoriesContainer.textContent = '';
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
    el.textContent = '';
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
    el.textContent = '';
    const dot = document.createElement('span');
    dot.className = `dot ${data.todoist.created ? 'success' : 'error'}`;
    el.appendChild(dot);

    const text = document.createTextNode(data.todoist.created ? 'Task created' : 'Not created');
    el.appendChild(text);

    document.getElementById('todoistContainer').style.display = 'block';
  }

  if (data.things) {
    const el = document.getElementById('thingsStatus');
    el.textContent = '';
    const dot = document.createElement('span');
    dot.className = `dot ${data.things.opened ? 'success' : 'error'}`;
    el.appendChild(dot);

    const text = document.createTextNode(data.things.opened ? 'Opened in Things' : (data.things.error || 'Not opened'));
    el.appendChild(text);

    document.getElementById('thingsContainer').style.display = 'block';
  }

  if (data.readwise) {
    const el = document.getElementById('readwiseStatus');
    el.textContent = '';
    const dot = document.createElement('span');
    dot.className = `dot ${data.readwise.saved ? 'success' : 'error'}`;
    el.appendChild(dot);
    el.appendChild(document.createTextNode(data.readwise.saved ? 'Saved' : (data.readwise.error || 'Not saved')));
    document.getElementById('readwiseContainer').style.display = 'block';
  }

  if (data.raindrop) {
    const el = document.getElementById('raindropStatus');
    el.textContent = '';
    const dot = document.createElement('span');
    dot.className = `dot ${data.raindrop.saved ? 'success' : 'error'}`;
    el.appendChild(dot);
    el.appendChild(document.createTextNode(data.raindrop.saved ? 'Saved' : (data.raindrop.error || 'Not saved')));
    document.getElementById('raindropContainer').style.display = 'block';
  }
}

function showUndoButton(bookmarkId) {
  const container = document.getElementById('statusContainer');
  const undoDiv = document.createElement('div');
  undoDiv.style.cssText = 'padding: 4px 12px 0; text-align: right;';

  const btn = document.createElement('button');
  btn.style.cssText = 'background: none; border: none; color: #1a73e8; font-size: 12px; font-weight: 500; cursor: pointer; padding: 4px 0; font-family: inherit;';

  let secondsLeft = 7;
  const updateLabel = () => { btn.textContent = `Undo (${secondsLeft}s)`; };
  updateLabel();

  undoDiv.appendChild(btn);
  container.appendChild(undoDiv);

  const interval = setInterval(() => {
    secondsLeft--;
    if (secondsLeft <= 0) {
      clearInterval(interval);
      undoDiv.remove();
      return;
    }
    updateLabel();
  }, 1000);

  btn.addEventListener('click', async () => {
    clearInterval(interval);
    undoDiv.remove();
    try {
      const response = await chrome.runtime.sendMessage({ action: 'undoBookmark', bookmarkId });
      if (response.success) {
        showStatus('Bookmark removed', 'success');
        document.getElementById('results').classList.remove('visible');
      } else {
        showStatus('Could not undo: ' + response.error, 'error');
      }
    } catch (error) {
      showStatus('Could not undo: ' + error.message, 'error');
    }
  });
}
