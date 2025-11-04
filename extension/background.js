// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeBookmark') {
    handleAnalyzeBookmark(request)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

async function handleAnalyzeBookmark({ url, title, createTodoist, autoBookmark }) {
  try {
    // Get API endpoint and API key from storage
    const settings = await chrome.storage.sync.get({
      apiEndpoint: '',
      apiKey: ''
    });

    // Validate API endpoint is configured
    if (!settings.apiEndpoint || settings.apiEndpoint.trim() === '') {
      throw new Error('API endpoint not configured. Please configure the API endpoint in Extension Settings.');
    }

    // Validate API key is configured
    if (!settings.apiKey || settings.apiKey.trim() === '') {
      throw new Error('API key not configured. Please configure the API key in Extension Settings.');
    }

    // Validate API endpoint is a valid URL
    try {
      new URL(settings.apiEndpoint);
    } catch (urlError) {
      throw new Error('Invalid API endpoint URL. Please check your settings.');
    }

    // Call the Bookmark AI API
    let response;
    try {
      response = await fetch(`${settings.apiEndpoint}/api/bookmarks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': settings.apiKey
        },
        body: JSON.stringify({
          url: url,
          title: title,
          createTodoistTask: createTodoist
        })
      });
    } catch (fetchError) {
      // Handle network errors (DNS, connection failures, etc.)
      if (fetchError.message.includes('Failed to fetch')) {
        throw new Error('Cannot connect to API endpoint. Please verify:\n1. The API endpoint URL is correct in Extension Settings\n2. Your Cloudflare Worker is deployed and running\n3. You have internet connectivity');
      }
      throw new Error(`Network error: ${fetchError.message}`);
    }

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Unknown API error');
    }

    let bookmarkCreated = false;
    let bookmarkId = null;

    // If auto-bookmark is enabled and it's not an article, create the bookmark
    // Articles are saved to Instapaper instead of Chrome bookmarks
    if (autoBookmark && !result.data.isArticle) {
      const categoryPath = result.data.matchedCategory || 'Other';
      bookmarkId = await createBookmarkInCategory(url, result.data.title || title, categoryPath);
      bookmarkCreated = true;
    }

    return {
      success: true,
      data: {
        ...result.data,
        bookmarkCreated: bookmarkCreated,
        chromeBookmarkId: bookmarkId
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
