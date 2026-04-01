# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Lint
npm run lint
npm run lint:fix

# Build extension (creates bookmark-ai.zip)
npm run build

# Rebuild icons (requires Sharp; run after changing SVG source)
npm run build:icons
```

No test suite is configured.

## Architecture

This is a **Chrome Extension (Manifest v3)** — vanilla JavaScript, no build framework (no Webpack/Vite). The build artifact is a ZIP file.

### Files

| File | Role |
|---|---|
| `background.js` | Service worker — all core logic lives here |
| `popup.js` / `popup.html` | Extension popup UI |
| `options.js` / `options.html` | Settings page |
| `manifest.json` | Extension config, permissions |

### Data flow

1. User opens popup → `popup.js` reads the active tab URL and sends a `analyzeBookmark` message to the service worker
2. `background.js` receives the message, fetches page HTML, retrieves existing bookmark folder structure, and calls the selected AI provider
3. AI returns a JSON categorization; the service worker creates a Chrome bookmark, optionally saves to Instapaper, creates a Todoist task, or opens Things via `things://` URL scheme
4. Service worker posts result back to popup for display

### AI provider abstraction

Three providers share a single `analyzeBookmark()` code path in `background.js`, with branching on the stored `provider` setting:

- **Anthropic** — `claude-haiku-4-5-20251001` (hardcoded)
- **OpenAI** — model configurable in options
- **OpenRouter** — model selectable from dynamic list fetched at settings load

All API keys and settings are stored in `chrome.storage.sync`.

### ESLint style

Flat config (`eslint.config.mjs`): ES2022, single quotes, semicolons, 2-space indent, no trailing spaces.
