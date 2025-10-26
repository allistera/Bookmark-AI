/**
 * Bookmark-AI Cloudflare Worker
 * A basic worker for the Bookmark-AI service
 */

export interface Env {
  // Define your environment variables here
  // Example: API_KEY: string;
}

export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
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

        // Process the bookmark URL
        return new Response(JSON.stringify({
          success: true,
          message: 'Bookmark received',
          data: {
            url: body.url,
            receivedAt: new Date().toISOString()
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
