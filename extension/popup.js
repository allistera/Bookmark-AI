// Get current tab URL on load
let currentUrl = '';
let currentTitle = '';

document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab) {
    currentUrl = tab.url;
    currentTitle = tab.title;
    document.getElementById('urlDisplay').textContent = currentUrl;
  }

  // Set up event listeners
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

  // Disable button
  analyzeBtn.disabled = true;

  // Show loading status
  showStatus('Analyzing bookmark...', 'loading');

  try {
    // Send message to background script to analyze
    const response = await chrome.runtime.sendMessage({
      action: 'analyzeBookmark',
      url: currentUrl,
      title: currentTitle,
      createTodoist: createTodoist,
      autoBookmark: autoBookmark
    });

    if (response.success) {
      showStatus('Analysis complete!', 'success');
      displayResults(response.data);

      // If auto-bookmark is enabled, the background script already created the bookmark
      if (autoBookmark && response.data.bookmarkCreated) {
        showStatus('Bookmarked successfully to: ' + response.data.matchedCategory, 'success');
      }
    } else {
      showStatus('Error: ' + response.error, 'error');
    }
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
  } finally {
    analyzeBtn.disabled = false;
  }
}

function showStatus(message, type) {
  const statusContainer = document.getElementById('statusContainer');
  statusContainer.innerHTML = `<div class="status ${type}">${message}</div>`;
}

function displayResults(data) {
  const resultsDiv = document.getElementById('results');
  resultsDiv.classList.add('visible');

  // Display matched category
  if (data.matchedCategory) {
    document.getElementById('matchedCategory').textContent = data.matchedCategory;
    document.getElementById('matchedCategoryContainer').style.display = 'block';
  } else {
    document.getElementById('matchedCategoryContainer').style.display = 'none';
  }

  // Display title
  document.getElementById('resultTitle').textContent = data.title || 'N/A';

  // Display summary
  document.getElementById('resultSummary').textContent = data.summary || 'N/A';

  // Display content type
  document.getElementById('contentType').textContent =
    data.isArticle ? 'Article' : (data.contentType || 'N/A');

  // Display categories
  if (data.categories && data.categories.length > 0) {
    const categoriesDiv = document.getElementById('categories');
    categoriesDiv.innerHTML = data.categories
      .map(cat => `<span class="category-tag">${cat}</span>`)
      .join('');
    document.getElementById('categoriesContainer').style.display = 'block';
  } else {
    document.getElementById('categoriesContainer').style.display = 'none';
  }

  // Display Instapaper status
  if (data.instapaper) {
    const instapaperContainer = document.getElementById('instapaperContainer');
    const instapaperStatus = document.getElementById('instapaperStatus');

    if (data.instapaper.saved) {
      instapaperStatus.textContent = `Saved (ID: ${data.instapaper.bookmarkId})`;
      instapaperStatus.style.color = '#2e7d32';
    } else {
      instapaperStatus.textContent = 'Not saved';
      instapaperStatus.style.color = '#666';
    }
    instapaperContainer.style.display = 'block';
  }

  // Display Todoist status
  if (data.todoist) {
    const todoistContainer = document.getElementById('todoistContainer');
    const todoistStatus = document.getElementById('todoistStatus');

    if (data.todoist.created) {
      todoistStatus.textContent = `Task created (ID: ${data.todoist.taskId})`;
      todoistStatus.style.color = '#2e7d32';
    } else {
      todoistStatus.textContent = 'Task not created';
      todoistStatus.style.color = '#666';
    }
    todoistContainer.style.display = 'block';
  }
}
