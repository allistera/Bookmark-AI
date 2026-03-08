const USER_AGENT = 'Mozilla/5.0 (compatible; Bookmark-AI/1.0)';

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeBookmark') {
    handleAnalyzeBookmark(request)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
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
      if (node.parentId === '0') {
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

  let responseText;

  if (provider === 'openrouter') {
    // OpenRouter API call (OpenAI-compatible format)
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
          max_tokens: 1024,
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
    responseText = message.choices?.[0]?.message?.content;
    if (!responseText) {
      console.error('No content in OpenRouter response:', JSON.stringify(message));
      throw new Error('No content in OpenRouter response');
    }
  } else {
    // Anthropic API call
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
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1024,
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
    responseText = textContent.text;
  }

  // Parse the JSON response (same for both providers)
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

async function handleAnalyzeBookmark({ url, title, createTodoist, autoBookmark }) {
  try {
    // Get settings from storage
    const settings = await chrome.storage.sync.get({
      aiProvider: 'anthropic',
      anthropicApiKey: '',
      openrouterApiKey: '',
      openrouterModel: '',
      instapaperUsername: '',
      instapaperPassword: '',
      todoistApiToken: ''
    });

    const provider = settings.aiProvider || 'anthropic';

    // Validate AI provider credentials are configured
    if (provider === 'openrouter') {
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

    // Analyze the bookmark using the configured AI provider
    const analysis = await analyzeBookmark(url, settings, provider, title);

    // Automatically save to Instapaper if this is an article and credentials are configured
    let instapaperResult = null;
    if (analysis.isArticle && settings.instapaperUsername && settings.instapaperPassword) {
      instapaperResult = await saveToInstapaper(
        url,
        analysis.title,
        settings.instapaperUsername,
        settings.instapaperPassword
      );
    }

    // Create Todoist task if requested and API token is configured
    let todoistResult = null;
    if (createTodoist && settings.todoistApiToken) {
      todoistResult = await createTodoistTask(
        url,
        analysis.title,
        analysis.summary,
        settings.todoistApiToken
      );
    }

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
async function createBookmarkInCategory(url, title, categoryPath) {
  try {
    // Parse the category path
    const categories = categoryPath.split('/').filter(c => c.trim().length > 0);

    // Start from the bookmarks bar
    let currentParentId = '1'; // '1' is the bookmarks bar

    // Navigate/create the category folder hierarchy
    for (const category of categories) {
      const folder = await getOrCreateFolder(category, currentParentId);
      currentParentId = folder.id;
    }

    // Create the bookmark in the final folder
    const bookmark = await chrome.bookmarks.create({
      parentId: currentParentId,
      title: title,
      url: url
    });

    console.log('Bookmark created:', bookmark);
    return bookmark.id;
  } catch (error) {
    console.error('Error creating bookmark:', error);
    throw error;
  }
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
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, _tab) => {
  if (info.menuItemId === 'bookmark-ai') {
    // Open the popup or trigger analysis
    chrome.action.openPopup();
  }
});
