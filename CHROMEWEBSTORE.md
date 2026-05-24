# Chrome Web Store Listing — Bookmark AI

> Last Updated: 2026-05-20

## Store Listing

**Extension Name**
Bookmark AI

**Short Description**
Automatically organizes, categorizes, and summarizes your browser bookmarks using AI.

**Detailed Description**
Automatically organizes webpage bookmarks into structured folders using AI-powered analysis.

FEATURES
• Automated Organization — Analyzes page context using Claude, GPT-4, or OpenRouter to file bookmarks into relevant folders.
• Context Summaries — Generates brief webpage summaries and stores them in the bookmark description.
• Link Health Audits — Scans your bookmarks to identify broken links, redirects, changed webpage titles, and unvisited stale bookmarks.
• Direct Integrations — Syncs links to Todoist tasks, Instapaper, Readwise, Raindrop, or macOS/iOS Things.
• Context Menu Support — Bookmark any page or link directly via the right-click context menu.

HOW TO USE
1. Click the Bookmark AI icon in the toolbar.
2. Select your integration choices (e.g., Todoist, Instapaper, or Things).
3. Click "Analyze & Save" to organize and summarize the bookmark.

PRIVACY
Bookmark AI is a serverless, local-first extension. All API keys and settings are stored locally in your browser. Webpage content and metadata are sent directly to your chosen AI provider for classification and are never shared with any other third party.

PERMISSIONS
• "bookmarks" — Required to read your folder tree and automatically file or update bookmarks.
• "activeTab" — Required to temporarily retrieve the URL and title of the active tab for categorization when clicked.
• "storage" — Required to locally save configurations and API keys in your browser.
• "contextMenus" — Required to display the right-click shortcut to bookmark pages.
• "alarms" — Required to schedule periodic, low-priority background scans for link health checks.
• Host Permissions — Required to securely send text metadata to Anthropic, OpenAI, OpenRouter, Instapaper, or Todoist APIs.

SUPPORT
Found a bug? Have a suggestion? Open an issue on our GitHub repository: https://github.com/allistera/Bookmark-AI

Version 2.2.0 — Added detailed descriptions of link health check tools and updated package versions.

**Category**
Productivity

**Single Purpose**
Automatically organizes bookmarks into structured folders using AI analysis.

**Primary Language**
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icons/icon128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | 🟡 Needs update | `docs/screenshots/popup_analysis.png` |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | 🟡 Needs update | `docs/screenshots/settings_configuration.png` |
| Screenshot 3 [RECOMMENDED] | 1280×800 or 640×400 | 🟡 Needs update | `docs/screenshots/bookmark_tree.png` |
| Screenshot 4 | 1280×800 or 640×400 | 🟡 Needs update | `docs/screenshots/health_check.png` |
| Small Promo Tile [RECOMMENDED] | 440×280 | 🟡 Needs update | `docs/screenshots/promo_tile_small.png` |
| Marquee Promo Tile | 1400×560 | 🟡 Needs update | `docs/screenshots/promo_tile_marquee.png` |

### Screenshot Notes
* **Screenshot 1 (Popup / Extension in Action)**: Show the popup displaying a completed page analysis, complete with the AI-suggested category, summary, content type, and active integrations.
* **Screenshot 2 (Extension Settings)**: Show the clean settings interface, showcasing the toggle options, AI provider selections (Anthropic / OpenRouter), and third-party credential configuration.
* **Screenshot 3 (Organized Bookmark Tree)**: Show a visual before-and-after or a screenshot of Chrome's bookmark manager demonstrating the neat, nested folder hierarchies created by the extension.
* **Screenshot 4 (Link Health Check)**: Show the extension's self-healing link manager interface listing broken URLs, redirects, and duplicates with action items.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `bookmarks` | permissions | Required to read the user's existing folder paths for AI matching, and to programmatically create/nest new bookmark folders and bookmarks on the user's device. |
| `activeTab` | permissions | Required to temporarily retrieve the active page's URL and title for categorization when the extension popup is opened or context menu is clicked. |
| `storage` | permissions | Required to locally store and persist API keys, selected AI models, active integration settings, and health check records on the user's browser. |
| `contextMenus` | permissions | Required to register and display the "Analyze and Bookmark with AI" shortcut option when right-clicking on webpage canvases, links, or selections. |
| `alarms` | permissions | Required to schedule periodic, low-priority background scans for the bookmark health-check feature to identify broken, dead, or redirected links. |
| `https://api.anthropic.com/*` | host_permissions | Required to directly transmit webpage text, URLs, and existing category paths to Anthropic's Claude models for secure, serverless categorization and summarization. |
| `https://api.openai.com/*` | host_permissions | Required to directly transmit webpage text, URLs, and existing category paths to OpenAI's GPT models for secure, serverless categorization and summarization. |
| `https://www.instapaper.com/*` | host_permissions | Required to securely authenticate and save bookmarked articles directly to the user's Instapaper account when the optional integration is enabled. |
| `https://api.todoist.com/*` | host_permissions | Required to securely authenticate and create task entries directly in the user's Todoist workspace when the optional integration is enabled. |
| `https://*/*` | host_permissions | Required to fetch and extract raw webpage HTML/metadata from active web pages, enabling the AI models to categorize pages based on full body content instead of titles alone. |
| `http://*/*` | host_permissions | Required to fetch and extract raw webpage HTML/metadata from active HTTP web pages, enabling the AI models to categorize pages based on full body content instead of titles alone. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** Yes

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | No | No | N/A | No |
| Health info | No | No | N/A | No |
| Financial info | No | No | N/A | No |
| Authentication info | Yes | Yes (Direct to APIs) | Key settings (API tokens, passwords) are stored locally in Chrome storage and transmitted directly to configured APIs (Anthropic, OpenAI, Todoist, Instapaper) to authenticate actions. | No |
| Personal communications | No | No | N/A | No |
| Location | No | No | N/A | No |
| Web history | Yes | Yes (Direct to APIs) | The URL of the webpage being bookmarked is processed locally and transmitted to the selected AI provider to classify the website. | No |
| User activity | No | No | N/A | No |
| Website content | Yes | Yes (Direct to APIs) | The page title, folder names, and optional page HTML content are processed locally and transmitted to the selected AI provider to analyze and summarize the content. | No |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL**
https://github.com/allistera/Bookmark-AI/blob/main/PRIVACY.md

## Distribution

**Visibility**: Public
**Regions**: All regions
**Pricing**: Free

## Developer Info

**Publisher Name**
Allister Antosik

**Contact Email**
allister.antosik@example.com

**Support URL / Email**
https://github.com/allistera/Bookmark-AI/issues

**Homepage URL**
https://github.com/allistera/Bookmark-AI

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 2.2.0 | 2026-05-20 | Bumped version to 2.2.0 to resolve Web Store upload conflicts; expanded Bookmark Health Check feature descriptions in developer README and store listing documentation. | Draft |
| 2.1.0 | 2026-05-20 | Rebuilt service worker with clean Manifest V3 async/await IIFE routines; completely eliminated legacy callback-to-Promise wrapper utilities across search.js and health-check.js; optimized link health check scanner with robust error handling; updated permissions justifications. | Published |
| 1.0.0 | 2025-03-15 | Initial public release containing multi-provider AI analysis (Anthropic & OpenRouter), full Chrome bookmarks integration, Instapaper, Todoist, and Cultured Code Things support, and interactive link health diagnostics. | Published |

## Review Notes

### Known Issues / Limitations
* Fetching raw HTML metadata may fail on dynamic, single-page application (SPA) websites that require Javascript execution or authentication to display content. In these cases, the extension falls back cleanly to the tab's page title for AI analysis.
* Things integration uses the `things://` system URL scheme which requires the Cultured Code Things application to be installed locally on macOS or iOS. No API key is required.

### Rejection History
No rejection history.
