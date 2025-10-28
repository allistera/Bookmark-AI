# Bookmark-AI

Use AI to Automatically Sort Bookmarks

## Overview

This project contains a Cloudflare Worker that serves as the backend for the Bookmark-AI service. The worker uses Claude AI to automatically analyze bookmark URLs and extract metadata including title, summary, categories, and content type classification. For articles, it automatically saves them to your Instapaper reading list. The worker is deployed automatically using GitHub Actions.

## Project Structure

```
.
├── src/
│   └── index.ts          # Main worker code
├── bookmarklet/
│   ├── bookmarklet-source.js       # Readable bookmarklet source
│   ├── bookmarklet-production.js   # Production bookmarklet
│   └── README.md                   # Bookmarklet documentation
├── extension/
│   ├── manifest.json               # Chrome extension manifest
│   ├── popup.html/js               # Extension popup UI
│   ├── background.js               # Service worker (handles bookmarks)
│   ├── options.html/js             # Settings page
│   ├── icons/                      # Extension icons
│   └── README.md                   # Extension documentation
├── .github/
│   └── workflows/
│       └── deploy.yml    # GitHub Actions deployment workflow
├── bookmark_format.yaml  # Category hierarchy definition
├── wrangler.toml         # Cloudflare Worker configuration
├── package.json          # Node.js dependencies
└── tsconfig.json         # TypeScript configuration
```

## Prerequisites

- Node.js 20 or later
- npm or yarn
- A Cloudflare account
- An Anthropic API key (get one at https://console.anthropic.com/)
- An Instapaper account (optional, for automatic article saving - sign up at https://www.instapaper.com/)
- A Todoist account (optional, for task creation - sign up at https://todoist.com/)
- Wrangler CLI (installed automatically with npm install)

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .dev.vars.example .dev.vars
   ```

   Edit `.dev.vars` and add your credentials:
   ```
   ANTHROPIC_API_KEY=your-anthropic-api-key-here
   INSTAPAPER_USERNAME=your-instapaper-email@example.com
   INSTAPAPER_PASSWORD=your-instapaper-password
   TODOIST_API_TOKEN=your-todoist-api-token-here
   ```

   - Get your Anthropic API key from: https://console.anthropic.com/
   - Use your Instapaper account credentials from: https://www.instapaper.com/
   - Get your Todoist API token from: https://app.todoist.com/app/settings/integrations/developer

3. Start the development server:
   ```bash
   npm run dev
   ```

4. The worker will be available at `http://localhost:8787`

## API Endpoints

### `GET /`
Welcome message and API documentation

### `GET /health`
Health check endpoint

### `POST /api/bookmarks`
Analyze a bookmark URL using Claude AI

**Request:**
```json
{
  "url": "https://example.com/article",
  "createTodoistTask": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bookmark analyzed successfully",
  "data": {
    "url": "https://example.com/article",
    "isArticle": true,
    "contentType": "article",
    "title": "Example Article Title",
    "summary": "A brief summary of the article content.",
    "categories": ["technology", "web development"],
    "matchedCategory": "Work_and_Engineering/Software_Development/...",
    "instapaper": {
      "saved": true,
      "bookmarkId": 1234567890,
      "error": null
    },
    "todoist": {
      "created": false,
      "taskId": null,
      "error": null
    },
    "analyzedAt": "2025-10-26T08:56:01.509Z"
  }
}
```

The API uses Claude AI to:
- Determine if the URL is a web article or another type of content
- Classify the content type (article, tool, documentation, homepage, video, etc.)
- Generate a suggested title
- Create a brief summary
- Suggest relevant categories/tags
- **Automatically save articles to Instapaper** (when credentials are configured)
- **Optionally create tasks in Todoist** (when requested via `createTodoistTask` parameter)

## Bookmarklet

A bookmarklet allows you to analyze the current webpage with a single click from your browser's bookmark bar.

### Quick Start

1. **Show your bookmarks bar** (if hidden):
   - Chrome/Edge/Firefox: Press `Ctrl+Shift+B` (Windows/Linux) or `Cmd+Shift+B` (Mac)
   - Safari: Press `Cmd+Shift+B` (Mac)

2. **Create a new bookmark**:
   - Right-click on your bookmarks bar
   - Select "Add page" or "Add bookmark"
   - Name it: `Analyze Bookmark`

3. **Copy the bookmarklet code** and paste into the URL field:
   - Copy the contents of [`bookmarklet/bookmarklet-production.js`](bookmarklet/bookmarklet-production.js)
   - Replace `YOUR_WORKER_URL` with your deployed Cloudflare Worker URL (e.g., `https://bookmark-ai.your-username.workers.dev`)

4. **Save the bookmark**

### Bookmarklet Files

The [`bookmarklet/`](bookmarklet/) directory contains:
- **`bookmarklet-source.js`** - Readable source code with comments
- **`bookmarklet-production.js`** - Production bookmarklet (replace YOUR_WORKER_URL with your deployed URL)
- **`README.md`** - Detailed instructions and customization guide

### Usage

1. Navigate to any webpage you want to analyze
2. Click the "Analyze Bookmark" button in your bookmarks bar
3. A dialog will appear with:
   - The current page URL
   - A checkbox to optionally create a Todoist task (unchecked by default)
   - Analyze and Cancel buttons
4. Click "Analyze" to send the URL to the API
5. Results will appear showing:
   - AI-generated title and summary
   - Content type classification
   - Suggested categories
   - Matched category (for non-articles)
   - Instapaper save status (for articles)
   - Todoist task creation status (if checkbox was checked)

### How It Works

The bookmarklet:
- Shows a confirmation dialog with optional Todoist task creation
- Captures the current page URL
- Sends it to your Bookmark-AI API endpoint with user preferences
- Displays the AI analysis in a modal overlay
- Works on any website without requiring a browser extension

## Chrome Extension

A Chrome extension is available that provides automatic bookmark creation with AI-powered categorization. Unlike the bookmarklet which only displays analysis results, the extension actually creates bookmarks in your Chrome bookmarks manager.

### Features

- **Automatic Bookmark Creation**: Creates bookmarks in Chrome's bookmark manager
- **Hierarchical Organization**: Organizes bookmarks in folders matching your category structure
- **Smart Folder Management**: Automatically creates/finds folder hierarchies
- **Same AI Analysis**: Uses the same backend API as the bookmarklet
- **All Integrations**: Supports Instapaper and Todoist features

### Quick Start

1. **Navigate to the extension directory**:
   ```bash
   cd extension
   ```

2. **Generate icons**:
   ```bash
   node generate-icons.js
   ```

3. **Load in Chrome**:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension` directory

4. **Configure settings**:
   - Click the extension icon
   - Click "Extension Settings"
   - Enter your API endpoint URL
   - Save settings

### Usage

1. Navigate to any webpage
2. Click the extension icon
3. Click "Analyze & Bookmark"
4. The bookmark will be created automatically in the appropriate folder under "Bookmark AI" in your bookmarks bar

For detailed documentation, see [`extension/README.md`](extension/README.md).

## Deployment

### Automatic Deployment

The worker is automatically deployed to Cloudflare Workers when code is pushed to the `main` branch via GitHub Actions.

### Required GitHub Secrets

Add the following secrets to your GitHub repository (Settings > Secrets and variables > Actions):

1. `CLOUDFLARE_API_TOKEN` - Your Cloudflare API token
   - Go to Cloudflare Dashboard > My Profile > API Tokens
   - Create a token with "Edit Cloudflare Workers" permissions

2. `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare Account ID
   - Found in Cloudflare Dashboard > Workers & Pages > Overview

3. `ANTHROPIC_API_KEY` - Your Anthropic API key for Claude AI
   - Get your API key from: https://console.anthropic.com/
   - This is required for the bookmark analysis feature

4. `INSTAPAPER_USERNAME` - Your Instapaper account email
   - Your Instapaper account email address

5. `INSTAPAPER_PASSWORD` - Your Instapaper account password
   - Your Instapaper account password
   - This is required for automatically saving articles to Instapaper

6. `TODOIST_API_TOKEN` - Your Todoist API token
   - Get your API token from: https://app.todoist.com/app/settings/integrations/developer
   - This is required for creating tasks in Todoist via the bookmarklet

### Manual Deployment

To deploy manually:

```bash
npm run deploy
```

Note: You'll need to authenticate with Wrangler first:
```bash
npx wrangler login
```

## Configuration

Edit `wrangler.toml` to configure:
- Worker name
- Compatibility date
- Routes and domains
- KV namespaces
- Environment variables

## Development

The worker is written in TypeScript and uses:
- Cloudflare Workers runtime
- Wrangler for development and deployment
- TypeScript for type safety
- Anthropic's Claude AI (Claude 3.5 Sonnet) for bookmark analysis
- ESLint for code linting
- yamllint for YAML file validation

### Linting

Run linters to check code quality:
```bash
npm run lint        # Run all linters
npm run lint:js     # Run ESLint only
npm run lint:yaml   # Run yamllint only
npm run lint:fix    # Auto-fix ESLint issues
```

## License

ISC
