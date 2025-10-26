/**
 * Bookmark-AI Cloudflare Worker
 * A basic worker for the Bookmark-AI service
 */

import Anthropic from '@anthropic-ai/sdk';
import * as yaml from 'js-yaml';
import bookmarkFormatYaml from '../bookmark_format.yaml';

export interface Env {
  ANTHROPIC_API_KEY: string;
  INSTAPAPER_USERNAME: string;
  INSTAPAPER_PASSWORD: string;
}

/**
 * Type for the bookmark format YAML structure
 */
interface BookmarkCategory {
  [key: string]: BookmarkCategory | string[];
}

/**
 * Recursively extracts all category paths from the bookmark format YAML
 */
function extractCategories(obj: BookmarkCategory, prefix: string = ''): string[] {
  const categories: string[] = [];

  for (const key in obj) {
    if (key === 'Allister_Bookmarks') {
      // Skip the root key and process its children directly
      categories.push(...extractCategories(obj[key] as BookmarkCategory, ''));
      continue;
    }

    const currentPath = prefix ? `${prefix}/${key}` : key;

    if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      // This is a category with subcategories
      categories.push(currentPath);
      categories.push(...extractCategories(obj[key] as BookmarkCategory, currentPath));
    } else if (Array.isArray(obj[key])) {
      // This is a leaf category with items
      categories.push(currentPath);
    }
  }

  return categories;
}

/**
 * Gets all available categories from the bookmark format YAML
 */
function getAvailableCategories(): string[] {
  const bookmarkFormat = yaml.load(bookmarkFormatYaml as string) as BookmarkCategory;
  return extractCategories(bookmarkFormat);
}

/**
 * Analyzes a bookmark URL using Claude AI
 */
async function analyzeBookmark(url: string, apiKey: string): Promise<{
  isArticle: boolean;
  title: string;
  summary: string;
  categories: string[];
  contentType: string;
  matchedCategory?: string;
}> {
  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  // Get available categories from the YAML file
  const availableCategories = getAvailableCategories();

  const prompt = `Analyze this bookmark URL and provide:
1. Whether this is a web article/blog post (true) or something else like a tool, homepage, documentation, etc. (false)
2. What type of content this is (e.g., "article", "tool", "documentation", "homepage", "video", "repository", etc.)
3. A suggested title/name for the bookmark
4. A brief summary (1-2 sentences) of what the page is about
5. 2-3 relevant categories or tags

URL: ${url}

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

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  // Extract the text content from the response
  const textContent = message.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text content in Claude response');
  }

  // Parse the JSON response
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not find JSON in Claude response');
  }

  const result = JSON.parse(jsonMatch[0]);

  // If not an article and no matched category, set to "Other"
  if (!result.isArticle && !result.matchedCategory) {
    result.matchedCategory = 'Other';
  }

  return result;
}

/**
 * Saves an article to Instapaper using the Simple API
 */
async function saveToInstapaper(
  url: string,
  title: string,
  username: string,
  password: string
): Promise<{ success: boolean; bookmarkId?: number; error?: string }> {
  const instapaperUrl = 'https://www.instapaper.com/api/add';

  // Prepare the request body
  const params = new URLSearchParams({
    url: url,
    title: title,
  });

  // Use HTTP Basic Authentication
  const auth = btoa(`${username}:${password}`);

  try {
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
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    // Route handling
    if (url.pathname === '/') {
      return new Response(JSON.stringify({
        message: 'Welcome to Bookmark-AI',
        description: 'Use AI to Automatically Sort Bookmarks',
        endpoints: {
          '/': 'This help message',
          '/health': 'Health check endpoint',
          '/api/bookmarks': 'POST - Submit a bookmark URL for processing'
        }
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...getCORSHeaders()
        }
      });
    }

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString()
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...getCORSHeaders()
        }
      });
    }

    if (url.pathname === '/api/bookmarks') {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({
          error: 'Method Not Allowed',
          message: 'This endpoint only accepts POST requests'
        }), {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            ...getCORSHeaders()
          }
        });
      }

      try {
        const body = await request.json() as { url?: string };

        if (!body.url) {
          return new Response(JSON.stringify({
            error: 'Bad Request',
            message: 'Missing required property: url'
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...getCORSHeaders()
            }
          });
        }

        // Validate URL format
        try {
          new URL(body.url);
        } catch {
          return new Response(JSON.stringify({
            error: 'Bad Request',
            message: 'Invalid URL format'
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...getCORSHeaders()
            }
          });
        }

        // Check if API key is configured
        if (!env.ANTHROPIC_API_KEY) {
          return new Response(JSON.stringify({
            error: 'Internal Server Error',
            message: 'API key not configured'
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...getCORSHeaders()
            }
          });
        }

        // Process the bookmark URL with Claude AI
        try {
          const analysis = await analyzeBookmark(body.url, env.ANTHROPIC_API_KEY);

          // Automatically save to Instapaper if this is an article
          let instapaperResult = null;
          if (analysis.isArticle && env.INSTAPAPER_USERNAME && env.INSTAPAPER_PASSWORD) {
            instapaperResult = await saveToInstapaper(
              body.url,
              analysis.title,
              env.INSTAPAPER_USERNAME,
              env.INSTAPAPER_PASSWORD
            );
          }

          return new Response(JSON.stringify({
            success: true,
            message: 'Bookmark analyzed successfully',
            data: {
              url: body.url,
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
              analyzedAt: new Date().toISOString()
            }
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...getCORSHeaders()
            }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            error: 'Internal Server Error',
            message: 'Failed to analyze bookmark',
            details: error instanceof Error ? error.message : 'Unknown error'
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...getCORSHeaders()
            }
          });
        }
      } catch (error) {
        return new Response(JSON.stringify({
          error: 'Bad Request',
          message: 'Invalid JSON body'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...getCORSHeaders()
          }
        });
      }
    }

    // 404 for unknown routes
    return new Response(JSON.stringify({
      error: 'Not Found',
      path: url.pathname
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...getCORSHeaders()
      }
    });
  }
};

function getCORSHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function handleCORS(): Response {
  return new Response(null, {
    status: 204,
    headers: getCORSHeaders()
  });
}
