// Import bookmark format (note: must be declared as a script in manifest.json)
// We'll use importScripts for the service worker
importScripts('bookmark_format.js');

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
 * Fetches the HTML content of a URL
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
 * Analyzes a bookmark URL using Claude AI
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
  const availableCategories = getAvailableCategories();

  const prompt = `Analyze this bookmark and provide:
1. Whether this is a web article/blog post (true) or something else like a tool, homepage, documentation, etc. (false)
2. What type of content this is (e.g., "article", "tool", "documentation", "homepage", "video", "repository", etc.)
3. The title of the page${providedTitle ? ` (the provided title is: "${providedTitle}")` : ' - extract this from the HTML content (check meta tags like og:title, twitter:title, or the <title> tag)'}
4. A brief summary (1-2 sentences) of what the page is about
5. 2-3 relevant categories or tags

URL: ${url}
${htmlContent ? `\nHTML Content (first 8000 chars):\n${htmlContent}` : ''}

After analyzing the content, if this is NOT an article, you MUST match it to exactly ONE category - the single best match from this list:
${availableCategories.join('\n')}

IMPORTANT: Return ONLY ONE category path that best matches the URL content. If none of the categories are appropriate, return "Other".

Please respond in JSON format:
{
  "isArticle": true or false,
  "contentType": "article" or "tool" or "documentation" etc.,
  "title": "Title here",
  "summary": "Summary here",
  "categories": ["category1", "category2", "category3"],
  "matchedCategory": "Single/Best/Category/Path" or "Other" (REQUIRED if not an article - return only ONE category)
}`;

  try {
    console.log('Calling Claude API...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      throw new Error(`Claude API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Claude API response:', data);

    // Extract the text content from the response
    const textContent = data.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      console.error('No text content in Claude response. Response:', JSON.stringify(data.content));
      throw new Error('No text content in Claude response');
    }

    // Parse the JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Could not find JSON in Claude response. Response text:', textContent.text);
      throw new Error('Could not find JSON in Claude response');
    }

    const result = JSON.parse(jsonMatch[0]);

    // If not an article and no matched category, set to "Other"
    if (!result.isArticle && !result.matchedCategory) {
      result.matchedCategory = 'Other';
    }

    return result;
  } catch (error) {
    console.error('Error calling Claude API:', error);
    throw new Error(`Failed to call Claude AI: ${error.message}`);
  }
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
      error: error.message,
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

    if (response.status === 200 || response.status === 201) {
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
      error: error.message,
    };
  }
}

async function handleAnalyzeBookmark({ url, title, createTodoist, autoBookmark }) {
  try {
    // Get API keys from storage
    const settings = await chrome.storage.sync.get({
      anthropicApiKey: '',
      instapaperUsername: '',
      instapaperPassword: '',
      todoistApiToken: ''
    });

    // Validate Claude API key is configured
    if (!settings.anthropicApiKey || settings.anthropicApiKey.trim() === '') {
      throw new Error('Claude API key not configured. Please configure it in Extension Settings.');
    }

    // Process the bookmark URL with Claude AI
    console.log('Analyzing bookmark:', url);
    const analysis = await analyzeBookmark(url, settings.anthropicApiKey, title);
    console.log('Analysis result:', analysis);

    // Automatically save to Instapaper if this is an article
    let instapaperResult = null;
    if (analysis.isArticle && settings.instapaperUsername && settings.instapaperPassword) {
      console.log('Saving to Instapaper...');
      instapaperResult = await saveToInstapaper(
        url,
        analysis.title,
        settings.instapaperUsername,
        settings.instapaperPassword
      );
      console.log('Instapaper result:', instapaperResult);
    }

    // Create Todoist task if requested
    let todoistResult = null;
    if (createTodoist && settings.todoistApiToken) {
      console.log('Creating Todoist task...');
      todoistResult = await createTodoistTask(
        url,
        analysis.title,
        analysis.summary,
        settings.todoistApiToken
      );
      console.log('Todoist result:', todoistResult);
    }

    let bookmarkCreated = false;
    let bookmarkId = null;

    // If auto-bookmark is enabled, create the bookmark
    if (autoBookmark) {
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
        bookmarkCreated: bookmarkCreated,
        chromeBookmarkId: bookmarkId,
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
 * @param {string} categoryPath - The category path (e.g., "Work_and_Engineering/Software_Development")
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
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'bookmark-ai') {
    // Open the popup or trigger analysis
    chrome.action.openPopup();
  }
});
