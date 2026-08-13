let bookmarks = [];
let bookmarksById = new Map();
let rowsById = new Map(); // bookmarkId -> { tr, checkbox, sugCell, statusEl }

document.addEventListener('DOMContentLoaded', async () => {
  await loadUnsortedBookmarks();

  // Delegated listener — handles all checkbox changes without per-row binding
  document.getElementById('bookmarkRows').addEventListener('change', (e) => {
    if (e.target.classList.contains('bm-cb')) updateButtonCounts();
  });

  document.getElementById('analyzeBtn').addEventListener('click', analyzeSelected);
  document.getElementById('deleteSelectedBtn').addEventListener('click', deleteSelected);
  document.getElementById('applyBtn').addEventListener('click', applySelected);
  document.getElementById('selectAll').addEventListener('change', (e) => {
    for (const row of rowsById.values()) {
      if (!row.checkbox.disabled) row.checkbox.checked = e.target.checked;
    }
    updateButtonCounts();
  });
});

async function loadUnsortedBookmarks() {
  let response;
  try {
    response = await chrome.runtime.sendMessage({ action: 'getUnsortedBookmarks' });
  } catch (e) {
    showAlert('Extension error: ' + e.message, 'error');
    return;
  }
  if (!response.success) {
    showAlert('Error loading bookmarks: ' + response.error, 'error');
    return;
  }
  bookmarks = response.bookmarks;
  bookmarksById = new Map(bookmarks.map(bm => [bm.id, bm]));
  if (bookmarks.length === 0) {
    showAlert('All bookmarks are already organized — nothing to sort!', 'success');
    document.getElementById('tableCard').style.display = 'none';
    document.getElementById('deleteSelectedBtn').style.display = 'none';
    return;
  }
  showAlert(`Found ${bookmarks.length} unsorted bookmark${bookmarks.length !== 1 ? 's' : ''}. Click "Analyze Selected" to get AI folder suggestions.`, 'info');
  renderTable();
  document.getElementById('tableCard').style.display = '';
  document.getElementById('deleteSelectedBtn').style.display = '';
  updateButtonCounts();
}

function renderTable() {
  const tbody = document.getElementById('bookmarkRows');
  tbody.textContent = '';
  rowsById = new Map();

  // Build off-DOM and append once — appending each row directly into the live table
  // forces a layout pass per row, which adds up for a large inbox.
  const fragment = document.createDocumentFragment();

  for (const bm of bookmarks) {
    const tr = document.createElement('tr');

    const tdCb = document.createElement('td');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'bm-cb';
    cb.checked = true;
    tdCb.appendChild(cb);

    const tdTitle = document.createElement('td');
    const titleDiv = document.createElement('div');
    titleDiv.className = 'bm-title';
    const link = document.createElement('a');
    link.href = bm.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = bm.title || bm.url;
    titleDiv.appendChild(link);
    const urlDiv = document.createElement('div');
    urlDiv.className = 'bm-url';
    urlDiv.textContent = bm.url;
    tdTitle.appendChild(titleDiv);
    tdTitle.appendChild(urlDiv);

    const tdSug = document.createElement('td');
    tdSug.textContent = '—';

    const tdStatus = document.createElement('td');
    const statusEl = document.createElement('span');
    statusEl.className = 'row-status ready';
    statusEl.textContent = 'Waiting';
    tdStatus.appendChild(statusEl);

    tr.appendChild(tdCb);
    tr.appendChild(tdTitle);
    tr.appendChild(tdSug);
    tr.appendChild(tdStatus);
    fragment.appendChild(tr);

    rowsById.set(bm.id, { tr, checkbox: cb, sugCell: tdSug, statusEl });
  }

  tbody.appendChild(fragment);
}

async function analyzeSelected() {
  const checkedIds = [...rowsById.entries()]
    .filter(([, row]) => row.checkbox.checked)
    .map(([id]) => id);

  if (checkedIds.length === 0) {
    showAlert('No bookmarks selected.', 'info');
    return;
  }

  const btn = document.getElementById('analyzeBtn');
  btn.disabled = true;
  btn.textContent = 'Analyzing…';
  showAlert(`Analyzing ${checkedIds.length} bookmarks…`, 'loading');

  // Process in batches of 5 to avoid overwhelming the AI API
  const BATCH = 5;
  for (let i = 0; i < checkedIds.length; i += BATCH) {
    await Promise.all(
      checkedIds.slice(i, i + BATCH).map(id => analyzeOne(bookmarksById.get(id)))
    );
  }

  btn.textContent = 'Analyze Selected';
  btn.disabled = false;

  // Automate organizing successfully analyzed bookmarks
  const successfullyAnalyzed = checkedIds.filter(id => bookmarksById.get(id)?.suggestedFolder);

  if (successfullyAnalyzed.length > 0) {
    showAlert(`Analysis complete. Automatically organizing ${successfullyAnalyzed.length} bookmark(s) into suggested folders…`, 'loading');
    await applySelected();
  } else {
    showAlert('Analysis complete, but no folder suggestions were generated.', 'error');
    updateButtonCounts();
  }
}

async function analyzeOne(bm) {
  if (!bm) return;
  setStatus(bm.id, 'analyzing', 'Analyzing…');
  try {
    const res = await chrome.runtime.sendMessage({
      action: 'getAISuggestion',
      url: bm.url,
      title: bm.title
    });
    if (res.success) {
      bm.suggestedFolder = res.matchedCategory;
      renderSuggestion(bm.id, res.matchedCategory);
      setStatus(bm.id, 'ready', 'Ready');
    } else {
      setStatus(bm.id, 'error', res.error || 'Error');
    }
  } catch (e) {
    setStatus(bm.id, 'error', e.message);
  }
}

function renderSuggestion(bookmarkId, folder) {
  const row = rowsById.get(bookmarkId);
  if (!row) return;
  const cell = row.sugCell;
  cell.textContent = '';

  const badge = document.createElement('span');
  badge.className = 'suggestion';
  badge.textContent = folder;
  badge.title = 'Click to edit';
  badge.style.cursor = 'pointer';

  badge.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'suggestion-edit';
    input.value = folder;
    cell.textContent = '';
    cell.appendChild(input);
    input.focus();
    input.select();

    const commit = () => {
      const newFolder = input.value.trim() || folder;
      const bm = bookmarksById.get(bookmarkId);
      if (bm) bm.suggestedFolder = newFolder;
      renderSuggestion(bookmarkId, newFolder);
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') renderSuggestion(bookmarkId, folder);
    });
  });

  cell.appendChild(badge);
}

async function applySelected() {
  const toMove = [...rowsById.entries()]
    .filter(([id, row]) => row.checkbox.checked && bookmarksById.get(id)?.suggestedFolder)
    .map(([id]) => id);

  if (toMove.length === 0) {
    showAlert('No analyzed bookmarks selected.', 'info');
    return;
  }

  const btn = document.getElementById('applyBtn');
  btn.disabled = true;

  toMove.forEach(id => setStatus(id, 'moving', 'Moving…'));

  const items = toMove.map(id => ({ bookmarkId: id, categoryPath: bookmarksById.get(id).suggestedFolder }));

  let response;
  try {
    // One message for the whole batch — the background page resolves each distinct
    // folder path once instead of the page sending (and re-resolving) one move per row.
    response = await chrome.runtime.sendMessage({ action: 'moveBookmarks', items });
  } catch (e) {
    toMove.forEach(id => setStatus(id, 'error', 'Failed: ' + e.message));
    btn.disabled = false;
    return;
  }

  const resultById = new Map((response.results || []).map(r => [r.bookmarkId, r]));
  const movedIds = [];

  for (const id of toMove) {
    const result = resultById.get(id);
    if (result && result.success) {
      setStatus(id, 'done', 'Moved');
      movedIds.push(id);
    } else {
      setStatus(id, 'error', 'Failed: ' + (result ? result.error : 'Unknown error'));
    }
  }

  // Patch out the rows that actually left the unsorted set instead of re-fetching
  // and re-rendering the whole table.
  removeRows(movedIds);

  btn.disabled = false;
  updateButtonCounts();
  showAlert('Done automatically organizing bookmarks.', 'success');
}

async function deleteSelected() {
  const toDelete = [...rowsById.entries()]
    .filter(([, row]) => row.checkbox.checked)
    .map(([id]) => id);

  if (toDelete.length === 0) {
    showAlert('No bookmarks selected for deletion.', 'info');
    return;
  }

  if (!confirm(`Are you sure you want to delete ${toDelete.length} selected bookmark(s)?`)) {
    return;
  }

  const btn = document.getElementById('deleteSelectedBtn');
  btn.disabled = true;

  toDelete.forEach(id => setStatus(id, 'moving', 'Deleting…'));

  let response;
  try {
    response = await chrome.runtime.sendMessage({ action: 'deleteBookmarks', bookmarkIds: toDelete });
  } catch (e) {
    toDelete.forEach(id => setStatus(id, 'error', 'Failed: ' + e.message));
    btn.disabled = false;
    return;
  }

  const resultById = new Map((response.results || []).map(r => [r.bookmarkId, r]));
  const deletedIds = [];

  for (const id of toDelete) {
    const result = resultById.get(id);
    if (result && result.success) {
      setStatus(id, 'done', 'Deleted');
      deletedIds.push(id);
    } else {
      setStatus(id, 'error', 'Failed: ' + (result ? result.error : 'Unknown error'));
    }
  }

  removeRows(deletedIds);

  btn.disabled = false;
  updateButtonCounts();
}

/**
 * Removes rows for bookmarks that have left the unsorted set (moved or deleted)
 * directly from the DOM and local state, instead of re-fetching the remaining
 * unsorted bookmarks and re-rendering the whole table.
 */
function removeRows(bookmarkIds) {
  if (bookmarkIds.length === 0) return;
  const idSet = new Set(bookmarkIds);

  for (const id of bookmarkIds) {
    const row = rowsById.get(id);
    if (row) row.tr.remove();
    rowsById.delete(id);
    bookmarksById.delete(id);
  }
  bookmarks = bookmarks.filter(bm => !idSet.has(bm.id));

  if (bookmarks.length === 0) {
    document.getElementById('tableCard').style.display = 'none';
    document.getElementById('deleteSelectedBtn').style.display = 'none';
  }
}

function setStatus(bookmarkId, state, text) {
  const row = rowsById.get(bookmarkId);
  if (!row) return;
  row.statusEl.className = `row-status ${state}`;
  row.statusEl.textContent = text;
}

function updateButtonCounts() {
  let count = 0;
  for (const row of rowsById.values()) {
    if (row.checkbox.checked) count++;
  }
  document.getElementById('applyBtn').textContent = `Move Selected (${count})`;
  document.getElementById('deleteSelectedBtn').textContent = `Delete Selected (${count})`;
  document.getElementById('deleteSelectedBtn').disabled = count === 0;
  document.getElementById('analyzeBtn').disabled = count === 0;
}

function showAlert(msg, type) {
  const el = document.getElementById('alertBox');
  el.textContent = msg;
  el.className = `alert alert-${type}`;
}
