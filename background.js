const USER_AGENT = 'Mozilla/5.0 (compatible; Bookmark-AI/1.0)';

// Chrome assigns fixed IDs to the built-in bookmark containers, but they can differ by browser/profile
let BOOKMARK_ROOT_IDS = { ROOT: '0', BAR: '1', OTHER: '2' };

// Root IDs cannot change within a profile session, so the discovery call is memoised
// in a module-level promise — every caller within this service-worker lifetime shares
// the same in-flight/resolved lookup instead of re-fetching the whole tree.
let rootIdsPromise = null;

// Dynamically discover root IDs if they differ on this browser or profile
function initializeRootIds() {
  if (!rootIdsPromise) {
    rootIdsPromise = (async () => {
      try {
        const tree = await chrome.bookmarks.getTree();
        const rootNode = tree[0];
        if (rootNode && rootNode.children && rootNode.children.length > 0) {
          // The first child of the root node is typically the Bookmarks Bar / Favorites
          if (rootNode.children[0]) {
            BOOKMARK_ROOT_IDS.BAR = rootNode.children[0].id;
          }
          // The second child of the root node is typically Other Bookmarks
          if (rootNode.children[1]) {
            BOOKMARK_ROOT_IDS.OTHER = rootNode.children[1].id;
          }
        }
      } catch (err) {
        console.warn('Could not dynamically discover root folder IDs, using defaults:', err);
      }
    })();
  }
  return rootIdsPromise;
}

// Listen for messages from popup and health-check page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const actionsWithResponse = [
    'analyzeBookmark', 'runHealthCheck', 'getHealthCheckData', 'applyHealthFix',
    'applyBulkFix', 'dismissHealthIssue', 'setupHealthCheckAlarm', 'parseSearchQuery',
    'searchBookmarksLocal', 'searchBookmarksSemantic', 'checkAIConfig', 'undoBookmark',
    'getUnsortedBookmarks', 'getAISuggestion', 'moveBookmarks', 'deleteBookmarks'
  ];

  if (!actionsWithResponse.includes(request.action)) {
    return false;
  }

  (async () => {
    try {
      switch (request.action) {
      case 'analyzeBookmark': {
        const res = await handleAnalyzeBookmark(request);
        sendResponse(res);
        break;
      }
      case 'runHealthCheck': {
        const res = await runHealthCheck();
        sendResponse(res);
        break;
      }
      case 'getHealthCheckData': {
        const data = await getHealthCheckData();
        sendResponse(data);
        break;
      }
      case 'applyHealthFix': {
        const res = await applyHealthFix(request.bookmarkId, request.fixType, request.newValue);
        sendResponse(res);
        break;
      }
      case 'applyBulkFix': {
        const res = await applyBulkFix(request.fixType, request.ids);
        sendResponse(res);
        break;
      }
      case 'dismissHealthIssue': {
        const res = await dismissHealthIssue(request.bookmarkId);
        sendResponse(res);
        break;
      }
      case 'setupHealthCheckAlarm': {
        await setupHealthCheckAlarm();
        sendResponse({ success: true });
        break;
      }
      case 'parseSearchQuery': {
        const res = await handleParseSearchQuery(request.query);
        sendResponse(res);
        break;
      }
      case 'searchBookmarksLocal': {
        const res = await handleLocalBookmarkSearch(request.keywords, request.dateRange);
        sendResponse(res);
        break;
      }
      case 'searchBookmarksSemantic': {
        const res = await handleSemanticBookmarkSearch(request.semanticIntent, request.excludeIds);
        sendResponse(res);
        break;
      }
      case 'checkAIConfig': {
        const { hasAI } = await getAIConfig();
        sendResponse({ hasAI });
        break;
      }
      case 'undoBookmark': {
        await chrome.bookmarks.remove(request.bookmarkId);
        sendResponse({ success: true });
        break;
      }
      case 'getUnsortedBookmarks': {
        const bookmarks = await getUnsortedBookmarks();
        sendResponse({ success: true, bookmarks });
        break;
      }
      case 'getAISuggestion': {
        const res = await handleGetAISuggestion(request);
        sendResponse(res);
        break;
      }
      case 'moveBookmarks': {
        const res = await handleMoveBookmarks(request.items);
        sendResponse(res);
        break;
      }
      case 'deleteBookmarks': {
        const res = await handleDeleteBookmarks(request.bookmarkIds);
        sendResponse(res);
        break;
      }
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true; // Keep channel open for async response
});

/**
 * Cached traversal of the full bookmark tree. A single getTree() call derives
 * the folder-path list, an id -> folder-path map, and the flat list of bookmark
 * leaf nodes together, so callers that used to each do their own full-tree read
 * (getExistingBookmarkFolders, getFolderPathMap, getAllBookmarks) now share one.
 * The cache is invalidated by the chrome.bookmarks.on* listeners registered below
 * whenever the tree structure actually changes.
 * @returns {Promise<{folders: string[], folderPathMap: Object<string,string>, allBookmarks: chrome.bookmarks.BookmarkTreeNode[]}>}
 */
let bookmarkTreeDataPromise = null;

function invalidateBookmarkTreeCache() {
  bookmarkTreeDataPromise = null;
}

function getBookmarkTreeData() {
  if (!bookmarkTreeDataPromise) {
    bookmarkTreeDataPromise = computeBookmarkTreeData();
  }
  return bookmarkTreeDataPromise;
}

async function computeBookmarkTreeData() {
  await initializeRootIds();
  const tree = await chrome.bookmarks.getTree();
  const folders = [];
  const folderPathMap = {};
  const allBookmarks = [];

  function traverse(nodes, path = '') {
    for (const node of nodes) {
      // Bookmarks (have a url) are leaves — collect them and move on
      if (node.url) {
        allBookmarks.push(node);
        continue;
      }

      // Skip root nodes (Bookmarks Bar, Other Bookmarks, Mobile Bookmarks)
      // but process their children
      if (node.parentId === BOOKMARK_ROOT_IDS.ROOT) {
        if (node.children) {
          traverse(node.children, '');
        }
        continue;
      }

      // Build the current path
      const currentPath = path ? `${path}/${node.title}` : node.title;

      if (node.title) {
        folders.push(currentPath);
        folderPathMap[node.id] = currentPath;
      }

      // Recursively process children
      if (node.children) {
        traverse(node.children, currentPath);
      }
    }
  }

  traverse(tree);
  return { folders, folderPathMap, allBookmarks };
}

// Registered at the top level (not inside a function) so these fire for the whole
// service-worker lifetime. All state above is pure derived state, so a cold rebuild
// on the next call after a service-worker restart is correct — no persistence needed.
chrome.bookmarks.onCreated.addListener(invalidateBookmarkTreeCache);
chrome.bookmarks.onRemoved.addListener(invalidateBookmarkTreeCache);
chrome.bookmarks.onChanged.addListener(invalidateBookmarkTreeCache);
chrome.bookmarks.onMoved.addListener(invalidateBookmarkTreeCache);
chrome.bookmarks.onChildrenReordered.addListener(invalidateBookmarkTreeCache);

/**
 * Scans the user's bookmark tree and extracts all folder paths
 * @returns {Promise<string[]>} Array of folder paths (e.g., "Work/Projects/Web")
 */
async function getExistingBookmarkFolders() {
  const { folders } = await getBookmarkTreeData();
  return folders;
}

/**
 * Fetches a URL with a timeout, returning null (instead of throwing) on any network
 * failure so callers can decide whether to fall back to a different method.
 */
async function fetchWithTimeout(url, method, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT }
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cancels/drains a response body we don't intend to read, so the connection is
 * released instead of left open and unread.
 */
function abortResponseBody(response) {
  if (response && response.body) {
    response.body.cancel().catch(() => {});
  }
}

/**
 * Reads a response body up to `maxChars` decoded characters, then cancels the reader
 * — which propagates to abort the underlying transfer — instead of downloading and
 * decoding a response that may be many times larger than what's actually used.
 * @param {Response} response
 * @param {number} maxChars
 * @returns {Promise<string>}
 */
async function readTextUpTo(response, maxChars) {
  if (!response.body) {
    // Environments without a streamable body fall back to a full read.
    const text = await response.text();
    return text.length > maxChars ? text.slice(0, maxChars) : text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';

  try {
    while (text.length < maxChars) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

/**
 * Fetches the HTML content of a URL for analysis. Streams the response and stops
 * reading — aborting the rest of the transfer — as soon as `maxChars` characters
 * have been decoded, instead of downloading a whole (possibly multi-MB) page for a
 * few KB of prompt content.
 */
async function fetchHtmlContent(url, maxChars = 8000) {
  console.log(`Fetching HTML content for: ${url}`);
  const response = await fetchWithTimeout(url, 'GET', 10000);
  if (!response) {
    console.error('Error fetching HTML: request failed or timed out');
    return null;
  }

  if (!response.ok) {
    console.error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    abortResponseBody(response);
    return null;
  }

  try {
    return await readTextUpTo(response, maxChars);
  } catch (error) {
    console.error('Error fetching HTML:', error);
    return null;
  }
}

/**
 * Calls the configured AI provider and returns the raw response text.
 * @param {string} prompt - The prompt to send
 * @param {object} settings - User settings from chrome.storage.sync
 * @param {string} provider - 'anthropic' | 'openai' | 'openrouter'
 * @param {number} [maxTokens=1024] - Maximum tokens in response
 * @returns {Promise<string>} Raw response text from the AI
 */
async function callAI(prompt, settings, provider, maxTokens = 1024) {
  const TIMEOUT_MS = 25000; // 25 seconds timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    if (provider === 'openai') {
      let response;
      try {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.openaiApiKey}`
          },
          body: JSON.stringify({
            model: settings.openaiModel || 'gpt-4o',
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }]
          }),
          signal: controller.signal
        });
      } catch (error) {
        console.error('Error calling OpenAI API:', error);
        throw new Error(`Failed to call OpenAI API: ${error.message}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', response.status, errorText);
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const message = await response.json();
      const responseText = message.choices?.[0]?.message?.content;
      if (!responseText) {
        console.error('No content in OpenAI response:', JSON.stringify(message));
        throw new Error('No content in OpenAI response');
      }
      return responseText;
    } else if (provider === 'openrouter') {
      let response;
      try {
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.openrouterApiKey}`,
            'HTTP-Referer': 'https://github.com/bookmark-ai',
            'X-Title': 'Bookmark AI'
          },
          body: JSON.stringify({
            model: settings.openrouterModel,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }]
          }),
          signal: controller.signal
        });
      } catch (error) {
        console.error('Error calling OpenRouter API:', error);
        throw new Error(`Failed to call OpenRouter API: ${error.message}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter API error:', response.status, errorText);
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      const message = await response.json();
      const responseText = message.choices?.[0]?.message?.content;
      if (!responseText) {
        console.error('No content in OpenRouter response:', JSON.stringify(message));
        throw new Error('No content in OpenRouter response');
      }
      return responseText;
    } else if (provider === 'gemini') {
      let response;
      try {
        const model = settings.geminiModel || 'gemini-2.5-flash';
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.geminiApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt }
                ]
              }
            ],
            generationConfig: {
              maxOutputTokens: maxTokens
            }
          }),
          signal: controller.signal
        });
      } catch (error) {
        console.error('Error calling Gemini API:', error);
        throw new Error(`Failed to call Gemini API: ${error.message}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', response.status, errorText);
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) {
        console.error('No content in Gemini response:', JSON.stringify(data));
        throw new Error('No content in Gemini response');
      }
      return responseText;
    } else {
      let response;
      try {
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': settings.anthropicApiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }]
          }),
          signal: controller.signal
        });
      } catch (error) {
        console.error('Error calling Anthropic API:', error);
        throw new Error(`Failed to call Claude AI: ${error.message}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Anthropic API error:', response.status, errorText);
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      }

      const message = await response.json();
      const textContent = message.content.find(block => block.type === 'text');
      if (!textContent) {
        console.error('No text content in Claude response. Response:', JSON.stringify(message.content));
        throw new Error('No text content in Claude response');
      }
      return textContent.text;
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Analyzes a bookmark URL using the configured AI provider
 */
async function analyzeBookmark(url, settings, provider, providedTitle) {
  // Fetch HTML content if no title was provided
  let htmlContent = null;
  if (!providedTitle) {
    // fetchHtmlContent already stops downloading once it has this many characters,
    // to keep token usage reasonable without paying for a full-page transfer.
    const HTML_CHAR_LIMIT = 8000;
    htmlContent = await fetchHtmlContent(url, HTML_CHAR_LIMIT);
    if (htmlContent && htmlContent.length >= HTML_CHAR_LIMIT) {
      htmlContent += '\n... [content truncated]';
    }
  }

  // Get the user's existing bookmark folders
  const existingFolders = await getExistingBookmarkFolders();
  console.log('Found existing bookmark folders:', existingFolders.length);

  // Build the category matching section of the prompt
  let categorySection = '';
  if (existingFolders.length > 0) {
    // Limit folders passed to the AI to prevent excessive context size or request timeouts
    let foldersToSuggest = existingFolders;
    if (foldersToSuggest.length > 100) {
      foldersToSuggest = foldersToSuggest.slice(0, 100);
    }
    categorySection = `
Additionally, if this is NOT an article, you MUST match it to exactly ONE category - the single best match from the user's existing bookmark folders:
${foldersToSuggest.join('\n')}

IMPORTANT: Return ONLY ONE category path that best matches the URL content. Use the EXACT path from the list above. If none of the existing folders are appropriate, you may suggest a new folder name.`;
  } else {
    categorySection = `
Additionally, if this is NOT an article, suggest a category path for organizing this bookmark (e.g., "Work/Development/Tools" or "Personal/Finance").`;
  }

  const prompt = `Analyze this bookmark and provide:
1. Whether this is a web article/blog post (true) or something else like a tool, homepage, documentation, etc. (false)
2. What type of content this is (e.g., "article", "tool", "documentation", "homepage", "video", "repository", etc.)
3. The title of the page${providedTitle ? ` (the provided title is: "${providedTitle}")` : ' - extract this from the HTML content (check meta tags like og:title, twitter:title, or the <title> tag)'}
4. A brief summary (1-2 sentences) of what the page is about
5. 2-3 relevant categories or tags

URL: ${url}
${htmlContent ? `\nHTML Content (first 8000 chars):\n${htmlContent}` : ''}

${!url.includes('article') && !url.includes('blog') && !url.includes('post') ? categorySection : ''}

Please respond in JSON format:
{
  "isArticle": true or false,
  "contentType": "article" or "tool" or "documentation" etc.,
  "title": "Title here",
  "summary": "Summary here",
  "categories": ["category1", "category2", "category3"],
  "matchedCategory": "Single/Best/Category/Path" (REQUIRED if not an article - return only ONE category)
}`;

  const responseText = await callAI(prompt, settings, provider);

  // Parse the JSON response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('Could not find JSON in AI response. Response text:', responseText);
    throw new Error('Could not find JSON in AI response');
  }

  let result;
  try {
    result = JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error parsing JSON from AI response:', error);
    console.error('JSON string:', jsonMatch[0]);
    throw new Error(`Failed to parse AI response: ${error.message}`);
  }

  // If not an article and no matched category, set to "Other"
  if (!result.isArticle && !result.matchedCategory) {
    result.matchedCategory = 'Other';
  }

  return result;
}

/**
 * Saves an article to Instapaper using the Simple API
 */
async function saveToInstapaper(url, title, username, password) {
  const instapaperUrl = 'https://www.instapaper.com/api/add';

  // Prepare the request body
  const params = new URLSearchParams({
    url: url,
    title: title
  });

  // Use HTTP Basic Authentication
  const auth = btoa(`${username}:${password}`);

  try {
    console.log(`Saving to Instapaper: ${url}`);
    const response = await fetch(instapaperUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`
      },
      body: params.toString()
    });

    if (response.status === 201) {
      // Successfully created
      const bookmarkId = parseInt(await response.text(), 10);
      return { success: true, bookmarkId };
    } else if (response.status === 200) {
      // Already exists
      return { success: true };
    } else if (response.status === 403) {
      return { success: false, error: 'Invalid Instapaper credentials' };
    } else if (response.status === 400) {
      return { success: false, error: 'Invalid request parameters' };
    } else if (response.status === 500) {
      return { success: false, error: 'Instapaper service error' };
    } else {
      return { success: false, error: `Unexpected status: ${response.status}` };
    }
  } catch (error) {
    console.error('Error saving to Instapaper:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

/**
 * Creates a task in Todoist using the REST API v1
 */
async function createTodoistTask(url, title, summary, apiToken) {
  const todoistUrl = 'https://api.todoist.com/api/v1/tasks';

  // Create task content with URL and summary
  const taskContent = `${title}\n${url}\n\n${summary}`;

  try {
    console.log(`Creating Todoist task: ${title}`);
    const response = await fetch(todoistUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({
        content: taskContent
      })
    });

    if (response.ok) {
      // Successfully created
      const taskData = await response.json();
      return { success: true, taskId: taskData.id };
    } else if (response.status === 401 || response.status === 403) {
      return { success: false, error: 'Invalid Todoist API token' };
    } else if (response.status === 400) {
      return { success: false, error: 'Invalid request parameters' };
    } else {
      const errorText = await response.text();
      return { success: false, error: `Unexpected status: ${response.status} - ${errorText}` };
    }
  } catch (error) {
    console.error('Error creating Todoist task:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

/**
 * Saves a URL to Readwise Reader via the v3 Save API.
 * @see https://readwise.io/reader_api
 */
async function saveToReadwise(url, title, accessToken) {
  try {
    const response = await fetch('https://readwise.io/api/v3/save/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${accessToken}`
      },
      body: JSON.stringify({ url, title })
    });
    if (response.ok) {
      return { success: true };
    } else if (response.status === 401) {
      return { success: false, error: 'Invalid Readwise access token' };
    } else {
      const text = await response.text();
      return { success: false, error: `Readwise error: ${response.status} - ${text}` };
    }
  } catch (error) {
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Saves a URL to Raindrop.io via the REST API.
 * @see https://developer.raindrop.io/v1/raindrops/single#create-raindrop
 */
async function saveToRaindrop(url, title, tags, accessToken) {
  try {
    const body = { link: url, title: title || url };
    if (tags && tags.length > 0) body.tags = tags;
    const response = await fetch('https://api.raindrop.io/rest/v1/raindrop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(body)
    });
    if (response.ok) {
      return { success: true };
    } else if (response.status === 401) {
      return { success: false, error: 'Invalid Raindrop.io access token' };
    } else {
      const text = await response.text();
      return { success: false, error: `Raindrop.io error: ${response.status} - ${text}` };
    }
  } catch (error) {
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Opens the Things app (macOS/iOS) to add a to-do via URL scheme.
 * Uses things:///add?title=...&notes=... (no API token required).
 * @see https://culturedcode.com/things/help/url-scheme/
 */
async function addToThings(url, title, summary) {
  const notes = [url, summary].filter(Boolean).join('\n\n');
  const titleEncoded = encodeURIComponent(title || 'Bookmark');
  const notesEncoded = encodeURIComponent(notes);
  const thingsUrl = `things:///add?title=${titleEncoded}&notes=${notesEncoded}`;

  try {
    await chrome.tabs.create({ url: thingsUrl });
    return { success: true };
  } catch (error) {
    console.error('Error opening Things:', error);
    return { success: false, error: error.message || 'Could not open Things' };
  }
}

/**
 * Checks whether a bookmark with the given URL already exists
 * @param {string} url
 * @returns {Promise<chrome.bookmarks.BookmarkTreeNode|null>} The existing bookmark, or null
 */
async function findDuplicateBookmark(url) {
  const results = await chrome.bookmarks.search({ url });
  return results.length > 0 ? results[0] : null;
}

async function handleAnalyzeBookmark({ url, title, saveToInstapaper: saveToInstapaperOption, createTodoist, createThings, autoBookmark, saveToReadwise: saveToReadwiseOption, saveToRaindrop: saveToRaindropOption }) {
  try {
    // Duplicate detection — check before calling AI
    const duplicate = await findDuplicateBookmark(url);
    if (duplicate) {
      return {
        success: false,
        error: `Already bookmarked as "${duplicate.title}".`
      };
    }

    // Get settings from storage
    const settings = await chrome.storage.sync.get({
      aiProvider: 'anthropic',
      anthropicApiKey: '',
      openaiApiKey: '',
      openaiModel: 'gpt-4o',
      openrouterApiKey: '',
      openrouterModel: '',
      geminiApiKey: '',
      geminiModel: 'gemini-2.5-flash',
      instapaperUsername: '',
      instapaperPassword: '',
      todoistApiToken: '',
      domainRules: [],
      readwiseEnabled: false,
      readwiseAccessToken: '',
      raindropEnabled: false,
      raindropAccessToken: ''
    });

    const provider = settings.aiProvider || 'anthropic';

    // Validate AI provider credentials are configured
    if (provider === 'openai') {
      if (!settings.openaiApiKey || settings.openaiApiKey.trim() === '') {
        throw new Error('OpenAI API key not configured. Please configure it in Extension Settings.');
      }
    } else if (provider === 'openrouter') {
      if (!settings.openrouterApiKey || settings.openrouterApiKey.trim() === '') {
        throw new Error('OpenRouter API key not configured. Please configure it in Extension Settings.');
      }
      if (!settings.openrouterModel || settings.openrouterModel.trim() === '') {
        throw new Error('OpenRouter model not selected. Please select a model in Extension Settings.');
      }
    } else if (provider === 'gemini') {
      if (!settings.geminiApiKey || settings.geminiApiKey.trim() === '') {
        throw new Error('Gemini API key not configured. Please configure it in Extension Settings.');
      }
    } else {
      if (!settings.anthropicApiKey || settings.anthropicApiKey.trim() === '') {
        throw new Error('Anthropic API key not configured. Please configure it in Extension Settings.');
      }
    }

    // Check domain rules before calling AI
    const ruleFolder = matchesDomainRule(url, settings.domainRules || []);

    // Analyze the bookmark using the configured AI provider (or use domain rule)
    const analysis = ruleFolder
      ? { isArticle: false, contentType: 'page', title: title || url, summary: '', categories: [], matchedCategory: ruleFolder }
      : await analyzeBookmark(url, settings, provider, title);

    // Fire all integrations concurrently — they are fully independent
    const [instapaperResult, todoistResult, thingsResult, readwiseResult, raindropResult] = await Promise.all([
      (saveToInstapaperOption && analysis.isArticle && settings.instapaperUsername && settings.instapaperPassword)
        ? saveToInstapaper(url, analysis.title, settings.instapaperUsername, settings.instapaperPassword)
        : null,
      (createTodoist && settings.todoistApiToken)
        ? createTodoistTask(url, analysis.title, analysis.summary, settings.todoistApiToken)
        : null,
      createThings
        ? addToThings(url, analysis.title, analysis.summary)
        : null,
      (saveToReadwiseOption && settings.readwiseEnabled && settings.readwiseAccessToken)
        ? saveToReadwise(url, analysis.title, settings.readwiseAccessToken)
        : null,
      (saveToRaindropOption && settings.raindropEnabled && settings.raindropAccessToken)
        ? saveToRaindrop(url, analysis.title, analysis.categories, settings.raindropAccessToken)
        : null
    ]);

    let bookmarkCreated = false;
    let bookmarkId = null;

    // If auto-bookmark is enabled and it's not an article, create the bookmark
    // Articles are saved to Instapaper instead of Chrome bookmarks
    if (autoBookmark && !analysis.isArticle) {
      const categoryPath = analysis.matchedCategory || 'Other';
      bookmarkId = await createBookmarkInCategory(url, analysis.title || title, categoryPath);
      bookmarkCreated = true;
    }

    return {
      success: true,
      data: {
        url: url,
        isArticle: analysis.isArticle,
        contentType: analysis.contentType,
        title: analysis.title,
        summary: analysis.summary,
        categories: analysis.categories,
        matchedCategory: analysis.matchedCategory,
        instapaper: instapaperResult ? {
          saved: instapaperResult.success,
          bookmarkId: instapaperResult.bookmarkId,
          error: instapaperResult.error
        } : null,
        todoist: todoistResult ? {
          created: todoistResult.success,
          taskId: todoistResult.taskId,
          error: todoistResult.error
        } : null,
        things: thingsResult ? {
          opened: thingsResult.success,
          error: thingsResult.error
        } : null,
        readwise: readwiseResult ? {
          saved: readwiseResult.success,
          error: readwiseResult.error
        } : null,
        raindrop: raindropResult ? {
          saved: raindropResult.success,
          error: raindropResult.error
        } : null,
        bookmarkCreated: bookmarkCreated,
        chromeBookmarkId: bookmarkId,
        analyzedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error analyzing bookmark:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Creates a bookmark in the specified category path
 * @param {string} url - The URL to bookmark
 * @param {string} title - The bookmark title
 * @param {string} categoryPath - The category path (e.g., "Work/Projects/Web")
 * @returns {Promise<string>} The created bookmark ID
 */
// Walks (and creates if needed) the folder hierarchy for categoryPath,
// returning the ID of the deepest folder.
async function ensureFolderPath(categoryPath) {
  await initializeRootIds();
  const segments = categoryPath.split('/').filter(c => c.trim().length > 0);
  let parentId = BOOKMARK_ROOT_IDS.BAR;
  for (const segment of segments) {
    const folder = await getOrCreateFolder(segment, parentId);
    parentId = folder.id;
  }
  return parentId;
}

async function createBookmarkInCategory(url, title, categoryPath) {
  const parentId = await ensureFolderPath(categoryPath);
  const bookmark = await chrome.bookmarks.create({ parentId, title, url });
  return bookmark.id;
}

/**
 * Settings (and therefore domainRules) are re-fetched from chrome.storage.sync on every
 * call, so there's no stable array reference to key a cache off of — instead the parsed
 * {host, pathPrefix} form is cached by the rules' serialised content. A bulk operation
 * (e.g. analysing many inbox bookmarks) reuses the same parse instead of re-splitting
 * every rule's domain string for every single URL.
 */
let parsedDomainRulesCache = { key: null, parsed: [] };

function getParsedDomainRules(rules) {
  const key = JSON.stringify(rules || []);
  if (parsedDomainRulesCache.key !== key) {
    const parsed = [];
    for (const rule of rules || []) {
      const domain = (rule.domain || '').trim();
      if (!domain || !rule.folder) continue;
      const slashIdx = domain.indexOf('/');
      parsed.push(slashIdx === -1
        ? { host: domain, pathPrefix: null, folder: rule.folder }
        : { host: domain.slice(0, slashIdx), pathPrefix: domain.slice(slashIdx), folder: rule.folder });
    }
    parsedDomainRulesCache = { key, parsed };
  }
  return parsedDomainRulesCache.parsed;
}

/**
 * Checks if a URL matches any domain rule and returns the target folder path.
 * Rules with a "/" are matched as hostname + path prefix (e.g. "youtube.com/watch").
 * Rules without "/" are matched as hostname only (e.g. "github.com").
 * @param {string} url
 * @param {Array<{domain: string, folder: string}>} rules
 * @returns {string|null} The matched folder path, or null if no rule matches
 */
function matchesDomainRule(url, rules) {
  const parsedRules = getParsedDomainRules(rules);
  if (parsedRules.length === 0) return null;
  try {
    const urlObj = new URL(url);
    for (const rule of parsedRules) {
      const hostnameMatch = urlObj.hostname === rule.host || urlObj.hostname === `www.${rule.host}`;
      if (!hostnameMatch) continue;
      if (rule.pathPrefix === null || urlObj.pathname.startsWith(rule.pathPrefix)) {
        return rule.folder;
      }
    }
  } catch (err) {
    console.warn('Domain rule matching skipped for invalid URL:', url, err);
  }
  return null;
}

/**
 * Returns all bookmarks sitting directly on the Bookmarks Bar or Other
 * Bookmarks (i.e. not inside any subfolder). These are the "unsorted" ones.
 */
async function getUnsortedBookmarks() {
  await initializeRootIds();
  const [bar, other] = await Promise.all([
    chrome.bookmarks.getChildren(BOOKMARK_ROOT_IDS.BAR).catch(e => {
      console.warn(`Could not read children from Bookmarks Bar (${BOOKMARK_ROOT_IDS.BAR}):`, e);
      return [];
    }),
    chrome.bookmarks.getChildren(BOOKMARK_ROOT_IDS.OTHER).catch(e => {
      console.warn(`Could not read children from Other Bookmarks (${BOOKMARK_ROOT_IDS.OTHER}):`, e);
      return [];
    })
  ]);
  return [...bar, ...other].filter(b => b.url);
}

async function handleGetAISuggestion({ url, title }) {
  const { settings, provider } = await getAIConfig();
  const ruleFolder = matchesDomainRule(url, settings.domainRules || []);
  if (ruleFolder) {
    return { success: true, matchedCategory: ruleFolder };
  }
  const analysis = await analyzeBookmark(url, settings, provider, title);
  return {
    success: true,
    matchedCategory: analysis.matchedCategory || 'Other',
    isArticle: analysis.isArticle,
    contentType: analysis.contentType
  };
}

/**
 * Moves a batch of bookmarks into their suggested category folders in one message
 * round trip. Each distinct categoryPath's folder is resolved via ensureFolderPath()
 * only once (subsequent items reuse the cached parentId), instead of the inbox page
 * sending one moveBookmark message — and re-walking/re-creating the same folder path —
 * per bookmark.
 * @param {Array<{bookmarkId: string, categoryPath: string}>} items
 * @returns {Promise<{success: boolean, results: Array<{bookmarkId: string, success: boolean, error?: string}>}>}
 */
async function handleMoveBookmarks(items) {
  const folderIdByPath = new Map();
  const results = [];

  for (const { bookmarkId, categoryPath } of items) {
    try {
      let parentId = folderIdByPath.get(categoryPath);
      if (!parentId) {
        parentId = await ensureFolderPath(categoryPath);
        folderIdByPath.set(categoryPath, parentId);
      }
      await chrome.bookmarks.move(bookmarkId, { parentId });
      results.push({ bookmarkId, success: true });
    } catch (error) {
      results.push({ bookmarkId, success: false, error: error.message });
    }
  }

  return { success: true, results };
}

/**
 * Deletes a batch of bookmarks in one message round trip instead of one
 * deleteBookmark message per bookmark.
 * @param {string[]} bookmarkIds
 * @returns {Promise<{success: boolean, results: Array<{bookmarkId: string, success: boolean, error?: string}>}>}
 */
async function handleDeleteBookmarks(bookmarkIds) {
  const results = [];
  for (const bookmarkId of bookmarkIds) {
    try {
      await chrome.bookmarks.remove(bookmarkId);
      results.push({ bookmarkId, success: true });
    } catch (error) {
      results.push({ bookmarkId, success: false, error: error.message });
    }
  }
  return { success: true, results };
}

/**
 * Gets an existing folder or creates it if it doesn't exist
 * @param {string} title - The folder title
 * @param {string} parentId - The parent folder ID
 * @returns {Promise<chrome.bookmarks.BookmarkTreeNode>} The folder node
 */
async function getOrCreateFolder(title, parentId) {
  try {
    // Search for existing folder with this title under the parent
    const children = await chrome.bookmarks.getChildren(parentId);

    // Look for an existing folder with this title
    const existingFolder = children.find(
      child => !child.url && child.title === title
    );

    if (existingFolder) {
      return existingFolder;
    }

    // Create new folder if it doesn't exist
    const newFolder = await chrome.bookmarks.create({
      parentId: parentId,
      title: title
    });

    console.log('Created folder:', newFolder);
    return newFolder;
  } catch (error) {
    console.error('Error getting or creating folder:', error);
    throw error;
  }
}

// Add context menu item for right-click bookmarking
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'bookmark-ai',
    title: 'Analyze and Bookmark with AI',
    contexts: ['page']
  });
  // Set up health check alarm based on saved settings
  setupHealthCheckAlarm().catch(console.error);
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'bookmark-ai') {
    // Open the popup or trigger analysis
    chrome.action.openPopup();
  }
});

// Run periodic health check when alarm fires
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'bookmarkHealthCheck') {
    runHealthCheck().catch(console.error);
  }
});

// ============================================================
// Bookmark Search
// ============================================================

/**
 * Builds a map of bookmark node IDs to their folder paths.
 * @returns {Promise<Object<string, string>>} Map of nodeId -> "Folder/Path"
 */
async function getFolderPathMap() {
  const { folderPathMap } = await getBookmarkTreeData();
  return folderPathMap;
}

/**
 * Gets AI provider settings and validates credentials.
 * @returns {Promise<{settings: object, provider: string, hasAI: boolean}>}
 */
async function getAIConfig() {
  const settings = await chrome.storage.sync.get({
    aiProvider: 'anthropic',
    anthropicApiKey: '',
    openaiApiKey: '',
    openaiModel: 'gpt-4o',
    openrouterApiKey: '',
    openrouterModel: '',
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash',
    domainRules: []
  });

  const provider = settings.aiProvider || 'anthropic';
  let hasAI = false;

  if (provider === 'openai' && settings.openaiApiKey?.trim()) {
    hasAI = true;
  } else if (provider === 'openrouter' && settings.openrouterApiKey?.trim() && settings.openrouterModel?.trim()) {
    hasAI = true;
  } else if (provider === 'gemini' && settings.geminiApiKey?.trim()) {
    hasAI = true;
  } else if (provider === 'anthropic' && settings.anthropicApiKey?.trim()) {
    hasAI = true;
  }

  return { settings, provider, hasAI };
}

/**
 * Uses AI to parse a natural language search query into structured parameters.
 * Falls back to simple keyword splitting if AI is not configured.
 */
async function handleParseSearchQuery(query) {
  const { settings, provider, hasAI } = await getAIConfig();

  if (!hasAI) {
    // Fallback: split query into keywords, strip common filler words
    const stopWords = new Set([
      'find', 'show', 'me', 'my', 'all', 'the', 'that', 'about',
      'bookmarks', 'bookmark', 'links', 'link', 'saved', 'i', 'were',
      'what', 'where', 'which', 'a', 'an', 'of', 'to', 'in', 'for',
      'with', 'on', 'at', 'from', 'by', 'it', 'is', 'was', 'are'
    ]);
    const keywords = query.toLowerCase().split(/\s+/)
      .filter(w => w.length > 1 && !stopWords.has(w));
    return {
      success: true,
      data: { keywords, dateRange: null, semanticIntent: query },
      hasAI: false
    };
  }

  const today = new Date().toISOString().split('T')[0];
  const prompt = `Extract search parameters from this bookmark search query.
Today's date is ${today}.

Query: "${query}"

Respond in JSON only:
{
  "keywords": ["keyword1", "keyword2"],
  "dateRange": {"after": "YYYY-MM-DD", "before": "YYYY-MM-DD"} or null,
  "semanticIntent": "brief description of what user is looking for"
}`;

  const responseText = await callAI(prompt, settings, provider, 256);

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse AI response');

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    success: true,
    data: {
      keywords: parsed.keywords || [],
      dateRange: parsed.dateRange || null,
      semanticIntent: parsed.semanticIntent || query
    },
    hasAI: true
  };
}

/**
 * Searches bookmarks locally using Chrome's search API with keyword matching
 * and optional date filtering. Enriches results with folder paths.
 */
async function handleLocalBookmarkSearch(keywords, dateRange) {
  if (!keywords || keywords.length === 0) {
    return { success: true, results: [] };
  }

  const folderMap = await getFolderPathMap();

  // Hoist date-string parsing out of the per-result loop — the same two bounds apply to every match.
  const afterMs = dateRange && dateRange.after ? new Date(dateRange.after).getTime() : null;
  const beforeMs = dateRange && dateRange.before ? new Date(dateRange.before).getTime() : null;

  const trimmedKeywords = keywords.map(k => k.trim()).filter(Boolean);

  // Keyword queries are independent — run them concurrently instead of one at a time.
  const matchLists = await Promise.all(
    trimmedKeywords.map(keyword => chrome.bookmarks.search({ query: keyword }))
  );

  const seen = new Set();
  const results = [];

  // Merge in keyword order so earlier keywords win ties for the same bookmark, same as before.
  for (const matches of matchLists) {
    for (const bm of matches) {
      if (!bm.url || seen.has(bm.id)) continue;
      seen.add(bm.id);

      const added = bm.dateAdded || 0;
      if (afterMs !== null && added < afterMs) continue;
      if (beforeMs !== null && added > beforeMs) continue;

      results.push({
        id: bm.id,
        title: bm.title,
        url: bm.url,
        dateAdded: bm.dateAdded,
        folderPath: folderMap[bm.parentId] || '',
        matchType: 'keyword'
      });
    }
  }

  return { success: true, results };
}

/**
 * Uses AI to find semantically relevant bookmarks that keyword search may miss.
 * Processes bookmarks in batches to stay within token limits.
 */
async function handleSemanticBookmarkSearch(semanticIntent, excludeIds) {
  const { settings, provider, hasAI } = await getAIConfig();

  if (!hasAI) {
    return { success: true, results: [] };
  }

  const { allBookmarks, folderPathMap: folderMap } = await getBookmarkTreeData();
  const excludeSet = new Set(excludeIds || []);

  // Filter out already-found bookmarks
  const candidates = allBookmarks.filter(bm => !excludeSet.has(bm.id));

  const BATCH_SIZE = 200;
  const MAX_BATCHES = 3;

  const batches = [];
  for (let i = 0; i < candidates.length && i < BATCH_SIZE * MAX_BATCHES; i += BATCH_SIZE) {
    batches.push(candidates.slice(i, i + BATCH_SIZE));
  }

  // Batches are independent AI requests — fire them concurrently instead of paying
  // up to MAX_BATCHES sequential round trips (each with its own 25s timeout).
  const batchResponses = await Promise.allSettled(batches.map(batch => {
    const bookmarkData = batch.map(bm => ({
      id: bm.id,
      t: bm.title || '',
      u: bm.url
    }));

    const prompt = `Given this search intent: "${semanticIntent}"

Rate each bookmark's relevance (0-10). Return ONLY a JSON array of objects with "id" and "score" for bookmarks scoring 5 or higher. Return an empty array [] if none are relevant.

Bookmarks:
${JSON.stringify(bookmarkData)}`;

    return callAI(prompt, settings, provider, 1024);
  }));

  const allResults = [];

  batchResponses.forEach((response, batchIdx) => {
    if (response.status !== 'fulfilled') {
      console.error('Semantic search batch error:', response.reason);
      return;
    }

    const jsonMatch = response.value.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return;

    try {
      const scored = JSON.parse(jsonMatch[0]);
      // Index this batch once so scoring is an O(1) lookup instead of a linear scan per result.
      const batchById = new Map(batches[batchIdx].map(bm => [bm.id, bm]));
      for (const item of scored) {
        if (item.score < 5) continue;
        const bm = batchById.get(item.id);
        if (!bm) continue;
        allResults.push({
          id: bm.id,
          title: bm.title,
          url: bm.url,
          dateAdded: bm.dateAdded,
          folderPath: folderMap[bm.parentId] || '',
          matchType: 'semantic',
          score: item.score
        });
      }
    } catch (error) {
      console.error('Semantic search batch parse error:', error);
    }
  });

  // Sort by score descending
  allResults.sort((a, b) => b.score - a.score);
  return { success: true, results: allResults };
}

// ============================================================
// Health Check
// ============================================================

/**
 * Collects all bookmark leaf nodes (those with URLs) from the entire tree.
 * @returns {Promise<chrome.bookmarks.BookmarkTreeNode[]>}
 */
async function getAllBookmarks() {
  const { allBookmarks } = await getBookmarkTreeData();
  return allBookmarks;
}

/**
 * Extracts the page title from raw HTML.
 * Prefers og:title, falls back to twitter:title, then <title>.
 * @param {string} html
 * @returns {string|null}
 */
function extractTitleFromHtml(html) {
  // og:title (attribute order varies)
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (og) return og[1].trim();

  // twitter:title
  const tw = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:title["']/i);
  if (tw) return tw[1].trim();

  // <title> tag
  const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (t) return t[1].trim();

  return null;
}

/**
 * Normalizes a URL for redirect comparison (removes fragment and trailing slash).
 * @param {string} url
 * @returns {string}
 */
function normalizeUrlForComparison(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    if (u.pathname !== '/') u.pathname = u.pathname.replace(/\/$/, '');
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Checks a single bookmark for all health issues: dead link, redirect,
 * title change, stale, and domain gone.
 *
 * Probes with HEAD first — it carries no body, so it's far cheaper than GET for what
 * is mostly a liveness + redirect check. A HEAD response is only trusted when it's
 * successful (<400): plenty of real hosts (bot protection, misconfigured servers)
 * block or mishandle HEAD specifically while GET works fine, so any HEAD failure or
 * error status falls back to GET rather than being reported as dead — matching what
 * the original GET-only check would have determined. GET is also used whenever the
 * page is HTML and its body is actually needed to compare titles; any other
 * response's body is drained/aborted without being read.
 * @param {chrome.bookmarks.BookmarkTreeNode} bookmark
 * @param {number} staleDays
 * @returns {Promise<object>}
 */
async function checkSingleBookmark(bookmark, staleDays) {
  const issues = [];
  let newUrl = null;
  let newTitle = null;
  let statusCode = null;

  const TIMEOUT_MS = 12000;

  try {
    let response = await fetchWithTimeout(bookmark.url, 'HEAD', TIMEOUT_MS);
    let usedHead = !!response;

    if (!response || response.status >= 400) {
      abortResponseBody(response);
      response = await fetchWithTimeout(bookmark.url, 'GET', TIMEOUT_MS);
      usedHead = false;
    }

    if (!response) {
      issues.push('domain_gone');
      statusCode = 0;
    } else {
      statusCode = response.status;

      if (statusCode === 404 || statusCode === 410 || statusCode >= 400) {
        issues.push('dead');
        abortResponseBody(response);
      } else {
        // Check for redirect: compare final URL to original
        const finalUrl = response.url;
        if (finalUrl && normalizeUrlForComparison(finalUrl) !== normalizeUrlForComparison(bookmark.url)) {
          issues.push('redirect');
          newUrl = finalUrl;
        }

        // Extract title from HTML for pages that return HTML
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          // HEAD never carries a body, so fetch one now if that's what we used.
          const htmlResponse = usedHead
            ? await fetchWithTimeout(bookmark.url, 'GET', TIMEOUT_MS)
            : response;
          if (htmlResponse) {
            const html = await readTextUpTo(htmlResponse, 50000);
            const liveTitle = extractTitleFromHtml(html);
            if (liveTitle && liveTitle !== bookmark.title) {
              newTitle = liveTitle;
              issues.push('title_changed');
            }
          }
        } else {
          // Not HTML — nothing more to learn from the body, so drain it rather than
          // leaving it dangling.
          abortResponseBody(response);
        }
      }
    }
  } catch {
    // Covers failures that occur after a successful connection (e.g. the connection
    // dropping mid-body-read) — fetchWithTimeout itself never throws.
    issues.push('domain_gone');
    statusCode = 0;
  }

  // Staleness: use dateLastUsed if available, else dateAdded
  const cutoffMs = staleDays * 24 * 60 * 60 * 1000;
  const lastActivity = bookmark.dateLastUsed || bookmark.dateAdded || 0;
  if (lastActivity && (Date.now() - lastActivity) > cutoffMs) {
    issues.push('stale');
  }

  // Primary status: most actionable issue
  let status = 'ok';
  if (issues.includes('domain_gone')) status = 'domain_gone';
  else if (issues.includes('dead')) status = 'dead';
  else if (issues.includes('redirect')) status = 'redirect';
  else if (issues.includes('stale') && issues.length === 1) status = 'stale';
  else if (issues.length > 0) status = issues[0];

  return {
    id: bookmark.id,
    url: bookmark.url,
    title: bookmark.title,
    dateAdded: bookmark.dateAdded,
    dateLastUsed: bookmark.dateLastUsed || null,
    status,
    issues,
    newUrl,
    newTitle,
    statusCode,
    checkedAt: new Date().toISOString(),
    dismissed: false,
    fixed: false
  };
}

const HOST_POLITENESS_MS = 150;

/**
 * Keeps successive requests to the same host at least HOST_POLITENESS_MS apart,
 * without serialising requests to *different* hosts the way a global inter-batch
 * sleep did. `hostLastRequestAt` is a Map scoped to a single runHealthCheck() run.
 */
async function politenessDelay(url, hostLastRequestAt) {
  let host;
  try {
    host = new URL(url).host;
  } catch {
    return;
  }
  const now = Date.now();
  const earliestAllowed = (hostLastRequestAt.get(host) || 0) + HOST_POLITENESS_MS;
  hostLastRequestAt.set(host, Math.max(now, earliestAllowed));
  if (earliestAllowed > now) {
    await new Promise(resolve => setTimeout(resolve, earliestAllowed - now));
  }
}

/**
 * Runs a full health check on all bookmarks using a fixed-size worker pool: N workers
 * pull the next bookmark off a shared index instead of running in lock-step batches, so
 * one slow/hanging host costs a single worker slot (up to its own timeout) rather than
 * stalling the rest of a batch for the full timeout.
 * Stores progress and results in chrome.storage.local.
 * @returns {Promise<{ success: boolean, summary: object }>}
 */
async function runHealthCheck() {
  const settings = await chrome.storage.sync.get({ healthCheckStaleDays: 365 });
  const staleDays = settings.healthCheckStaleDays;

  const bookmarks = await getAllBookmarks();
  const total = bookmarks.length;

  await chrome.storage.local.set({
    healthCheckProgress: { inProgress: true, current: 0, total }
  });

  const results = new Array(total);
  const hostLastRequestAt = new Map();

  let nextIndex = 0;
  let completed = 0;
  let lastProgressWriteAt = 0;
  const PROGRESS_WRITE_INTERVAL_MS = 500;

  // Progress writes are throttled — the UI only polls/listens every ~500ms anyway,
  // so writing (and broadcasting onChanged) more often than that is pure waste.
  async function writeProgress() {
    const now = Date.now();
    if (now - lastProgressWriteAt < PROGRESS_WRITE_INTERVAL_MS) return;
    lastProgressWriteAt = now;
    await chrome.storage.local.set({
      healthCheckProgress: { inProgress: true, current: completed, total }
    });
  }

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= total) return;
      await politenessDelay(bookmarks[i].url, hostLastRequestAt);
      results[i] = await checkSingleBookmark(bookmarks[i], staleDays);
      completed++;
      await writeProgress();
    }
  }

  const CONCURRENCY = 15;
  const workerCount = Math.min(CONCURRENCY, total);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const summary = {
    total: results.length,
    dead: results.filter(r => r.issues.includes('dead')).length,
    domainGone: results.filter(r => r.issues.includes('domain_gone')).length,
    redirected: results.filter(r => r.issues.includes('redirect')).length,
    stale: results.filter(r => r.issues.includes('stale')).length,
    titleChanged: results.filter(r => r.issues.includes('title_changed')).length,
    ok: results.filter(r => r.issues.length === 0).length
  };

  await saveHealthCheckResults(results, summary);

  await chrome.storage.local.set({
    healthCheckProgress: { inProgress: false, current: total, total }
  });

  return { success: true, summary };
}

/**
 * Health check results are stored one small key per bookmark (`hce_<id>`) plus a
 * `healthCheckMeta` index ({lastRun, summary, ids}), instead of one big array under a
 * single key. A single-bookmark fix then only has to rewrite its own tiny entry (and,
 * for deletes, the small id list) rather than re-serialising the entire result set —
 * the dominant cost for large bookmark collections.
 */
function healthCheckEntryKey(id) {
  return `hce_${id}`;
}

/**
 * Persists a freshly computed set of health-check results in the keyed layout,
 * clearing out entries left over from a previous run that no longer apply.
 */
async function saveHealthCheckResults(results, summary) {
  const prevStored = await chrome.storage.local.get('healthCheckMeta');
  const prevIds = (prevStored.healthCheckMeta && prevStored.healthCheckMeta.ids) || [];
  const newIds = results.map(r => r.id);
  const newIdSet = new Set(newIds);
  const staleKeys = prevIds.filter(id => !newIdSet.has(id)).map(healthCheckEntryKey);

  if (staleKeys.length > 0) {
    await chrome.storage.local.remove(staleKeys);
  }

  const entries = {};
  for (const r of results) entries[healthCheckEntryKey(r.id)] = r;

  await chrome.storage.local.set({
    ...entries,
    healthCheckMeta: { lastRun: new Date().toISOString(), summary, ids: newIds }
  });
}

/**
 * Reconstructs the {healthCheckResults: {lastRun, summary, results}, healthCheckProgress}
 * shape the UI expects from the keyed storage layout: one read for the meta/progress
 * index, one batched read for every entry it references.
 */
async function getHealthCheckData() {
  const stored = await chrome.storage.local.get(['healthCheckMeta', 'healthCheckProgress']);
  const meta = stored.healthCheckMeta;
  if (!meta) {
    return { healthCheckProgress: stored.healthCheckProgress };
  }

  const entryKeys = meta.ids.map(healthCheckEntryKey);
  const entriesById = entryKeys.length > 0 ? await chrome.storage.local.get(entryKeys) : {};
  const results = meta.ids.map(id => entriesById[healthCheckEntryKey(id)]).filter(Boolean);

  return {
    healthCheckResults: { lastRun: meta.lastRun, summary: meta.summary, results },
    healthCheckProgress: stored.healthCheckProgress
  };
}

/**
 * Applies a fix action to a single bookmark and updates its stored result entry.
 * @param {string} bookmarkId
 * @param {'updateUrl'|'updateTitle'|'delete'} fixType
 * @param {string} [newValue]
 */
async function applyHealthFix(bookmarkId, fixType, newValue) {
  try {
    if (fixType === 'updateUrl') {
      await chrome.bookmarks.update(bookmarkId, { url: newValue });
    } else if (fixType === 'updateTitle') {
      await chrome.bookmarks.update(bookmarkId, { title: newValue });
    } else if (fixType === 'delete') {
      await chrome.bookmarks.remove(bookmarkId);
    }

    const metaStored = await chrome.storage.local.get('healthCheckMeta');
    const meta = metaStored.healthCheckMeta;
    if (meta) {
      const entryKey = healthCheckEntryKey(bookmarkId);
      if (fixType === 'delete') {
        await chrome.storage.local.remove(entryKey);
        meta.ids = meta.ids.filter(id => id !== bookmarkId);
        meta.summary.total = Math.max(0, meta.summary.total - 1);
        await chrome.storage.local.set({ healthCheckMeta: meta });
      } else {
        const entryStored = await chrome.storage.local.get(entryKey);
        const entry = entryStored[entryKey];
        if (entry) {
          entry.fixed = true;
          if (fixType === 'updateUrl') entry.url = newValue;
          if (fixType === 'updateTitle') entry.title = newValue;
          await chrome.storage.local.set({ [entryKey]: entry });
        }
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Applies a bulk fix to multiple bookmarks of a specific issue type. Entries are read
 * and written by key in two batched calls (not one chrome.storage round trip per id),
 * and matched with a Map/object lookup instead of a findIndex/find scan per id —
 * replacing the previous O(n·m) behaviour with O(n).
 * @param {'deleteAllDead'|'fixAllRedirects'|'dismissAllStale'|'deleteAllStale'|'updateAllTitles'} fixType
 * @param {string[]} ids
 */
async function applyBulkFix(fixType, ids) {
  const metaStored = await chrome.storage.local.get('healthCheckMeta');
  const meta = metaStored.healthCheckMeta;
  if (!meta) return { success: true };

  const entryKeys = ids.map(healthCheckEntryKey);
  const entriesById = await chrome.storage.local.get(entryKeys);

  const toSet = {};
  const toRemoveKeys = [];
  const deletedIds = new Set();
  let modified = false;

  for (const id of ids) {
    const key = healthCheckEntryKey(id);
    const entry = entriesById[key];
    try {
      if (fixType === 'deleteAllDead' || fixType === 'deleteAllStale') {
        await chrome.bookmarks.remove(id);
        toRemoveKeys.push(key);
        deletedIds.add(id);
        modified = true;
      } else if (fixType === 'fixAllRedirects') {
        if (entry && entry.newUrl) {
          await chrome.bookmarks.update(id, { url: entry.newUrl });
          entry.fixed = true;
          entry.url = entry.newUrl;
          toSet[key] = entry;
          modified = true;
        }
      } else if (fixType === 'dismissAllStale') {
        if (entry) {
          entry.dismissed = true;
          toSet[key] = entry;
          modified = true;
        }
      } else if (fixType === 'updateAllTitles') {
        if (entry && entry.newTitle) {
          await chrome.bookmarks.update(id, { title: entry.newTitle });
          entry.fixed = true;
          entry.title = entry.newTitle;
          toSet[key] = entry;
          modified = true;
        }
      }
    } catch (err) {
      console.error(`Bulk fix failed for bookmark ${id}:`, err);
    }
  }

  if (modified) {
    if (Object.keys(toSet).length > 0) {
      await chrome.storage.local.set(toSet);
    }
    if (toRemoveKeys.length > 0) {
      await chrome.storage.local.remove(toRemoveKeys);
      meta.ids = meta.ids.filter(id => !deletedIds.has(id));
    }
    meta.summary.total = meta.ids.length;
    await chrome.storage.local.set({ healthCheckMeta: meta });
  }

  return { success: true };
}

/**
 * Dismisses a health check issue for a single bookmark without deleting it.
 * @param {string} bookmarkId
 */
async function dismissHealthIssue(bookmarkId) {
  const entryKey = healthCheckEntryKey(bookmarkId);
  const stored = await chrome.storage.local.get(entryKey);
  const entry = stored[entryKey];
  if (entry) {
    entry.dismissed = true;
    await chrome.storage.local.set({ [entryKey]: entry });
  }
  return { success: true };
}

/**
 * Sets up (or clears) the periodic health-check alarm based on stored settings.
 */
async function setupHealthCheckAlarm() {
  await chrome.alarms.clear('bookmarkHealthCheck');

  const settings = await chrome.storage.sync.get({
    healthCheckEnabled: false,
    healthCheckInterval: 'weekly'
  });

  if (!settings.healthCheckEnabled) return;

  const intervalMinutes = {
    daily: 1440,
    weekly: 10080,
    monthly: 43200
  }[settings.healthCheckInterval] || 10080;

  chrome.alarms.create('bookmarkHealthCheck', { periodInMinutes: intervalMinutes });
}
