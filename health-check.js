let currentFilter = 'issues';
let currentResults = null;
let pollTimer = null;

// ── Initialization ──────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await loadScheduleSettings();
  await loadResults();

  document.getElementById('runBtn').addEventListener('click', runHealthCheck);
  document.getElementById('saveScheduleBtn').addEventListener('click', saveScheduleSettings);
  document.getElementById('healthCheckEnabled').addEventListener('change', toggleScheduleVisibility);

  // Summary card filters
  document.querySelectorAll('.summary-card').forEach(card => {
    card.addEventListener('click', () => {
      setFilter(card.dataset.filter);
    });
  });

  // Interval tab switching
  document.querySelectorAll('.interval-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.interval-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  // Bulk actions
  document.getElementById('bulkDeleteDead').addEventListener('click', () => bulkFix('deleteAllDead'));
  document.getElementById('bulkFixRedirects').addEventListener('click', () => bulkFix('fixAllRedirects'));
  document.getElementById('bulkDismissStale').addEventListener('click', () => bulkFix('dismissAllStale'));

  toggleScheduleVisibility();
});

// ── Schedule settings ────────────────────────────────────────

async function loadScheduleSettings() {
  const settings = await chrome.storage.sync.get({
    healthCheckEnabled: false,
    healthCheckInterval: 'weekly',
    healthCheckStaleDays: 365
  });

  document.getElementById('healthCheckEnabled').checked = settings.healthCheckEnabled;
  document.getElementById('healthCheckStaleDays').value = settings.healthCheckStaleDays;

  document.querySelectorAll('.interval-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.interval === settings.healthCheckInterval);
  });

  toggleScheduleVisibility();
}

function toggleScheduleVisibility() {
  const enabled = document.getElementById('healthCheckEnabled').checked;
  document.getElementById('intervalGroup').style.opacity = enabled ? '1' : '0.4';
  document.getElementById('staleGroup').style.opacity = enabled ? '1' : '0.4';
}

async function saveScheduleSettings() {
  const enabled = document.getElementById('healthCheckEnabled').checked;
  const staleDays = parseInt(document.getElementById('healthCheckStaleDays').value, 10) || 365;
  const activeTab = document.querySelector('.interval-tab.active');
  const interval = activeTab ? activeTab.dataset.interval : 'weekly';

  await chrome.storage.sync.set({
    healthCheckEnabled: enabled,
    healthCheckInterval: interval,
    healthCheckStaleDays: Math.max(30, Math.min(3650, staleDays))
  });

  // Tell background to update the alarm
  await sendMessage({ action: 'setupHealthCheckAlarm' });

  showScheduleStatus('Settings saved!', 'success');
  setTimeout(() => hideScheduleStatus(), 3000);
}

function showScheduleStatus(msg, type) {
  const el = document.getElementById('scheduleStatus');
  el.textContent = msg;
  el.className = `status-msg ${type} visible`;
}

function hideScheduleStatus() {
  document.getElementById('scheduleStatus').classList.remove('visible');
}

// ── Run health check ─────────────────────────────────────────

async function runHealthCheck() {
  const btn = document.getElementById('runBtn');
  btn.disabled = true;
  btn.textContent = 'Running…';

  showProgress(0, 0);
  startProgressPolling();

  try {
    const result = await sendMessage({ action: 'runHealthCheck' });
    stopProgressPolling();
    hideProgress();
    if (result && result.success) {
      await loadResults();
    } else {
      showError(result ? result.error : 'Health check failed.');
    }
  } catch (err) {
    stopProgressPolling();
    hideProgress();
    showError(err.message || 'Unexpected error running health check.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Run Health Check';
  }
}

function startProgressPolling() {
  pollTimer = setInterval(async () => {
    const data = await chrome.storage.local.get('healthCheckProgress');
    if (data.healthCheckProgress) {
      const { current, total } = data.healthCheckProgress;
      showProgress(current, total);
    }
  }, 500);
}

function stopProgressPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

function showProgress(current, total) {
  const section = document.getElementById('progressSection');
  section.style.display = 'block';
  document.getElementById('progressCurrent').textContent = current;
  document.getElementById('progressTotal').textContent = total;
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  document.getElementById('progressBarFill').style.width = `${pct}%`;
}

function hideProgress() {
  document.getElementById('progressSection').style.display = 'none';
}

// ── Load & render results ─────────────────────────────────────

async function loadResults() {
  const data = await chrome.storage.local.get(['healthCheckResults', 'healthCheckProgress']);

  // If a check is in progress, show progress bar and wait
  if (data.healthCheckProgress && data.healthCheckProgress.inProgress) {
    const { current, total } = data.healthCheckProgress;
    showProgress(current, total);
    startProgressPolling();
    return;
  }

  if (!data.healthCheckResults) {
    renderEmptyState('no-data');
    return;
  }

  currentResults = data.healthCheckResults;
  renderSummary(currentResults.summary, currentResults.lastRun);
  renderResults(currentResults.results);
}

function renderSummary(summary, lastRun) {
  const issueCount = (summary.dead || 0) + (summary.domainGone || 0) +
    (summary.redirected || 0) + (summary.stale || 0) + (summary.titleChanged || 0);

  document.getElementById('sumIssues').textContent = issueCount;
  document.getElementById('sumDead').textContent = summary.dead || 0;
  document.getElementById('sumDomainGone').textContent = summary.domainGone || 0;
  document.getElementById('sumRedirected').textContent = summary.redirected || 0;
  document.getElementById('sumStale').textContent = summary.stale || 0;
  document.getElementById('sumTitleChanged').textContent = summary.titleChanged || 0;
  document.getElementById('sumOk').textContent = summary.ok || 0;

  if (lastRun) {
    const d = new Date(lastRun);
    document.getElementById('lastRunLabel').textContent = `Last checked: ${d.toLocaleString()}`;
  }
}

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.summary-card').forEach(c => {
    c.classList.toggle('active', c.dataset.filter === filter);
  });
  if (currentResults) renderResults(currentResults.results);
}

function renderResults(results) {
  const list = document.getElementById('resultsList');
  list.textContent = '';

  const filtered = filterResults(results, currentFilter);

  updateBulkBar(results);

  if (filtered.length === 0) {
    renderEmptyState(currentFilter === 'ok' ? 'all-good' : 'no-issues');
    return;
  }

  for (const entry of filtered) {
    list.appendChild(buildResultCard(entry));
  }
}

function filterResults(results, filter) {
  // Always hide dismissed items unless explicitly showing "ok" (healthy)
  switch (filter) {
  case 'issues':
    return results.filter(r => r.issues.length > 0 && !r.dismissed && !r.fixed);
  case 'dead':
    return results.filter(r => r.issues.includes('dead') && !r.dismissed);
  case 'domain_gone':
    return results.filter(r => r.issues.includes('domain_gone') && !r.dismissed);
  case 'redirect':
    return results.filter(r => r.issues.includes('redirect') && !r.dismissed);
  case 'stale':
    return results.filter(r => r.issues.includes('stale') && !r.dismissed);
  case 'title_changed':
    return results.filter(r => r.issues.includes('title_changed') && !r.dismissed);
  case 'ok':
    return results.filter(r => r.issues.length === 0 || r.fixed);
  default:
    return results;
  }
}

function buildResultCard(entry) {
  const card = document.createElement('div');
  card.className = `result-card${entry.dismissed ? ' dismissed' : ''}${entry.fixed ? ' fixed' : ''}`;
  card.dataset.id = entry.id;

  // Header row: title + badges
  const header = document.createElement('div');
  header.className = 'result-header';

  const title = document.createElement('div');
  title.className = 'result-title';
  title.textContent = entry.title || '(untitled)';
  header.appendChild(title);

  // Badges for each issue
  const badgeGroup = document.createElement('div');
  badgeGroup.style.display = 'flex';
  badgeGroup.style.gap = '4px';
  badgeGroup.style.flexShrink = '0';

  if (entry.fixed) {
    badgeGroup.appendChild(makeBadge('Fixed', 'fixed'));
  } else if (entry.dismissed) {
    badgeGroup.appendChild(makeBadge('Dismissed', 'ok'));
  } else {
    for (const issue of entry.issues) {
      badgeGroup.appendChild(makeBadge(issueLabel(issue), issue));
    }
  }
  header.appendChild(badgeGroup);
  card.appendChild(header);

  // URL
  const urlEl = document.createElement('a');
  urlEl.className = 'result-url';
  urlEl.href = entry.url;
  urlEl.target = '_blank';
  urlEl.rel = 'noopener noreferrer';
  urlEl.textContent = entry.url;
  card.appendChild(urlEl);

  // Meta info
  const meta = buildMetaLine(entry);
  if (meta) { card.appendChild(meta); }

  // Redirect target
  if (entry.newUrl && !entry.fixed) {
    const redirectInfo = document.createElement('div');
    redirectInfo.className = 'result-new-url';
    redirectInfo.innerHTML = `<strong>Redirects to:</strong> ${escapeHtml(entry.newUrl)}`;
    card.appendChild(redirectInfo);
  }

  // New title suggestion
  if (entry.newTitle && !entry.fixed) {
    const titleInfo = document.createElement('div');
    titleInfo.className = 'result-new-url';
    titleInfo.innerHTML = `<strong>New title:</strong> ${escapeHtml(entry.newTitle)}`;
    card.appendChild(titleInfo);
  }

  // Action buttons
  if (!entry.dismissed && !entry.fixed) {
    const actions = buildActionButtons(entry);
    card.appendChild(actions);
  }

  return card;
}

function buildMetaLine(entry) {
  const parts = [];

  if (entry.statusCode) {
    parts.push(`HTTP ${entry.statusCode}`);
  }

  if (entry.dateLastUsed) {
    parts.push(`Last visited ${timeAgo(entry.dateLastUsed)}`);
  } else if (entry.dateAdded) {
    parts.push(`Added ${timeAgo(entry.dateAdded)}`);
  }

  if (entry.checkedAt) {
    parts.push(`Checked ${timeAgo(new Date(entry.checkedAt).getTime())}`);
  }

  if (parts.length === 0) return null;

  const el = document.createElement('div');
  el.className = 'result-meta';
  el.textContent = parts.join(' · ');
  return el;
}

function buildActionButtons(entry) {
  const row = document.createElement('div');
  row.className = 'result-actions';

  if (entry.issues.includes('redirect') && entry.newUrl) {
    const btn = makeButton('Update URL', 'btn-primary btn-sm', async () => {
      await applyFix(entry.id, 'updateUrl', entry.newUrl);
    });
    row.appendChild(btn);
  }

  if (entry.issues.includes('title_changed') && entry.newTitle) {
    const btn = makeButton('Update Title', 'btn-secondary btn-sm', async () => {
      await applyFix(entry.id, 'updateTitle', entry.newTitle);
    });
    row.appendChild(btn);
  }

  if (entry.issues.includes('dead') || entry.issues.includes('domain_gone')) {
    const btn = makeButton('Delete Bookmark', 'btn-danger btn-sm', async () => {
      if (confirm(`Delete "${entry.title || entry.url}"?`)) {
        await applyFix(entry.id, 'delete');
      }
    });
    row.appendChild(btn);
  }

  // Dismiss always available (except already-dismissed)
  const dismiss = makeButton('Dismiss', 'btn-ghost btn-sm', async () => {
    await dismiss_(entry.id);
  });
  row.appendChild(dismiss);

  return row;
}

// ── Actions ───────────────────────────────────────────────────

async function applyFix(bookmarkId, fixType, newValue) {
  const result = await sendMessage({ action: 'applyHealthFix', bookmarkId, fixType, newValue });
  if (result && result.success) {
    await refreshResults();
  } else {
    alert('Could not apply fix: ' + (result ? result.error : 'Unknown error'));
  }
}

async function dismiss_(bookmarkId) {
  await sendMessage({ action: 'dismissHealthIssue', bookmarkId });
  await refreshResults();
}

async function bulkFix(fixType) {
  if (!currentResults) return;

  let ids = [];
  let confirmMsg = '';

  if (fixType === 'deleteAllDead') {
    ids = currentResults.results
      .filter(r => (r.issues.includes('dead') || r.issues.includes('domain_gone')) && !r.dismissed)
      .map(r => r.id);
    confirmMsg = `Delete ${ids.length} dead bookmarks? This cannot be undone.`;
  } else if (fixType === 'fixAllRedirects') {
    ids = currentResults.results
      .filter(r => r.issues.includes('redirect') && r.newUrl && !r.dismissed)
      .map(r => r.id);
    confirmMsg = `Update URL for ${ids.length} redirected bookmarks?`;
  } else if (fixType === 'dismissAllStale') {
    ids = currentResults.results
      .filter(r => r.issues.includes('stale') && !r.dismissed)
      .map(r => r.id);
    confirmMsg = `Dismiss ${ids.length} stale bookmarks?`;
  }

  if (ids.length === 0) return;
  if (!confirm(confirmMsg)) return;

  await sendMessage({ action: 'applyBulkFix', fixType, ids });
  await refreshResults();
}

async function refreshResults() {
  const data = await chrome.storage.local.get('healthCheckResults');
  if (data.healthCheckResults) {
    currentResults = data.healthCheckResults;
    renderSummary(currentResults.summary, currentResults.lastRun);
    renderResults(currentResults.results);
  }
}

// ── Bulk action bar visibility ────────────────────────────────

function updateBulkBar(results) {
  const deadCount = results.filter(r =>
    (r.issues.includes('dead') || r.issues.includes('domain_gone')) && !r.dismissed
  ).length;
  const redirectCount = results.filter(r => r.issues.includes('redirect') && r.newUrl && !r.dismissed).length;
  const staleCount = results.filter(r => r.issues.includes('stale') && !r.dismissed).length;

  const bulkDeleteDead = document.getElementById('bulkDeleteDead');
  const bulkFixRedirects = document.getElementById('bulkFixRedirects');
  const bulkDismissStale = document.getElementById('bulkDismissStale');

  bulkDeleteDead.style.display = deadCount > 1 ? 'inline-block' : 'none';
  bulkDeleteDead.textContent = `Delete all dead (${deadCount})`;

  bulkFixRedirects.style.display = redirectCount > 1 ? 'inline-block' : 'none';
  bulkFixRedirects.textContent = `Fix all redirects (${redirectCount})`;

  bulkDismissStale.style.display = staleCount > 1 ? 'inline-block' : 'none';
  bulkDismissStale.textContent = `Dismiss all stale (${staleCount})`;

  const anyBulk = deadCount > 1 || redirectCount > 1 || staleCount > 1;
  document.getElementById('bulkBar').style.display = anyBulk ? 'flex' : 'none';
}

// ── Empty states ──────────────────────────────────────────────

function renderEmptyState(type) {
  const list = document.getElementById('resultsList');
  list.textContent = '';
  document.getElementById('bulkBar').style.display = 'none';

  const el = document.createElement('div');
  el.className = 'empty-state';

  if (type === 'no-data') {
    el.innerHTML = '<div class="empty-icon">🔍</div><p>No health check has been run yet.<br>Click <strong>Run Health Check</strong> to scan your bookmarks.</p>';
  } else if (type === 'all-good') {
    el.innerHTML = '<div class="empty-icon">✅</div><p>All healthy bookmarks are shown here once you run a check.</p>';
  } else {
    el.innerHTML = '<div class="empty-icon">✅</div><p>No issues found in this category.</p>';
  }

  list.appendChild(el);
}

function showError(msg) {
  const list = document.getElementById('resultsList');
  list.textContent = '';
  const el = document.createElement('div');
  el.className = 'empty-state';
  el.innerHTML = `<div class="empty-icon">⚠️</div><p>${escapeHtml(msg)}</p>`;
  list.appendChild(el);
}

// ── Helpers ───────────────────────────────────────────────────

function sendMessage(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function makeBadge(label, type) {
  const span = document.createElement('span');
  span.className = `badge badge-${type}`;
  span.textContent = label;
  return span;
}

function makeButton(label, classes, onClick) {
  const btn = document.createElement('button');
  btn.className = `btn ${classes}`;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function issueLabel(issue) {
  return {
    dead: 'Dead Link',
    domain_gone: 'Domain Gone',
    redirect: 'Redirect',
    stale: 'Stale',
    title_changed: 'Title Changed'
  }[issue] || issue;
}

function timeAgo(timestampMs) {
  const seconds = Math.floor((Date.now() - timestampMs) / 1000);
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
  return `${years}yr ago`;
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
