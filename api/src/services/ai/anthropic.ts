/**
 * Anthropic Claude AI service for bookmark analysis
 */

import Anthropic from '@anthropic-ai/sdk';
import { Env } from '../../types/env';
import { CategoryTree } from '../../types/user';
import { extractCategories } from '../categories';

export interface BookmarkAnalysis {
  isArticle: boolean;
  contentType: string;
  title: string;
  summary: string;
  categories: string[];
  matchedCategory?: string;
}

/**
 * Fetch HTML content from a URL
 */
async function fetchHtmlContent(url: string): Promise<string | null> {
  try {
    console.log(`Fetching HTML content for: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Bookmark-AI/1.0)',
      },
    });

    if (!response.ok) {
      console.error(
        `Failed to fetch URL: ${response.status} ${response.statusText}`
      );
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error('Error fetching HTML:', error);
    return null;
  }
}

/**
 * Analyze a bookmark URL using Claude AI
 */
export async function analyzeBookmark(
  url: string,
  categoryTree: CategoryTree,
  env: Env,
  providedTitle?: string
): Promise<BookmarkAnalysis> {
  const anthropic = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
  });

  // Fetch HTML content if no title was provided
  let htmlContent: string | null = null;
  if (!providedTitle) {
    htmlContent = await fetchHtmlContent(url);
    // Truncate HTML to first 8000 characters to keep token usage reasonable
    if (htmlContent && htmlContent.length > 8000) {
      htmlContent =
        htmlContent.substring(0, 8000) + '\n... [content truncated]';
    }
  }

  // Get available categories from the user's category tree
  let availableCategories: string[];
  try {
    availableCategories = extractCategories(categoryTree);
  } catch (error) {
    console.error('Error extracting categories:', error);
    throw new Error(
      `Failed to extract categories: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }

  const prompt = `Analyze this bookmark and provide:
1. Whether this is a web article/blog post (true) or something else like a tool, homepage, documentation, etc. (false)
2. What type of content this is (e.g., "article", "tool", "documentation", "homepage", "video", "repository", etc.)
3. The title of the page${
    providedTitle
      ? ` (the provided title is: "${providedTitle}")`
      : ' - extract this from the HTML content (check meta tags like og:title, twitter:title, or the <title> tag)'
  }
4. A brief summary (1-2 sentences) of what the page is about
5. 2-3 relevant categories or tags

URL: ${url}
${htmlContent ? `\nHTML Content (first 8000 chars):\n${htmlContent}` : ''}

${
  !url.includes('article') && !url.includes('blog') && !url.includes('post')
    ? `
Additionally, if this is NOT an article, you MUST match it to exactly ONE category - the single best match from this list:
${availableCategories.join('\n')}

IMPORTANT: Return ONLY ONE category path that best matches the URL content. If none of the categories are appropriate, return "Other".
`
    : ''
}

Please respond in JSON format:
{
  "isArticle": true or false,
  "contentType": "article" or "tool" or "documentation" etc.,
  "title": "Title here",
  "summary": "Summary here",
  "categories": ["category1", "category2", "category3"],
  "matchedCategory": "Single/Best/Category/Path" or "Other" (REQUIRED if not an article - return only ONE category)
}`;

  let message;
  try {
    message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    throw new Error(
      `Failed to call Claude AI: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }

  // Extract the text content from the response
  const textContent = message.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    console.error(
      'No text content in Claude response. Response:',
      JSON.stringify(message.content)
    );
    throw new Error('No text content in Claude response');
  }

  // Parse the JSON response
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error(
      'Could not find JSON in Claude response. Response text:',
      textContent.text
    );
    throw new Error('Could not find JSON in Claude response');
  }

  let result: BookmarkAnalysis;
  try {
    result = JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error parsing JSON from Claude response:', error);
    console.error('JSON string:', jsonMatch[0]);
    throw new Error(
      `Failed to parse Claude response: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }

  // If not an article and no matched category, set to "Other"
  if (!result.isArticle && !result.matchedCategory) {
    result.matchedCategory = 'Other';
  }

  return result;
}
