document.addEventListener('DOMContentLoaded', async () => {
  await loadProviders();

  document.getElementById('urlInput').addEventListener('input', () => {
    const hasUrl = document.getElementById('urlInput').value.trim() !== '';
    document.getElementById('runBtn').disabled = !hasUrl;
  });

  document.getElementById('useTabBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.url) {
      document.getElementById('urlInput').value = tab.url;
      document.getElementById('runBtn').disabled = false;
    }
  });

  document.getElementById('runBtn').addEventListener('click', runBenchmark);
});

async function loadProviders() {
  const settings = await chrome.storage.sync.get({
    aiProvider: 'anthropic',
    anthropicApiKey: '',
    openaiApiKey: '',
    openaiModel: 'gpt-4o',
    openrouterApiKey: '',
    openrouterModel: ''
  });

  const providers = [];
  if (settings.anthropicApiKey?.trim()) providers.push('Claude Haiku');
  if (settings.openaiApiKey?.trim())     providers.push(settings.openaiModel || 'GPT-4o');
  if (settings.openrouterApiKey?.trim() && settings.openrouterModel) providers.push(settings.openrouterModel);

  const list = document.getElementById('providersList');
  list.textContent = '';

  if (providers.length === 0) {
    const msg = document.createElement('span');
    msg.className = 'no-providers';
    msg.textContent = 'No providers configured. Add API keys in Settings.';
    list.appendChild(msg);
    document.getElementById('runBtn').disabled = true;
    return;
  }

  providers.forEach(name => {
    const chip = document.createElement('span');
    chip.className = 'provider-chip';
    chip.textContent = name;
    list.appendChild(chip);
  });
}

async function runBenchmark() {
  const url = document.getElementById('urlInput').value.trim();
  if (!url) return;

  const btn = document.getElementById('runBtn');
  btn.disabled = true;

  showAlert('Running benchmark — this may take a few seconds…', 'loading');
  showResults([]);

  let title = '';
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.url === url) title = tab.title || '';
  } catch { /* ignore */ }

  const response = await chrome.runtime.sendMessage({ action: 'runBenchmark', url, title });

  if (!response.success) {
    showAlert(response.error, 'error');
    btn.disabled = false;
    return;
  }

  showAlert(`Benchmark complete across ${response.results.length} provider${response.results.length !== 1 ? 's' : ''}.`, 'success');
  showResults(response.results);
  btn.disabled = false;
}

function showResults(results) {
  const section = document.getElementById('resultsSection');
  const tbody = document.getElementById('resultsBody');
  tbody.textContent = '';

  if (results.length === 0) {
    section.style.display = 'none';
    return;
  }

  results.forEach(r => {
    const tr = document.createElement('tr');

    // Model
    const tdModel = document.createElement('td');
    const name = document.createElement('div');
    name.className = 'model-name';
    name.textContent = r.label;
    tdModel.appendChild(name);

    // Folder
    const tdFolder = document.createElement('td');
    if (r.success) {
      const badge = document.createElement('span');
      badge.className = 'folder-badge';
      badge.textContent = r.matchedCategory;
      tdFolder.appendChild(badge);
    } else {
      const err = document.createElement('span');
      err.className = 'status-error';
      err.textContent = r.error || 'Error';
      tdFolder.appendChild(err);
    }

    // Content type
    const tdType = document.createElement('td');
    tdType.textContent = r.success ? (r.isArticle ? 'Article' : (r.contentType || '—')) : '—';
    tdType.style.color = '#5f6368';

    // Latency
    const tdLatency = document.createElement('td');
    if (r.latencyMs !== undefined) {
      const secs = (r.latencyMs / 1000).toFixed(2);
      const span = document.createElement('span');
      span.className = `latency ${r.latencyMs < 2000 ? 'fast' : r.latencyMs < 5000 ? 'medium' : 'slow'}`;
      span.textContent = `${secs}s`;
      tdLatency.appendChild(span);
    } else {
      tdLatency.textContent = '—';
    }

    tr.appendChild(tdModel);
    tr.appendChild(tdFolder);
    tr.appendChild(tdType);
    tr.appendChild(tdLatency);
    tbody.appendChild(tr);
  });

  section.style.display = '';
}

function showAlert(msg, type) {
  const el = document.getElementById('alertBox');
  el.textContent = msg;
  el.className = `alert alert-${type}`;
  el.style.display = '';
}
