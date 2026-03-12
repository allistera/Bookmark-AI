# Bookmark AI — Privacy Policy

**Last updated:** March 2025

Bookmark AI (“the extension”) is a Chrome extension that uses AI to categorize and organize your bookmarks. This policy describes what data the extension uses and where it goes.

---

## We Do Not Collect Your Data

The extension has **no backend server**. The developer does not receive, store, or process your personal data, bookmarks, or browsing history.

---

## Data Stored on Your Device

The extension uses Chrome’s **sync storage** to save only the settings you enter in Extension Settings:

- **AI provider** (Anthropic or OpenRouter)
- **API keys** (Anthropic API key and/or OpenRouter API key)
- **OpenRouter model** (if you use OpenRouter)
- **Instapaper** username and password (optional)
- **Todoist** API token (optional)

This data is stored by Chrome and may sync across your signed-in Chrome browsers according to [Google’s Chrome Sync policy](https://support.google.com/chrome/answer/185277). The extension does not send this data to the extension developer or to any server we operate.

---

## Data Sent to Third-Party Services

When you use a feature, the extension sends the minimum required data **only to the services you configure**.

### When you analyze or bookmark a page

- **URL** of the page you are saving  
- **Page title** (from the tab or from the page)  
- **Page content** (optional): if the tab title is missing, the extension may fetch the page’s HTML (first ~8,000 characters) so the AI can suggest a title and category  
- **Your existing bookmark folder names** (so the AI can match to your structure)

This data is sent **only** to the AI provider you chose in settings:

- **Anthropic (Claude)** — [Anthropic Privacy Policy](https://www.anthropic.com/legal/privacy)  
- **OpenRouter** — [OpenRouter Privacy Policy](https://openrouter.ai/docs#privacy) (or the provider’s policy for the model you select)

The extension developer does not receive or store this data.

### If you use Instapaper

When the extension saves an article to Instapaper, it sends the **article URL** and **title** to Instapaper’s API. Instapaper’s use of data is governed by [Instapaper’s privacy policy](https://www.instapaper.com/privacy).

### If you use Todoist

When you choose “Create task in Todoist,” the extension sends **task content** (title, URL, and AI-generated summary) to Todoist’s API. Todoist’s use of data is governed by [Todoist’s privacy policy](https://todoist.com/privacy-policy).

---

## Chrome Permissions

- **Bookmarks** — To create and organize bookmarks in your browser.  
- **Storage** — To save your settings (API keys and preferences) in Chrome sync storage.  
- **Context menu** — To add “Analyze and Bookmark with AI” when you right‑click on a page.  
- **Host access (all websites)** — To fetch the HTML of the page you are bookmarking (only when needed for AI analysis).  
- **Anthropic / OpenRouter / Instapaper / Todoist** — To call their APIs when you use those features.

The extension does not access sites you don’t open or bookmark through the extension.

---

## Your Choices

- **Don’t use AI:** Don’t use the extension; no data is sent.  
- **Don’t send page content:** Use the extension only when the tab already has a title (e.g. after the page has loaded); the extension may then avoid fetching HTML.  
- **Limit third parties:** Don’t add Instapaper or Todoist in settings if you don’t want data sent there.  
- **Remove data:** Uninstall the extension and clear Chrome sync data if you want to remove stored settings.

---

## Changes

We may update this privacy policy from time to time. The “Last updated” date at the top will be revised when we do. Continued use of the extension after changes means you accept the updated policy.

---

## Contact

For privacy-related questions about Bookmark AI, open an issue on the [GitHub repository](https://github.com/allistera/Bookmark-AI) or contact the developer through the project’s listed channels.
