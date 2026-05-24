let bookmarks = [];

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
    document.querySelectorAll('.bm-cb').forEach(cb => {
      if (!cb.disabled) cb.checked = e.target.checked;
    });
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

  bookmarks.forEach((bm, idx) => {
    const tr = document.createElement('tr');

    const tdCb = document.createElement('td');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'bm-cb';
    cb.dataset.idx = idx;
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
    tdSug.id = `sug-${idx}`;
    tdSug.textContent = '—';

    const tdStatus = document.createElement('td');
    const statusEl = document.createElement('span');
    statusEl.id = `status-${idx}`;
    statusEl.className = 'row-status ready';
    statusEl.textContent = 'Waiting';
    tdStatus.appendChild(statusEl);

    tr.appendChild(tdCb);
    tr.appendChild(tdTitle);
    tr.appendChild(tdSug);
    tr.appendChild(tdStatus);
    tbody.appendChild(tr);
  });
}

async function analyzeSelected() {
  const checked = [...document.querySelectorAll('.bm-cb:checked')];
  if (checked.length === 0) {
    showAlert('No bookmarks selected.', 'info');
    return;
  }

  const btn = document.getElementById('analyzeBtn');
  btn.disabled = true;
  btn.textContent = 'Analyzing…';
  showAlert(`Analyzing ${checked.length} bookmarks…`, 'loading');

  // Process in batches of 5 to avoid overwhelming the AI API
  const BATCH = 5;
  for (let i = 0; i < checked.length; i += BATCH) {
    await Promise.all(
      checked.slice(i, i + BATCH).map(async (cb) => {
        const idx = parseInt(cb.dataset.idx);
        const bm = bookmarks[idx];
        await analyzeOne(bm, idx);
      })
    );
  }

  btn.textContent = 'Analyze Selected';
  btn.disabled = false;

  // Automate organizing successfully analyzed bookmarks
  const successfullyAnalyzed = checked.filter(cb => {
    const bm = bookmarks[parseInt(cb.dataset.idx)];
    return bm && bm.suggestedFolder;
  });

  if (successfullyAnalyzed.length > 0) {
    showAlert(`Analysis complete. Automatically organizing ${successfullyAnalyzed.length} bookmark(s) into suggested folders…`, 'loading');
    await applySelected();
  } else {
    showAlert('Analysis complete, but no folder suggestions were generated.', 'error');
    updateButtonCounts();
  }
}

async function analyzeOne(bm, idx) {
  setStatus(idx, 'analyzing', 'Analyzing…');
  try {
    const res = await chrome.runtime.sendMessage({
      action: 'getAISuggestion',
      url: bm.url,
      title: bm.title
    });
    if (res.success) {
      bm.suggestedFolder = res.matchedCategory;
      renderSuggestion(idx, res.matchedCategory);
      setStatus(idx, 'ready', 'Ready');
    } else {
      setStatus(idx, 'error', res.error || 'Error');
    }
  } catch (e) {
    setStatus(idx, 'error', e.message);
  }
}

function renderSuggestion(idx, folder) {
  const cell = document.getElementById(`sug-${idx}`);
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
      bookmarks[idx].suggestedFolder = newFolder;
      renderSuggestion(idx, newFolder);
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') renderSuggestion(idx, folder);
    });
  });

  cell.appendChild(badge);
}

async function applySelected() {
  const checked = [...document.querySelectorAll('.bm-cb:checked')];
  const toMove = checked.filter(cb => {
    const bm = bookmarks[parseInt(cb.dataset.idx)];
    return bm && bm.suggestedFolder;
  });

  if (toMove.length === 0) {
    showAlert('No analyzed bookmarks selected.', 'info');
    return;
  }

  const btn = document.getElementById('applyBtn');
  btn.disabled = true;

  for (const cb of toMove) {
    const idx = parseInt(cb.dataset.idx);
    const bm = bookmarks[idx];
    setStatus(idx, 'moving', 'Moving…');
    try {
      await chrome.runtime.sendMessage({
        action: 'moveBookmark',
        bookmarkId: bm.id,
        categoryPath: bm.suggestedFolder
      });
      setStatus(idx, 'done', 'Moved');
      cb.checked = false;
      cb.disabled = true;
    } catch (e) {
      setStatus(idx, 'error', 'Failed: ' + e.message);
    }
  }

  if (btn) btn.disabled = false;
  await loadUnsortedBookmarks();
  showAlert('Done automatically organizing bookmarks.', 'success');
}

function setStatus(idx, state, text) {
  const el = document.getElementById(`status-${idx}`);
  if (!el) return;
  el.className = `row-status ${state}`;
  el.textContent = text;
}

async function deleteSelected() {
  const checked = [...document.querySelectorAll('.bm-cb:checked')];
  const toDelete = checked.map(cb => {
    const idx = parseInt(cb.dataset.idx);
    return { cb, idx, bm: bookmarks[idx] };
  }).filter(item => item.bm);

  if (toDelete.length === 0) {
    showAlert('No bookmarks selected for deletion.', 'info');
    return;
  }

  if (confirm(`Are you sure you want to delete ${toDelete.length} selected bookmark(s)?`)) {
    const btn = document.getElementById('deleteSelectedBtn');
    btn.disabled = true;

    for (const item of toDelete) {
      setStatus(item.idx, 'moving', 'Deleting…');
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'deleteBookmark',
          bookmarkId: item.bm.id
        });
        if (response.success) {
          item.cb.checked = false;
          item.cb.disabled = true;
          setStatus(item.idx, 'done', 'Deleted');
        } else {
          setStatus(item.idx, 'error', 'Failed: ' + response.error);
        }
      } catch (e) {
        setStatus(item.idx, 'error', 'Failed: ' + e.message);
      }
    }

    btn.disabled = false;
    await loadUnsortedBookmarks();
  }
}

function updateButtonCounts() {
  const checked = document.querySelectorAll('.bm-cb:checked');
  const count = checked.length;
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
