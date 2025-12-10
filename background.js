// Import categories
importScripts('categories.js');

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
 * Fetches the HTML content of a URL for analysis
 */
async function fetchHtmlContent(url) {
  try {
    console.log(`Fetching HTML content for: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Bookmark-AI/1.0)',
      },
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
 * Analyzes a bookmark URL using Claude AI directly
 */
async function analyzeBookmark(url, apiKey, providedTitle) {
  // Fetch HTML content if no title was provided
  let htmlContent = null;
  if (!providedTitle) {
    htmlContent = await fetchHtmlContent(url);
    // Truncate HTML to first 8000 characters to keep token usage reasonable
    if (htmlContent && htmlContent.length > 8000) {
      htmlContent = htmlContent.substring(0, 8000) + '\n... [content truncated]';
    }
  }

  // Get available categories
  const availableCategories = window.BookmarkCategories.getAvailableCategories();

  const prompt = `Analyze this bookmark and provide:
1. Whether this is a web article/blog post (true) or something else like a tool, homepage, documentation, etc. (false)
2. What type of content this is (e.g., "article", "tool", "documentation", "homepage", "video", "repository", etc.)
3. The title of the page${providedTitle ? ` (the provided title is: "${providedTitle}")` : ' - extract this from the HTML content (check meta tags like og:title, twitter:title, or the <title> tag)'}
4. A brief summary (1-2 sentences) of what the page is about
5. 2-3 relevant categories or tags

URL: ${url}
${htmlContent ? `\nHTML Content (first 8000 chars):\n${htmlContent}` : ''}

${!url.includes('article') && !url.includes('blog') && !url.includes('post') ? `
Additionally, if this is NOT an article, you MUST match it to exactly ONE category - the single best match from this list:
${availableCategories.join('\n')}

IMPORTANT: Return ONLY ONE category path that best matches the URL content. If none of the categories are appropriate, return "Other".
` : ''}

Please respond in JSON format:
{
  "isArticle": true or false,
  "contentType": "article" or "tool" or "documentation" etc.,
  "title": "Title here",
  "summary": "Summary here",
  "categories": ["category1", "category2", "category3"],
  "matchedCategory": "Single/Best/Category/Path" or "Other" (REQUIRED if not an article - return only ONE category)
}`;

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
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

  // Extract the text content from the response
  const textContent = message.content.find(block => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    console.error('No text content in Claude response. Response:', JSON.stringify(message.content));
    throw new Error('No text content in Claude response');
  }

  // Parse the JSON response
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('Could not find JSON in Claude response. Response text:', textContent.text);
    throw new Error('Could not find JSON in Claude response');
  }

  let result;
  try {
    result = JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error parsing JSON from Claude response:', error);
    console.error('JSON string:', jsonMatch[0]);
    throw new Error(`Failed to parse Claude response: ${error.message}`);
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
    title: title,
  });

  // Use HTTP Basic Authentication
  const auth = btoa(`${username}:${password}`);

  try {
    console.log(`Saving to Instapaper: ${url}`);
    const response = await fetch(instapaperUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
      },
      body: params.toString(),
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
      error: error.message || 'Unknown error',
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
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        content: taskContent,
      }),
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
      error: error.message || 'Unknown error',
    };
  }
}

async function handleAnalyzeBookmark({ url, title, createTodoist, autoBookmark }) {
  try {
    // Get settings from storage
    const settings = await chrome.storage.sync.get({
      anthropicApiKey: '',
      instapaperUsername: '',
      instapaperPassword: '',
      todoistApiToken: ''
    });

    // Validate Anthropic API key is configured
    if (!settings.anthropicApiKey || settings.anthropicApiKey.trim() === '') {
      throw new Error('Anthropic API key not configured. Please configure it in Extension Settings.');
    }

    // Analyze the bookmark using Claude AI
    const analysis = await analyzeBookmark(url, settings.anthropicApiKey, title);

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
 * @param {string} categoryPath - The category path (e.g., "Work and Engineering/Software Development")
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

/**
 * Helper function to find a bookmark tree node by path
 * @param {string[]} pathSegments - Array of folder names
 * @param {string} startNodeId - The starting node ID (default: '1' for bookmarks bar)
 * @returns {Promise<chrome.bookmarks.BookmarkTreeNode|null>}
 */
async function findNodeByPath(pathSegments, startNodeId = '1') {
  let currentNodeId = startNodeId;

  for (const segment of pathSegments) {
    const children = await chrome.bookmarks.getChildren(currentNodeId);
    const matchingChild = children.find(
      child => !child.url && child.title === segment
    );

    if (!matchingChild) {
      return null;
    }

    currentNodeId = matchingChild.id;
  }

  const nodes = await chrome.bookmarks.get(currentNodeId);
  return nodes[0] || null;
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
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'bookmark-ai') {
    // Open the popup or trigger analysis
    chrome.action.openPopup();
  }
});
