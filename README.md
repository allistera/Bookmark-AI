# Bookmark-AI

Use AI to Automatically Sort Bookmarks

## Overview

This project contains a Cloudflare Worker that serves as the backend for the Bookmark-AI service. The worker uses Claude AI to automatically analyze bookmark URLs and extract metadata including title, summary, categories, and content type classification. For articles, it automatically saves them to your Instapaper reading list. The worker is deployed automatically using GitHub Actions.

## Project Structure

```
.
├── src/
│   └── index.ts          # Main worker code
├── .github/
│   └── workflows/
│       └── deploy.yml    # GitHub Actions deployment workflow
├── wrangler.toml         # Cloudflare Worker configuration
├── package.json          # Node.js dependencies
└── tsconfig.json         # TypeScript configuration
```

## Prerequisites

- Node.js 20 or later
- npm or yarn
- A Cloudflare account
- An Anthropic API key (get one at https://console.anthropic.com/)
- An Instapaper account (sign up at https://www.instapaper.com/)
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
   ```

   - Get your Anthropic API key from: https://console.anthropic.com/
   - Use your Instapaper account credentials from: https://www.instapaper.com/

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
  "url": "https://example.com/article"
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
    "instapaper": {
      "saved": true,
      "bookmarkId": 1234567890,
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

## Bookmarklet

A bookmarklet allows you to analyze the current webpage with a single click from your browser's bookmark bar.

### Installation

1. **Show your bookmarks bar** (if hidden):
   - Chrome/Edge: Press `Ctrl+Shift+B` (Windows/Linux) or `Cmd+Shift+B` (Mac)
   - Firefox: Press `Ctrl+Shift+B` (Windows/Linux) or `Cmd+Shift+B` (Mac)
   - Safari: Press `Cmd+Shift+B` (Mac)

2. **Create a new bookmark**:
   - Right-click on your bookmarks bar
   - Select "Add page" or "Add bookmark"
   - Name it: `Analyze Bookmark`

3. **Paste the bookmarklet code** into the URL field:

   **For local development (http://localhost:8787):**
   ```javascript
   javascript:(function(){const API_URL='http://localhost:8787/api/bookmarks';const currentUrl=window.location.href;const overlay=document.createElement('div');overlay.id='bookmark-ai-overlay';overlay.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;';const modal=document.createElement('div');modal.style.cssText='background:white;border-radius:12px;padding:30px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);';modal.innerHTML='<div style="text-align:center;"><h2 style="color:#667eea;margin-bottom:20px;">Analyzing...</h2><div style="border:4px solid #f3f3f3;border-top:4px solid #667eea;border-radius:50%;width:50px;height:50px;animation:spin 1s linear infinite;margin:20px auto;"></div></div><style>@keyframes spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}</style>';overlay.appendChild(modal);document.body.appendChild(overlay);overlay.addEventListener('click',function(e){if(e.target===overlay)document.body.removeChild(overlay);});fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:currentUrl})}).then(response=>response.json()).then(data=>{if(data.success&&data.data){const result=data.data;const categories=result.categories?result.categories.join(', '):'N/A';const matchedCategory=result.matchedCategory||'N/A';const instapaperStatus=result.instapaper?.saved?'<span style="color:#10b981;">✓ Saved</span>':result.instapaper?.error?'<span style="color:#ef4444;">✗ Error</span>':'<span style="color:#6b7280;">Not saved</span>';modal.innerHTML='<div><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><h2 style="color:#667eea;margin:0;">Analysis</h2><button onclick="this.closest(\'#bookmark-ai-overlay\').remove()" style="background:#ef4444;color:white;border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:20px;">×</button></div><div style="margin-bottom:15px;"><strong style="color:#764ba2;">Title:</strong><p style="margin:5px 0 0 0;">'+result.title+'</p></div><div style="margin-bottom:15px;"><strong style="color:#764ba2;">Content Type:</strong><p style="margin:5px 0 0 0;"><span style="background:#e6f7ff;padding:4px 8px;border-radius:4px;">'+result.contentType+'</span></p></div><div style="margin-bottom:15px;"><strong style="color:#764ba2;">Summary:</strong><p style="margin:5px 0 0 0;">'+result.summary+'</p></div><div style="margin-bottom:15px;"><strong style="color:#764ba2;">Categories:</strong><p style="margin:5px 0 0 0;">'+categories+'</p></div>'+(result.matchedCategory?'<div style="margin-bottom:15px;"><strong style="color:#764ba2;">Matched:</strong><p style="margin:5px 0 0 0;font-family:monospace;font-size:0.9em;">'+matchedCategory+'</p></div>':'')+'<div style="margin-bottom:15px;"><strong style="color:#764ba2;">Instapaper:</strong><p style="margin:5px 0 0 0;">'+instapaperStatus+'</p></div><button onclick="this.closest(\'#bookmark-ai-overlay\').remove()" style="background:#667eea;color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;width:100%;margin-top:20px;">Close</button></div>';}else{throw new Error(data.error||'Failed to analyze');}}).catch(error=>{modal.innerHTML='<div><h2 style="color:#ef4444;margin-bottom:20px;">Error</h2><p style="margin-bottom:20px;">'+error.message+'</p><button onclick="this.closest(\'#bookmark-ai-overlay\').remove()" style="background:#ef4444;color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;width:100%;">Close</button></div>';});})();
   ```

   **For production (replace YOUR_WORKER_URL with your deployed URL):**
   ```javascript
   javascript:(function(){const API_URL='YOUR_WORKER_URL/api/bookmarks';const currentUrl=window.location.href;const overlay=document.createElement('div');overlay.id='bookmark-ai-overlay';overlay.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;';const modal=document.createElement('div');modal.style.cssText='background:white;border-radius:12px;padding:30px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);';modal.innerHTML='<div style="text-align:center;"><h2 style="color:#667eea;margin-bottom:20px;">Analyzing...</h2><div style="border:4px solid #f3f3f3;border-top:4px solid #667eea;border-radius:50%;width:50px;height:50px;animation:spin 1s linear infinite;margin:20px auto;"></div></div><style>@keyframes spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}</style>';overlay.appendChild(modal);document.body.appendChild(overlay);overlay.addEventListener('click',function(e){if(e.target===overlay)document.body.removeChild(overlay);});fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:currentUrl})}).then(response=>response.json()).then(data=>{if(data.success&&data.data){const result=data.data;const categories=result.categories?result.categories.join(', '):'N/A';const matchedCategory=result.matchedCategory||'N/A';const instapaperStatus=result.instapaper?.saved?'<span style="color:#10b981;">✓ Saved</span>':result.instapaper?.error?'<span style="color:#ef4444;">✗ Error</span>':'<span style="color:#6b7280;">Not saved</span>';modal.innerHTML='<div><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><h2 style="color:#667eea;margin:0;">Analysis</h2><button onclick="this.closest(\'#bookmark-ai-overlay\').remove()" style="background:#ef4444;color:white;border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:20px;">×</button></div><div style="margin-bottom:15px;"><strong style="color:#764ba2;">Title:</strong><p style="margin:5px 0 0 0;">'+result.title+'</p></div><div style="margin-bottom:15px;"><strong style="color:#764ba2;">Content Type:</strong><p style="margin:5px 0 0 0;"><span style="background:#e6f7ff;padding:4px 8px;border-radius:4px;">'+result.contentType+'</span></p></div><div style="margin-bottom:15px;"><strong style="color:#764ba2;">Summary:</strong><p style="margin:5px 0 0 0;">'+result.summary+'</p></div><div style="margin-bottom:15px;"><strong style="color:#764ba2;">Categories:</strong><p style="margin:5px 0 0 0;">'+categories+'</p></div>'+(result.matchedCategory?'<div style="margin-bottom:15px;"><strong style="color:#764ba2;">Matched:</strong><p style="margin:5px 0 0 0;font-family:monospace;font-size:0.9em;">'+matchedCategory+'</p></div>':'')+'<div style="margin-bottom:15px;"><strong style="color:#764ba2;">Instapaper:</strong><p style="margin:5px 0 0 0;">'+instapaperStatus+'</p></div><button onclick="this.closest(\'#bookmark-ai-overlay\').remove()" style="background:#667eea;color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;width:100%;margin-top:20px;">Close</button></div>';}else{throw new Error(data.error||'Failed to analyze');}}).catch(error=>{modal.innerHTML='<div><h2 style="color:#ef4444;margin-bottom:20px;">Error</h2><p style="margin-bottom:20px;">'+error.message+'</p><button onclick="this.closest(\'#bookmark-ai-overlay\').remove()" style="background:#ef4444;color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;width:100%;">Close</button></div>';});})();
   ```

4. **Save the bookmark**

### Usage

1. Navigate to any webpage you want to analyze
2. Click the "Analyze Bookmark" button in your bookmarks bar
3. A modal will appear showing:
   - AI-generated title and summary
   - Content type classification
   - Suggested categories
   - Matched category (for non-articles)
   - Instapaper save status (for articles)

### How It Works

The bookmarklet:
- Captures the current page URL
- Sends it to your Bookmark-AI API endpoint
- Displays the AI analysis in a modal overlay
- Works on any website without requiring a browser extension

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
