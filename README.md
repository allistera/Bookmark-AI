<div align="center">
  <img src="icons/icon128.png" alt="Bookmark AI Icon" width="128" height="128">
</div>

# Bookmark AI Chrome Extension

[![Latest Release](https://img.shields.io/github/v/release/allistera/Bookmark-AI)](https://github.com/allistera/Bookmark-AI/releases/latest)
[![Build Extension](https://github.com/allistera/Bookmark-AI/actions/workflows/build.yml/badge.svg)](https://github.com/allistera/Bookmark-AI/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Chrome extension that uses AI to automatically categorize and organize your bookmarks into a hierarchical folder structure.

## Features

- **AI-Powered Analysis**: Analyzes web pages using **Anthropic (Claude)** or **OpenRouter** (many models) to determine the best category
- **Smart Categorization**: Matches links to your existing bookmark folder structure using AI
- **Instapaper Integration**: Automatically saves articles to Instapaper (if configured)
- **Todoist Integration**: Optionally creates tasks in Todoist for the bookmarks
- **Things Integration**: Optionally add a to-do to Things (macOS/iOS) via its URL scheme—no API key required
- **Right-Click Support**: Add context menu for quick bookmarking

## Installation

### Install from Chrome Extention Store



### Install the Extension Manually

1. **Load in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select this project directory

2. **Configure Settings** (Required):
   - Click the extension icon in your toolbar
   - Click "Extension Settings" at the bottom of the popup
   - Choose **Anthropic** or **OpenRouter** as the AI provider and enter the required API key(s)
   - Optionally add Instapaper and Todoist credentials
   - Click "Save Settings"

## Usage

### Basic Usage

1. Navigate to any web page you want to bookmark
2. Click the Bookmark AI extension icon in your toolbar (You may want to pin it to your bookmark bar!)
3. The popup will show:
   - Current page URL
   - Option to automatically save to bookmarks (checked by default)
   - Option to create a task in Todoist
   - Option to add to Things (macOS/iOS)
   - Option to Save to Instapaper if it is an article (checked by default)
4. Click "Analyze & Save"
5. The extension will:
   - Analyze the page using your chosen AI provider (Anthropic or OpenRouter)
   - Display the AI's analysis results
   - Automatically create the bookmark in the appropriate folder (**or** save articles to Instapaper)

### Bookmark Organization

Bookmarks are organized in your bookmarks bar. The extension uses your existing folder structure and asks the AI to match each link to the best existing folder (or suggest a new one).

```
Bookmarks Bar/
├── Work_and_Engineering/
│   ├── Software_Development/
│   │   └── Your bookmark here
│   └── Design/
├── Entertainment/
│   └── Movies_and_TV/
└── Other/
```

### Features

#### Automatic Bookmarking
When the "Automatically save to bookmarks" option is checked (default), the extension will:
1. Analyze the page with AI
2. Determine the best category
3. Create/find the folder hierarchy
4. Save the bookmark automatically

#### Todoist Integration
If you have Todoist configured in Extension Settings, you can:
1. Check "Create task in Todoist"
2. A task will be created with the bookmark URL and summary

#### Things Integration
If you use [Things](https://culturedcode.com/things/) (macOS/iOS), you can:
1. Check "Add to Things"
2. A new tab opens with a `things://` link; if Things is installed, it will open and create a to-do with the bookmark title, URL, and summary. No API key or settings required.

#### Analysis Results
After analysis, you'll see:
- **Bookmarked to**: The category path where the bookmark was saved
- **Title**: AI-suggested or extracted page title
- **Summary**: Brief summary of the page content
- **Content Type**: Whether it's an article or other content
- **Suggested Categories**: Alternative categories that might fit
- **Instapaper Status**: Whether article was saved to Instapaper with a link
- **Todoist Status**: Whether task was created
- **Things Status**: Whether the Things link was opened

## Configuration

### Extension Settings

Access via: Extension popup → "Extension Settings" link

**AI provider** (choose one):

- **Anthropic (Claude)**
  - **API key** (required if using Anthropic): Your Claude API key. Must start with `sk-ant-`. Get one at [Anthropic](https://console.anthropic.com/).

- **OpenRouter**
  - **API key** (required if using OpenRouter): Get a key at [openrouter.ai/keys](https://openrouter.ai/keys).
  - **Model**: Choose any model from OpenRouter’s list. In Settings, click **Load Models** to fetch the current list, then pick the model you want (e.g. Claude, GPT-4, Llama, etc.).

**Other (optional):**

- **Instapaper username & password**: For saving articles to Instapaper
- **Todoist API token**: For creating tasks in Todoist
- **Things**: No settings needed. Check “Add to Things” in the popup; the extension opens a link that the Things app (macOS/iOS) can handle.

## File Structure

```
├── manifest.json           # Extension configuration
├── popup.html             # Main popup UI
├── popup.js               # Popup logic
├── background.js          # Service worker (handles AI calls & bookmarks)
├── options.html           # Settings page UI
├── options.js             # Settings page logic
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   ├── icon128.png
│   ├── image.png         # Source logo
│   └── icon.svg          # Source icon design
└── README.md
```

## How It Works

1. **User Clicks Extension**: Opens popup with current tab URL
2. **User Clicks "Analyze & Save"**: Sends message to background service worker
3. **Background Worker**:
   - Optionally fetches page HTML for context
   - Reads your existing bookmark folder paths from Chrome
   - Calls your chosen AI provider (Anthropic or OpenRouter) with URL, HTML, and folder list
   - Receives: title, summary, categories, matchedCategory, etc.
   - Creates folder hierarchy in Chrome bookmarks if it doesn't exist
   - Creates bookmark in the matched folder (or saves articles to Instapaper)
4. **Results Displayed**: Shows analysis results and confirmation in popup

## Permissions

The extension requires these permissions:

- **bookmarks**: To create and organize bookmarks
- **activeTab**: To get the current tab's URL and title
- **storage**: To save your settings (API key, Instapaper, Todoist)

## Development

### Testing

1. Make changes to the extension files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the Bookmark AI extension card
4. Test your changes

### Debugging

- **Popup**: Right-click the popup → "Inspect"
- **Background Worker**: `chrome://extensions/` → "Service worker" link
- **Console Logs**: Check both popup and background worker consoles

## Troubleshooting

### "API key not configured" / "OpenRouter API key not configured" / "No OpenRouter model selected"
- You must set up at least one AI provider before first use
- Click "Extension Settings" in the popup
- For **Anthropic**: enter your Claude API key (must start with `sk-ant-`)
- For **OpenRouter**: enter your API key from [openrouter.ai/keys](https://openrouter.ai/keys), then click **Load Models** and select a model

### "Failed to fetch" or network errors
- Check your internet connection
- Verify your API key is valid for the provider you selected (Anthropic or OpenRouter)
- Look at the background worker console for the exact error

### Extension doesn't load
- Check for errors in `chrome://extensions/` with Developer mode enabled

### Bookmarks not being created
- Check the background worker console for errors
- Verify your AI provider (Anthropic or OpenRouter) is configured in Settings
- Check that you have the bookmarks permission
- Non-article links are saved to Chrome bookmarks; articles can be saved to Instapaper if configured

### API errors
- **Anthropic**: Ensure your API key is correct and the model is still available (e.g. use a current model like Claude Haiku 4.5)
- **OpenRouter**: Ensure your API key and selected model are valid; try "Load Models" again to refresh the list
- Look at the background worker console for detailed error messages

### Categories not matching
- The extension sends your existing Chrome bookmark folder paths to the AI; it picks the best match or suggests a new path
- Create the folders you want in your bookmarks bar first, or let the extension create new ones from the AI suggestion

## Future Enhancements

Possible improvements:
- Keyboard shortcuts for quick bookmarking
- Bulk organize existing bookmarks
- Edit category before saving
- Search and filter existing Bookmark AI bookmarks
- Sync settings across devices
- Support for other browsers (Firefox, Edge)

## Support

For issues or questions:
1. Check this README and the Troubleshooting section above
2. Open an issue on the GitHub repository
3. Check the background worker console for error messages

## Credits

Allister Antosik - allistera