# Chrome Web Store Listing — Bookmark AI

> Last Updated: 2026-05-20

## Store Listing

**Extension Name**
Bookmark AI

**Short Description**
AI-powered bookmark organizer that automatically categorizes, summarizes, and structures bookmarks using Claude or OpenAI.

**Detailed Description**
Save time and clean up your digital chaos. Bookmark AI is an intelligent assistant that automatically categorizes, summarizes, and organizes your browser bookmarks into a structured hierarchy using state-of-the-art AI.

Rather than dumping links into a single unorganized folder, Bookmark AI analyzes the webpage content, reads your existing Chrome bookmark structure, and dynamically places the bookmark into the most relevant folder. If a suitable folder does not exist, it intelligently suggests and creates one for you.

Key Features:
* Automated AI Organization: Uses Anthropic (Claude) or OpenRouter (GPT-4, Llama, Gemini) to analyze and structure links.
* Context-Aware Summaries: Extracts and stores brief webpage summaries directly in the bookmark description.
* Deep Integrations: Automatically syncs saved links to your favorite productivity tools, including Instapaper (for articles), Todoist (for tasks), and Cultured Code Things (for macOS/iOS to-dos).
* Right-Click Context Menu: Instant bookmarking from any link or page via the right-click menu.
* Self-Healing Health Checks: Scan, identify, and bulk-resolve dead links (HTTP 404/5xx), redirected URLs, changed webpage titles, stale unvisited bookmarks, and unreachable offline domains automatically.

Self-Healing Bookmark Health Checks:
Websites change, pages move, and domains expire. Bookmark AI includes a sophisticated, privacy-respecting link checker built directly into your browser:
* Dead & Expired Links: Flags broken HTTP statuses (404, 410, 500) and completely unreachable or defunct domains.
* Smart Redirect Fixer: Detects permanent/temporary page transfers and updates your bookmark URLs in one click.
* Title Synchronizer: Inspects HTML headers to retrieve live page titles and offers to update your bookmark labels to match.
* Declutter Stale Links: Flags bookmarks that have sat unvisited past a user-configured threshold (e.g., 365 days).
* Automatic Scheduling: Runs background scans on a Daily, Weekly, or Monthly alarm, with missed scan catch-up on browser startup.
* Interactive Dashboard & Bulk Actions: Filter issues by category and apply one-click bulk operations to fix all redirects, update all titles, or purge all dead links simultaneously.
* Safe & Gentle Scanning: Throttles checks in small batches of 5 with 150ms pauses and 12-second timeouts to protect your local bandwidth and respect remote server limits.

How to Use:
1. Navigate to any webpage you want to bookmark.
2. Click the Bookmark AI toolbar icon or right-click any page or link and choose "Analyze and Bookmark with AI".
3. Choose your integrations (e.g., Save to Instapaper, Create task in Todoist, or Add to Things).
4. Click "Analyze & Save". Watch the AI categorize, summarize, and file your bookmark cleanly.

Privacy & Local First:
Bookmark AI operates with no middleman backend servers. All API tokens, configuration settings, and credentials are saved locally in your Chrome secure storage and transmitted directly to your selected API endpoints (Anthropic, OpenRouter, Todoist, and Instapaper). Your data stays entirely in your control.

Support & Feedback:
For issues, bug reports, and features, visit the open-source repository at https://github.com/allistera/Bookmark-AI.

**Category**
Productivity

**Single Purpose**
Uses artificial intelligence to automatically categorize, summarize, and organize webpage bookmarks into structured folders.

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
