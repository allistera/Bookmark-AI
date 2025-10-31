# Bookmark-AI Bookmarklet

This directory contains the bookmarklet scripts for Bookmark-AI.

## Files

- **`bookmarklet-source.js`** - Readable, commented source code for the bookmarklet. Use this if you want to understand or modify the code.

- **`bookmarklet-production.js`** - Production bookmarklet. Replace `YOUR_WORKER_URL` with your deployed Cloudflare Worker URL (e.g., `https://bookmark-ai.your-username.workers.dev`), then copy and paste into a bookmark's URL field.

## Prerequisites

Before installing the bookmarklet, you need to:

1. **Deploy your Cloudflare Worker** - The bookmarklet requires a deployed Worker instance
2. **Set up API Key authentication** - Configure the `EXTENSION_API_KEY` secret in your Worker

### Setting up the API Key

The bookmarklet uses API key authentication to secure the Worker endpoint. You need to configure this key in two places:

#### 1. Generate a secure API key

```bash
# Generate a random 64-character hex string
openssl rand -hex 32
```

Or use any secure random string generator (32+ characters recommended).

#### 2. Add the key to your Cloudflare Worker

**For local development:**
```bash
# Copy the example file
cp .dev.vars.example .dev.vars

# Edit .dev.vars and set EXTENSION_API_KEY to your generated key
# Example:
# EXTENSION_API_KEY=a1b2c3d4e5f6...
```

**For production deployment:**
```bash
# Set the secret in Cloudflare
npx wrangler secret put EXTENSION_API_KEY
# When prompted, paste your generated API key
```

#### 3. Configure the API key in bridge.html

Before deploying, edit `src/bridge.html` and replace `YOUR_API_KEY` with your generated API key:

```javascript
// Line 47 in src/bridge.html
const API_KEY = 'your-actual-api-key-here';
```

⚠️ **Important**: After updating bridge.html with your API key, deploy the Worker again:
```bash
npm run deploy
```

## Installation

1. **Show your bookmarks bar** (if hidden):
   - Chrome/Edge/Firefox: Press `Ctrl+Shift+B` (Windows/Linux) or `Cmd+Shift+B` (Mac)
   - Safari: Press `Cmd+Shift+B` (Mac)

2. **Create a new bookmark**:
   - Right-click on your bookmarks bar
   - Select "Add page" or "Add bookmark"
   - Name it: `Analyze Bookmark`

3. **Copy the bookmarklet code**:
   - Open `bookmarklet-production.js` and copy the entire contents
   - Replace `YOUR_WORKER_URL` with your deployed Cloudflare Worker URL
   - Example: `https://bookmark-ai.your-username.workers.dev`

4. **Paste into the bookmark URL field** and save

## Usage

1. Navigate to any webpage you want to analyze
2. Click the "Analyze Bookmark" button in your bookmarks bar
3. A dialog will appear showing:
   - The current page URL
   - A checkbox to optionally create a Todoist task (unchecked by default)
   - Analyze and Cancel buttons
4. Click "Analyze" to send the URL to the API
5. Results will appear with the AI analysis

## Customization

To customize the bookmarklet:

1. Edit `bookmarklet-source.js` with your changes
2. Minify the code (remove whitespace, comments, etc.)
3. Prefix with `javascript:`
4. Update `bookmarklet-local.js` and/or `bookmarklet-production.js`

## What It Does

The bookmarklet:
- Shows a confirmation dialog with optional Todoist task creation checkbox
- Captures the current page URL
- Sends it to your Bookmark-AI API (`/api/bookmarks` endpoint) with user preferences
- Displays results in a modal overlay including:
  - AI-generated title and summary
  - Content type classification
  - Suggested categories
  - Matched category (for non-articles)
  - Instapaper save status (for articles)
  - Todoist task creation status (if checkbox was checked)

## Troubleshooting

### "Unauthorized" or "Invalid API key" errors

If you see authentication errors:

1. **Verify the API key matches in both places**:
   - Check `src/bridge.html` (line 47) has the correct API key
   - Check your Worker secret: `npx wrangler secret list` should show `EXTENSION_API_KEY`

2. **Redeploy after changing bridge.html**:
   ```bash
   npm run deploy
   ```

3. **For local testing**:
   - Make sure `.dev.vars` file exists with `EXTENSION_API_KEY` set
   - Run `npm run dev` and test with `http://localhost:8787`

### Bookmarklet doesn't work

- **Check popup blocker** - The bookmarklet opens a popup window that may be blocked
- **Verify Worker URL** - Make sure `YOUR_WORKER_URL` in `bookmarklet-production.js` is correct
- **Check browser console** - Press F12 and look for error messages in the Console tab
