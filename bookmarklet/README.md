# Bookmark-AI Bookmarklet

This directory contains the bookmarklet scripts for Bookmark-AI.

**✨ Mobile-Friendly:** Works on iOS Safari and all mobile browsers! Uses a redirect approach instead of popups for maximum compatibility.

## Files

- **`bookmarklet-source.js`** - Readable, commented source code for the bookmarklet. Use this if you want to understand or modify the code.

- **`bookmarklet-production.js`** - Production bookmarklet. Replace `YOUR_WORKER_URL` with your deployed Cloudflare Worker URL (e.g., `https://bookmark-ai.your-username.workers.dev`), then copy and paste into a bookmark's URL field.

## Installation

### Desktop (Chrome, Firefox, Edge, Safari)

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

### iOS Safari

1. **Create a bookmark for any page**:
   - Tap the Share button
   - Select "Add Bookmark"
   - Name it: `Analyze Bookmark`
   - Save to Favorites

2. **Edit the bookmark**:
   - Tap the bookmark icon (open book) to view bookmarks
   - Select "Edit" in the bottom right
   - Tap on the "Analyze Bookmark" bookmark
   - Edit the URL field and replace it with the code from `bookmarklet-production.js`
   - Make sure to replace `YOUR_WORKER_URL` and `YOUR_API_KEY` with your values
   - Tap "Done" to save

3. **Using the bookmarklet on iOS**:
   - Navigate to the page you want to analyze
   - Tap the address bar and type "Analyze" to find your bookmark
   - Tap the bookmark to run it

## Usage

1. Navigate to any webpage you want to analyze
2. Click/tap the "Analyze Bookmark" bookmarklet
3. A dialog will appear showing:
   - The current page URL
   - A checkbox to optionally create a Todoist task (unchecked by default)
   - Analyze and Cancel buttons
4. Click/tap "Analyze" to process the bookmark
5. You'll be redirected to a results page showing the AI analysis
6. Click "Done - Return to Page" to go back to the original page

## Customization

To customize the bookmarklet:

1. Edit `bookmarklet-source.js` with your changes
2. Minify the code (remove whitespace, comments, etc.)
3. Prefix with `javascript:`
4. Update `bookmarklet-local.js` and/or `bookmarklet-production.js`

## What It Does

The bookmarklet:
- Shows a confirmation dialog with optional Todoist task creation checkbox
- Captures the current page URL and title
- Redirects to a bridge page that makes the API call (mobile-friendly approach)
- Displays results on the bridge page including:
  - AI-generated title and summary
  - Content type classification
  - Suggested categories
  - Matched category (for non-articles)
  - Instapaper save status (for articles)
  - Todoist task creation status (if checkbox was checked)
- Provides a button to return to the original page

## Mobile Compatibility

This bookmarklet is designed to work on **all mobile browsers**, including iOS Safari. Instead of using popup windows (which are often blocked on mobile), it uses a **redirect approach**:

1. When you click "Analyze", you're redirected to a bridge page
2. The bridge page makes the API call and displays results
3. Click "Done" to return to the original page

This approach ensures compatibility with:
- ✅ iOS Safari
- ✅ Android Chrome
- ✅ All desktop browsers
- ✅ Any browser that blocks popups
