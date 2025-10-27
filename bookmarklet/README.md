# Bookmark-AI Bookmarklet

This directory contains the bookmarklet scripts for Bookmark-AI.

## Files

- **`bookmarklet-source.js`** - Readable, commented source code for the bookmarklet. Use this if you want to understand or modify the code.

- **`bookmarklet-production.js`** - Production bookmarklet. Replace `YOUR_WORKER_URL` with your deployed Cloudflare Worker URL (e.g., `https://bookmark-ai.your-username.workers.dev`), then copy and paste into a bookmark's URL field.

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
