/**
 * Instapaper integration service
 */

export interface InstapaperResult {
  saved: boolean;
  bookmarkId?: number;
  error?: string;
}

/**
 * Save an article to Instapaper using the Simple API
 */
export async function saveToInstapaper(
  url: string,
  title: string,
  username: string,
  password: string
): Promise<InstapaperResult> {
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
        Authorization: `Basic ${auth}`,
      },
      body: params.toString(),
    });

    if (response.status === 201) {
      // Successfully created
      const bookmarkId = parseInt(await response.text(), 10);
      return { saved: true, bookmarkId };
    } else if (response.status === 200) {
      // Already exists
      return { saved: true };
    } else if (response.status === 403) {
      return { saved: false, error: 'Invalid Instapaper credentials' };
    } else if (response.status === 400) {
      return { saved: false, error: 'Invalid request parameters' };
    } else if (response.status === 500) {
      return { saved: false, error: 'Instapaper service error' };
    } else {
      return { saved: false, error: `Unexpected status: ${response.status}` };
    }
  } catch (error) {
    console.error('Error saving to Instapaper:', error);
    return {
      saved: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
