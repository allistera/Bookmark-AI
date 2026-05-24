import fs from 'fs';

let html = fs.readFileSync('options.html', 'utf8');

// We will inject the new CSS styles
html = html.replace('.page {', `
    .page-container {
      display: flex;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 24px;
      gap: 32px;
    }
    .sidebar {
      width: 200px;
      flex-shrink: 0;
    }
    .sidebar-header {
      margin-bottom: 24px;
    }
    .sidebar-header h1 {
      font-size: 20px;
      font-weight: 500;
      color: #202124;
      margin-bottom: 4px;
    }
    .sidebar-header p {
      font-size: 13px;
      color: #5f6368;
    }
    .nav-menu {
      display: flex;
      flex-direction: column;
      gap: 4px;
      position: sticky;
      top: 40px;
    }
    .nav-item {
      padding: 10px 16px;
      border-radius: 6px;
      color: #5f6368;
      text-decoration: none;
      font-weight: 500;
      font-size: 14px;
      transition: background 0.15s, color 0.15s;
      cursor: pointer;
    }
    .nav-item:hover {
      background: #f1f3f4;
      color: #202124;
    }
    .nav-item.active {
      background: #e8f0fe;
      color: #1967d2;
    }
    .content {
      flex: 1;
    }
    .settings-section {
      display: none;
    }
    .settings-section.active {
      display: block;
    }
    .page {`);

// Also add styles for the interval tabs and stale row from health-check.html
html = html.replace('</style>', `
    .interval-tabs { display: flex; border: 1px solid #dadce0; border-radius: 4px; overflow: hidden; margin-top: 8px; width: fit-content; }
    .interval-tab { flex: 1; padding: 6px 16px; border: none; background: #fff; font-size: 13px; color: #5f6368; cursor: pointer; font-weight: 500; }
    .interval-tab:not(:last-child) { border-right: 1px solid #dadce0; }
    .interval-tab.active { background: #1a73e8; color: #fff; }
    .interval-tab:not(.active):hover { background: #f8f9fa; color: #202124; }
    .stale-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
    .stale-input { width: 80px; padding: 6px 10px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px; font-family: inherit; }
    .stale-input:focus { outline: none; border-color: #1a73e8; }
    .stale-unit { font-size: 13px; color: #202124; }
  </style>`);

// Update HTML structure
const newBodyStart = `
<body>
  <div class="page-container">
    <div class="sidebar">
      <div class="sidebar-header">
        <h1>Bookmark AI</h1>
        <p>Settings</p>
      </div>
      <nav class="nav-menu">
        <a class="nav-item active" data-section="section-provider">AI Provider</a>
        <a class="nav-item" data-section="section-integrations">Integrations</a>
        <a class="nav-item" data-section="section-rules">Domain Rules</a>
        <a class="nav-item" data-section="section-health">Health Checks</a>
      </nav>
    </div>
    <div class="content">
      <form id="settingsForm">`;

html = html.replace(/<body>\s*<div class="page">\s*<div class="header">[\s\S]*?<\/div>\s*<form id="settingsForm">/, newBodyStart);

// Wrap sections
html = html.replace('<div class="card">\n        <div class="card-header">\n          <span class="card-title">AI Provider</span>', '<div id="section-provider" class="settings-section active">\n      <div class="card">\n        <div class="card-header">\n          <span class="card-title">AI Provider</span>');
html = html.replace('<div class="card">\n        <div class="card-header">\n          <span class="card-title">Instapaper</span>', '</div>\n      <div id="section-integrations" class="settings-section">\n      <div class="card">\n        <div class="card-header">\n          <span class="card-title">Instapaper</span>');
html = html.replace('<div class="card">\n        <div class="card-header">\n          <span class="card-title">Domain Rules</span>', '</div>\n      <div id="section-rules" class="settings-section">\n      <div class="card">\n        <div class="card-header">\n          <span class="card-title">Domain Rules</span>');

// Replace Bookmark Health Check with the new settings
const healthSettingsCard = `</div>
      <div id="section-health" class="settings-section">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Automatic Health Checks</span>
            <span class="badge optional">Optional</span>
          </div>
          <div class="card-body">
            <div class="form-group form-group-inline">
              <label class="toggle-label">
                <input type="checkbox" id="healthCheckEnabled" name="healthCheckEnabled">
                <span>Enable automatic checks</span>
              </label>
            </div>
            <div class="form-hint" style="margin-bottom:20px">
              Runs a health check in the background on the selected schedule. Results appear in the Health Check page.
            </div>

            <div class="form-group" id="intervalGroup">
              <label class="form-label">Frequency</label>
              <div class="interval-tabs">
                <button type="button" class="interval-tab active" data-interval="weekly">Weekly</button>
                <button type="button" class="interval-tab" data-interval="daily">Daily</button>
                <button type="button" class="interval-tab" data-interval="monthly">Monthly</button>
              </div>
            </div>

            <div class="form-group" id="staleGroup">
              <label class="form-label">Mark bookmarks as stale after</label>
              <div class="stale-row">
                <input type="number" id="healthCheckStaleDays" name="healthCheckStaleDays" class="stale-input" min="30" max="3650" value="365">
                <span class="stale-unit">days without being opened</span>
              </div>
              <div class="form-hint" style="margin-top:6px">
                Chrome tracks when bookmarks were last visited. Bookmarks older than this threshold are flagged as stale.
              </div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">Manual Health Check</span>
            <span class="badge optional">Tool</span>
          </div>
          <div class="card-body">
            <p class="form-hint" style="margin-bottom:12px">
              Scan your bookmarks for dead links, redirects, stale content, and disappeared domains manually.
            </p>
            <a href="health-check.html" class="btn btn-secondary" style="display:inline-block;text-decoration:none;margin-right:8px">
              Open Health Check
            </a>
          </div>
        </div>
      </div>`;

html = html.replace(/<div class="card">\s*<div class="card-header">\s*<span class="card-title">Bookmark Health Check<\/span>[\s\S]*?<\/div>\s*<\/div>/, healthSettingsCard);

fs.writeFileSync('options.html', html);
console.log('Updated options.html');
