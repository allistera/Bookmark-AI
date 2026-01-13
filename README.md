<div align="center">
  <img src="icons/icon128.png" alt="Bookmark AI Icon" width="128" height="128">
</div>

# Bookmark AI Chrome Extension

A Chrome extension that uses AI to automatically categorize and organize your bookmarks into a hierarchical folder structure.

## Features

- **AI-Powered Analysis**: Analyzes web pages using Claude AI to determine the best category
- **Automatic Organization**: Creates bookmarks in appropriate folders automatically
- **Hierarchical Categories**: Organizes bookmarks in a multi-level folder hierarchy
- **Instapaper Integration**: Automatically saves articles to Instapaper (if configured)
- **Todoist Integration**: Optionally creates tasks in Todoist for bookmarks
- **Smart Categorization**: Uses your custom category hierarchy from `bookmark_format.yaml`
- **Right-Click Support**: Add context menu for quick bookmarking

## Installation

### Prerequisites

1. Make sure your Bookmark AI API is deployed and running (see main project README)
2. Have your API endpoint URL ready (e.g., `https://bookmark-ai.your-domain.workers.dev`)

### Install the Extension

1. **Load in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the `extension` directory from this project

2. **Configure Settings** (Required):
   - Click the extension icon in your toolbar
   - Click "Extension Settings" at the bottom of the popup
   - Enter your API endpoint URL (e.g., `https://bookmark-ai.your-account.workers.dev`)
   - Click "Save Settings"

   **Important:** You must deploy your Bookmark AI backend to Cloudflare Workers first and configure the extension with your worker URL before it can be used. See the [Deployment section](#deployment) in the main README.

## Usage

### Basic Usage

1. Navigate to any web page you want to bookmark
2. Click the Bookmark AI extension icon in your toolbar
3. The popup will show:
   - Current page URL
   - Option to automatically save to bookmarks (checked by default)
   - Option to create a task in Todoist
4. Click "Analyze & Bookmark"
5. The extension will:
   - Send the URL to your API for analysis
   - Display the AI's analysis results
   - Automatically create the bookmark in the appropriate folder

### Bookmark Organization

Bookmarks are organized in your bookmarks bar with subfolders matching the categories from your `bookmark_format.yaml` file.

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
If you have Todoist configured in your API (via environment variables), you can:
1. Check "Create task in Todoist"
2. A task will be created with the bookmark URL and summary

#### Analysis Results
After analysis, you'll see:
- **Bookmarked to**: The category path where the bookmark was saved
- **Title**: AI-suggested or extracted page title
- **Summary**: Brief summary of the page content
- **Content Type**: Whether it's an article or other content
- **Suggested Categories**: Alternative categories that might fit
- **Instapaper Status**: Whether article was saved to Instapaper
- **Todoist Status**: Whether task was created

## Configuration

### Extension Settings

Access via: Extension popup → "Extension Settings" link

- **API Endpoint**: URL of your Bookmark AI API (Required)
  - No default - you must configure this before first use
  - Format: `https://bookmark-ai.[your-cloudflare-account].workers.dev`
  - Get this URL after deploying your Cloudflare Worker

### API Configuration

The extension uses the same API backend as the bookmarklet. Configure your API with:

- **ANTHROPIC_API_KEY**: Your Claude AI API key
- **INSTAPAPER_USERNAME** & **INSTAPAPER_PASSWORD**: For article saving (optional)
- **TODOIST_API_TOKEN**: For task creation (optional)

See the main project README for API setup instructions.

## File Structure

```
extension/
├── manifest.json           # Extension configuration
├── popup.html             # Main popup UI
├── popup.js               # Popup logic
├── background.js          # Service worker (handles API calls & bookmarks)
├── options.html           # Settings page UI
├── options.js             # Settings page logic
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   ├── icon128.png
│   ├── image.png         # Source logo
│   └── icon.svg          # Source icon design
└── README.md             # This file
```

## How It Works

1. **User Clicks Extension**: Opens popup with current tab URL
2. **User Clicks "Analyze & Bookmark"**: Sends message to background service worker
3. **Background Worker**:
   - Fetches analysis from your API endpoint (`/api/bookmarks`)
   - Receives: title, summary, categories, matchedCategory, etc.
   - Parses the `matchedCategory` path (e.g., "Work_and_Engineering/Software_Development")
   - Creates folder hierarchy in Chrome bookmarks if it doesn't exist
   - Creates bookmark in the final folder
4. **Results Displayed**: Shows analysis results and confirmation in popup

## Permissions

The extension requires these permissions:

- **bookmarks**: To create and organize bookmarks
- **activeTab**: To get the current tab's URL and title
- **storage**: To save your API endpoint configuration

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

### "API endpoint not configured" error
- The extension requires configuration before first use
- Click "Extension Settings" in the popup
- Enter your Cloudflare Worker URL (e.g., `https://bookmark-ai.your-account.workers.dev`)
- Make sure you've deployed the backend first (see main README)

### "Failed to fetch" or "ERR_NAME_NOT_RESOLVED" errors
- Your API endpoint URL is incorrect or the worker isn't deployed
- Verify the URL in Extension Settings matches your deployed worker
- Test your worker by visiting the URL in a browser - you should see a welcome message
- Make sure you deployed using `npm run deploy` or via GitHub Actions

### Extension doesn't load
- Check for errors in `chrome://extensions/` with Developer mode enabled

### Bookmarks not being created
- Check the background worker console for errors
- Verify your API endpoint is correct in settings
- Make sure your API is deployed and accessible
- Check that you have the bookmarks permission

### API errors
- Verify your API endpoint URL is correct
- Make sure your Cloudflare Worker is deployed
- Check that your ANTHROPIC_API_KEY is configured
- Look at the background worker console for detailed error messages

### Categories not matching
- The extension uses the same `bookmark_format.yaml` that your API uses
- Make sure your API is up to date with your desired categories
- The category path comes from the AI analysis, not from the extension

## Comparison to Bookmarklet

| Feature | Chrome Extension | Bookmarklet |
|---------|------------------|-------------|
| Automatic bookmark creation | ✅ Yes | ❌ No (display only) |
| Chrome bookmarks API | ✅ Yes | ❌ No access |
| Folder organization | ✅ Yes | ❌ No |
| Installation required | ⚠️ Yes (manual) | ✅ No |
| Updates | ⚠️ Manual reload | ✅ Automatic |
| Works on all sites | ⚠️ Most sites | ✅ All sites |

## Future Enhancements

Possible improvements:
- Keyboard shortcuts for quick bookmarking
- Bulk organize existing bookmarks
- Edit category before saving
- Search and filter existing Bookmark AI bookmarks
- Sync settings across devices
- Support for other browsers (Firefox, Edge)

## License

Same as the main Bookmark AI project.

## Support

For issues or questions:
1. Check the main project README
2. Open an issue on the GitHub repository
3. Check the background worker console for error messages

## Credits

Part of the [Bookmark AI](https://github.com/allistera/Bookmark-AI) project.
