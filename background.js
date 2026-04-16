const USER_AGENT = 'Mozilla/5.0 (compatible; Bookmark-AI/1.0)';

// Chrome assigns fixed IDs to the built-in bookmark containers
const BOOKMARK_ROOT_IDS = { ROOT: '0', BAR: '1', OTHER: '2' };

// Listen for messages from popup and health-check page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeBookmark') {
    handleAnalyzeBookmark(request)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  if (request.action === 'runHealthCheck') {
    runHealthCheck()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'getHealthCheckData') {
    chrome.storage.local.get(['healthCheckResults', 'healthCheckProgress'])
      .then(data => sendResponse(data))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'applyHealthFix') {
    applyHealthFix(request.bookmarkId, request.fixType, request.newValue)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'applyBulkFix') {
    applyBulkFix(request.fixType, request.ids)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'dismissHealthIssue') {
    dismissHealthIssue(request.bookmarkId)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'setupHealthCheckAlarm') {
    setupHealthCheckAlarm()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'parseSearchQuery') {
    handleParseSearchQuery(request.query)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'searchBookmarksLocal') {
    handleLocalBookmarkSearch(request.keywords, request.dateRange)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'searchBookmarksSemantic') {
    handleSemanticBookmarkSearch(request.semanticIntent, request.excludeIds)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'checkAIConfig') {
    getAIConfig()
      .then(({ hasAI }) => sendResponse({ hasAI }))
      .catch(() => sendResponse({ hasAI: false }));
    return true;
  }

  if (request.action === 'undoBookmark') {
    chrome.bookmarks.remove(request.bookmarkId)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'getUnsortedBookmarks') {
    getUnsortedBookmarks()
      .then(bookmarks => sendResponse({ success: true, bookmarks }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'getAISuggestion') {
    handleGetAISuggestion(request)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'moveBookmark') {
    handleMoveBookmark(request)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

/**
 * Scans the user's bookmark tree and extracts all folder paths
 * @returns {Promise<string[]>} Array of folder paths (e.g., "Work/Projects/Web")
 */
async function getExistingBookmarkFolders() {
  const tree = await chrome.bookmarks.getTree();
  const folders = [];

  function extractFolders(nodes, path = '') {
    for (const node of nodes) {
      // Skip if it's a bookmark (has url) - we only want folders
      if (node.url) continue;

      // Skip root nodes (Bookmarks Bar, Other Bookmarks, Mobile Bookmarks)
      // but process their children
      if (node.parentId === BOOKMARK_ROOT_IDS.ROOT) {
        if (node.children) {
          extractFolders(node.children, '');
        }
        continue;
      }

      // Build the current path
      const currentPath = path ? `${path}/${node.title}` : node.title;

      // Add this folder to the list
      if (node.title) {
        folders.push(currentPath);
      }

      // Recursively process children
      if (node.children) {
        extractFolders(node.children, currentPath);
      }
    }
  }

  extractFolders(tree);
  return folders;
}

/**
 * Fetches the HTML content of a URL for analysis
 */
async function fetchHtmlContent(url) {
  try {
    console.log(`Fetching HTML content for: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });

    if (!response.ok) {
      console.error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      return null;
    }

    return await response.text();
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
        })
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
        })
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
        })
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
}

/**
 * Analyzes a bookmark URL using the configured AI provider
 */
async function analyzeBookmark(url, settings, provider, providedTitle) {
  // Fetch HTML content if no title was provided
  let htmlContent = null;
  if (!providedTitle) {
    htmlContent = await fetchHtmlContent(url);
    // Truncate HTML to first 8000 characters to keep token usage reasonable
    if (htmlContent && htmlContent.length > 8000) {
      htmlContent = htmlContent.substring(0, 8000) + '\n... [content truncated]';
    }
  }

  // Get the user's existing bookmark folders
  const existingFolders = await getExistingBookmarkFolders();
  console.log('Found existing bookmark folders:', existingFolders.length);

  // Build the category matching section of the prompt
  let categorySection = '';
  if (existingFolders.length > 0) {
    categorySection = `
Additionally, if this is NOT an article, you MUST match it to exactly ONE category - the single best match from the user's existing bookmark folders:
${existingFolders.join('\n')}

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
 * Creates a task in Todoist using the REST API v2
 */
async function createTodoistTask(url, title, summary, apiToken) {
  const todoistUrl = 'https://api.todoist.com/rest/v2/tasks';

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

    if (response.status === 200) {
      // Successfully created
      const taskData = await response.json();
      return { success: true, taskId: taskData.id };
    } else if (response.status === 403) {
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
 * Checks if a URL matches any domain rule and returns the target folder path.
 * Rules with a "/" are matched as hostname + path prefix (e.g. "youtube.com/watch").
 * Rules without "/" are matched as hostname only (e.g. "github.com").
 * @param {string} url
 * @param {Array<{domain: string, folder: string}>} rules
 * @returns {string|null} The matched folder path, or null if no rule matches
 */
function matchesDomainRule(url, rules) {
  if (!rules || rules.length === 0) return null;
  try {
    const urlObj = new URL(url);
    for (const rule of rules) {
      const domain = (rule.domain || '').trim();
      if (!domain || !rule.folder) continue;
      if (domain.includes('/')) {
        const slashIdx = domain.indexOf('/');
        const ruleDomain = domain.slice(0, slashIdx);
        const rulePath = domain.slice(slashIdx); // includes leading /
        const hostnameMatch = urlObj.hostname === ruleDomain || urlObj.hostname === `www.${ruleDomain}`;
        if (hostnameMatch && urlObj.pathname.startsWith(rulePath)) {
          return rule.folder;
        }
      } else {
        if (urlObj.hostname === domain || urlObj.hostname === `www.${domain}`) {
          return rule.folder;
        }
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
  const [bar, other] = await Promise.all([
    chrome.bookmarks.getChildren(BOOKMARK_ROOT_IDS.BAR),
    chrome.bookmarks.getChildren(BOOKMARK_ROOT_IDS.OTHER)
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

async function handleMoveBookmark({ bookmarkId, categoryPath }) {
  const parentId = await ensureFolderPath(categoryPath);
  await chrome.bookmarks.move(bookmarkId, { parentId });
  return { success: true };
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
chrome.contextMenus.onClicked.addListener(async (info, _tab) => {
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
  const tree = await chrome.bookmarks.getTree();
  const map = {};

  function traverse(nodes, path = '') {
    for (const node of nodes) {
      if (node.url) continue;

      if (node.parentId === '0') {
        if (node.children) traverse(node.children, '');
        continue;
      }

      const currentPath = path ? `${path}/${node.title}` : node.title;
      if (node.title) map[node.id] = currentPath;
      if (node.children) traverse(node.children, currentPath);
    }
  }

  traverse(tree);
  return map;
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
    domainRules: []
  });

  const provider = settings.aiProvider || 'anthropic';
  let hasAI = false;

  if (provider === 'openai' && settings.openaiApiKey?.trim()) {
    hasAI = true;
  } else if (provider === 'openrouter' && settings.openrouterApiKey?.trim() && settings.openrouterModel?.trim()) {
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
  const seen = new Set();
  const results = [];

  // Search for each keyword and merge results
  for (const keyword of keywords) {
    if (!keyword.trim()) continue;
    const matches = await chrome.bookmarks.search({ query: keyword });
    for (const bm of matches) {
      if (!bm.url || seen.has(bm.id)) continue;
      seen.add(bm.id);

      // Apply date filtering
      if (dateRange) {
        const added = bm.dateAdded || 0;
        if (dateRange.after) {
          const afterMs = new Date(dateRange.after).getTime();
          if (added < afterMs) continue;
        }
        if (dateRange.before) {
          const beforeMs = new Date(dateRange.before).getTime();
          if (added > beforeMs) continue;
        }
      }

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

  const allBookmarks = await getAllBookmarks();
  const folderMap = await getFolderPathMap();
  const excludeSet = new Set(excludeIds || []);

  // Filter out already-found bookmarks
  const candidates = allBookmarks.filter(bm => !excludeSet.has(bm.id));

  const BATCH_SIZE = 200;
  const MAX_BATCHES = 3;
  const allResults = [];

  for (let i = 0; i < candidates.length && i < BATCH_SIZE * MAX_BATCHES; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);

    // Build compact bookmark list
    const bookmarkData = batch.map(bm => ({
      id: bm.id,
      t: bm.title || '',
      u: bm.url
    }));

    const prompt = `Given this search intent: "${semanticIntent}"

Rate each bookmark's relevance (0-10). Return ONLY a JSON array of objects with "id" and "score" for bookmarks scoring 5 or higher. Return an empty array [] if none are relevant.

Bookmarks:
${JSON.stringify(bookmarkData)}`;

    try {
      const responseText = await callAI(prompt, settings, provider, 1024);
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const scored = JSON.parse(jsonMatch[0]);
        for (const item of scored) {
          if (item.score >= 5) {
            const bm = batch.find(b => b.id === item.id);
            if (bm) {
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
          }
        }
      }
    } catch (error) {
      console.error('Semantic search batch error:', error);
      // Continue with next batch on error
    }
  }

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
  const tree = await chrome.bookmarks.getTree();
  const bookmarks = [];

  function traverse(nodes) {
    for (const node of nodes) {
      if (node.url) {
        bookmarks.push(node);
      } else if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(tree);
  return bookmarks;
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(bookmark.url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT }
    });
    clearTimeout(timer);

    statusCode = response.status;

    if (statusCode === 404 || statusCode === 410) {
      issues.push('dead');
    } else if (statusCode >= 400) {
      issues.push('dead');
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
        const html = (await response.text()).substring(0, 50000);
        const liveTitle = extractTitleFromHtml(html);
        if (liveTitle && liveTitle !== bookmark.title) {
          newTitle = liveTitle;
          issues.push('title_changed');
        }
      }
    }
  } catch {
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

/**
 * Runs a full health check on all bookmarks, processing in batches.
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

  const results = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < bookmarks.length; i += BATCH_SIZE) {
    const batch = bookmarks.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(bm => checkSingleBookmark(bm, staleDays)));
    results.push(...batchResults);

    const current = Math.min(i + BATCH_SIZE, total);
    await chrome.storage.local.set({
      healthCheckProgress: { inProgress: true, current, total }
    });

    // Brief pause between batches to avoid overwhelming remote servers
    if (i + BATCH_SIZE < bookmarks.length) {
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  const summary = {
    total: results.length,
    dead: results.filter(r => r.issues.includes('dead')).length,
    domainGone: results.filter(r => r.issues.includes('domain_gone')).length,
    redirected: results.filter(r => r.issues.includes('redirect')).length,
    stale: results.filter(r => r.issues.includes('stale')).length,
    titleChanged: results.filter(r => r.issues.includes('title_changed')).length,
    ok: results.filter(r => r.issues.length === 0).length
  };

  await chrome.storage.local.set({
    healthCheckResults: { lastRun: new Date().toISOString(), results, summary },
    healthCheckProgress: { inProgress: false, current: total, total }
  });

  return { success: true, summary };
}

/**
 * Applies a fix action to a single bookmark and updates stored results.
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

    // Reflect the fix in stored results
    const stored = await chrome.storage.local.get('healthCheckResults');
    if (stored.healthCheckResults) {
      const { results } = stored.healthCheckResults;
      const idx = results.findIndex(r => r.id === bookmarkId);
      if (idx >= 0) {
        if (fixType === 'delete') {
          results.splice(idx, 1);
          stored.healthCheckResults.summary.total = Math.max(0, stored.healthCheckResults.summary.total - 1);
        } else {
          results[idx].fixed = true;
          if (fixType === 'updateUrl') results[idx].url = newValue;
          if (fixType === 'updateTitle') results[idx].title = newValue;
        }
        await chrome.storage.local.set({ healthCheckResults: stored.healthCheckResults });
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Applies a bulk fix to multiple bookmarks of a specific issue type.
 * @param {'deleteAllDead'|'fixAllRedirects'|'dismissAllStale'} fixType
 * @param {string[]} ids
 */
async function applyBulkFix(fixType, ids) {
  const stored = await chrome.storage.local.get('healthCheckResults');
  if (!stored.healthCheckResults) return { success: true };

  const { results } = stored.healthCheckResults;
  let modified = false;

  for (const id of ids) {
    try {
      if (fixType === 'deleteAllDead') {
        await chrome.bookmarks.remove(id);
        const idx = results.findIndex(r => r.id === id);
        if (idx >= 0) { results.splice(idx, 1); modified = true; }
      } else if (fixType === 'fixAllRedirects') {
        const entry = results.find(r => r.id === id);
        if (entry && entry.newUrl) {
          await chrome.bookmarks.update(id, { url: entry.newUrl });
          entry.fixed = true;
          entry.url = entry.newUrl;
          modified = true;
        }
      } else if (fixType === 'dismissAllStale') {
        const entry = results.find(r => r.id === id);
        if (entry) { entry.dismissed = true; modified = true; }
      }
    } catch (err) {
      console.error(`Bulk fix failed for bookmark ${id}:`, err);
    }
  }

  if (modified) {
    stored.healthCheckResults.summary.total = results.length;
    await chrome.storage.local.set({ healthCheckResults: stored.healthCheckResults });
  }

  return { success: true };
}

/**
 * Dismisses a health check issue for a single bookmark without deleting it.
 * @param {string} bookmarkId
 */
async function dismissHealthIssue(bookmarkId) {
  const stored = await chrome.storage.local.get('healthCheckResults');
  if (stored.healthCheckResults) {
    const idx = stored.healthCheckResults.results.findIndex(r => r.id === bookmarkId);
    if (idx >= 0) {
      stored.healthCheckResults.results[idx].dismissed = true;
      await chrome.storage.local.set({ healthCheckResults: stored.healthCheckResults });
    }
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
