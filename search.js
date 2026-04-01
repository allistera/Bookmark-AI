const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const statusCard = document.getElementById('statusCard');
const statusSpinner = document.getElementById('statusSpinner');
const statusText = document.getElementById('statusText');
const resultsContainer = document.getElementById('resultsContainer');
const emptyState = document.getElementById('emptyState');

searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSearch();
});

function showStatus(message, type = 'loading') {
  statusCard.className = 'status-card visible' + (type !== 'loading' ? ` ${type}` : '');
  statusSpinner.style.display = type === 'loading' ? '' : 'none';
  statusText.textContent = message;
}

function hideStatus() {
  statusCard.className = 'status-card';
}

function timeAgo(timestamp) {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function buildResultCard(entry) {
  const card = document.createElement('div');
  card.className = 'result-card';

  const title = document.createElement('div');
  title.className = 'result-title';
  const link = document.createElement('a');
  link.href = entry.url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = entry.title || entry.url;
  title.appendChild(link);
  card.appendChild(title);

  const url = document.createElement('div');
  url.className = 'result-url';
  url.textContent = entry.url;
  card.appendChild(url);

  const meta = document.createElement('div');
  meta.className = 'result-meta';

  if (entry.folderPath) {
    const folder = document.createElement('span');
    folder.className = 'result-folder';
    folder.textContent = entry.folderPath;
    meta.appendChild(folder);
  }

  if (entry.dateAdded) {
    const date = document.createElement('span');
    date.className = 'result-date';
    date.textContent = `Added ${timeAgo(entry.dateAdded)}`;
    meta.appendChild(date);
  }

  const badge = document.createElement('span');
  badge.className = `result-badge ${entry.matchType}`;
  badge.textContent = entry.matchType === 'semantic' ? 'AI match' : 'keyword';
  meta.appendChild(badge);

  card.appendChild(meta);
  return card;
}

function renderResults(results) {
  resultsContainer.textContent = '';
  emptyState.classList.remove('visible');

  if (results.length === 0) {
    emptyState.classList.add('visible');
    return;
  }

  const header = document.createElement('div');
  header.className = 'results-header';
  header.textContent = `Found ${results.length} bookmark${results.length !== 1 ? 's' : ''}`;
  resultsContainer.appendChild(header);

  for (const entry of results) {
    resultsContainer.appendChild(buildResultCard(entry));
  }
}

async function handleSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  searchBtn.disabled = true;
  resultsContainer.textContent = '';
  emptyState.classList.remove('visible');

  try {
    showStatus('Searching bookmarks\u2026');
    const result = await sendMessage({
      action: 'searchBookmarksSemantic',
      semanticIntent: query,
      excludeIds: []
    });

    if (!result.success) throw new Error(result.error);

    renderResults(result.results);
    hideStatus();
  } catch (error) {
    showStatus(error.message, 'error');
  } finally {
    searchBtn.disabled = false;
  }
}

async function init() {
  const result = await sendMessage({ action: 'checkAIConfig' });
  if (!result.hasAI) {
    searchBtn.disabled = true;
    searchInput.disabled = true;
    showStatus('Configure an AI provider in Settings to enable search.', 'info');
  }
}

init();
