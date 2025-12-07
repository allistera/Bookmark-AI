/**
 * Main router for the API
 */

import { Env } from './types/env';
import { authenticate } from './middleware/auth';
import { getCORSHeaders, handleOptions } from './middleware/cors';
import { AppError } from './utils/errors';
import { errorResponse } from './utils/responses';

// Route handlers
import {
  handleRegister,
  handleLogin,
  handleRefresh,
  handleLogout,
} from './routes/auth';
import {
  handleGetCurrentUser,
  handleUpdateCurrentUser,
  handleChangePassword,
  handleGetAPIKeys,
  handleCreateAPIKey,
  handleDeleteAPIKey,
} from './routes/users';
import { handleAnalyzeBookmark } from './routes/bookmarks';
import {
  handleGetCategories,
  handleUpdateCategories,
} from './routes/categories';

/**
 * Main request router
 */
export async function router(
  request: Request,
  env: Env,
  _ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');

  try {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(env, request);
    }

    // Health check (no auth required)
    if (url.pathname === '/health' && request.method === 'GET') {
      return new Response(
        JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...getCORSHeaders(env, origin || undefined),
          },
        }
      );
    }

    // Welcome message (no auth required)
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(
        JSON.stringify({
          message: 'Welcome to Bookmark-AI API',
          version: '2.0.0',
          description: 'Multi-user bookmark analysis with AI',
          documentation: '/api/docs',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...getCORSHeaders(env, origin || undefined),
          },
        }
      );
    }

    // Authentication endpoints (no auth required)
    if (url.pathname === '/api/auth/register' && request.method === 'POST') {
      const response = await handleRegister(request, env);
      response.headers.set('Access-Control-Allow-Origin', origin || '*');
      return response;
    }

    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      const response = await handleLogin(request, env);
      response.headers.set('Access-Control-Allow-Origin', origin || '*');
      return response;
    }

    if (url.pathname === '/api/auth/refresh' && request.method === 'POST') {
      const response = await handleRefresh(request, env);
      response.headers.set('Access-Control-Allow-Origin', origin || '*');
      return response;
    }

    // Protected endpoints (authentication required)
    const user = await authenticate(request, env);

    // Auth endpoints (with auth)
    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      const response = await handleLogout(request, env, user);
      response.headers.set('Access-Control-Allow-Origin', origin || '*');
      return response;
    }

    // User endpoints
    if (url.pathname === '/api/users/me' && request.method === 'GET') {
      const response = await handleGetCurrentUser(request, env, user);
      response.headers.set('Access-Control-Allow-Origin', origin || '*');
      return response;
    }

    if (url.pathname === '/api/users/me' && request.method === 'PUT') {
      const response = await handleUpdateCurrentUser(request, env, user);
      response.headers.set('Access-Control-Allow-Origin', origin || '*');
      return response;
    }

    if (url.pathname === '/api/users/me/password' && request.method === 'PUT') {
      const response = await handleChangePassword(request, env, user);
      response.headers.set('Access-Control-Allow-Origin', origin || '*');
      return response;
    }

    // API Key endpoints
    if (url.pathname === '/api/users/me/api-keys' && request.method === 'GET') {
      const response = await handleGetAPIKeys(request, env, user);
      response.headers.set('Access-Control-Allow-Origin', origin || '*');
      return response;
    }

    if (url.pathname === '/api/users/me/api-keys' && request.method === 'POST') {
      const response = await handleCreateAPIKey(request, env, user);
      response.headers.set('Access-Control-Allow-Origin', origin || '*');
      return response;
    }

    // DELETE /api/users/me/api-keys/:id
    const apiKeyDeleteMatch = url.pathname.match(
      /^\/api\/users\/me\/api-keys\/([^/]+)$/
    );
    if (apiKeyDeleteMatch && request.method === 'DELETE') {
      const keyId = apiKeyDeleteMatch[1];
      const response = await handleDeleteAPIKey(request, env, user, keyId);
      response.headers.set('Access-Control-Allow-Origin', origin || '*');
      return response;
    }

    // Bookmark endpoints
    if (url.pathname === '/api/bookmarks/analyze' && request.method === 'POST') {
      const response = await handleAnalyzeBookmark(request, env, user);
      response.headers.set('Access-Control-Allow-Origin', origin || '*');
      return response;
    }

    // Category endpoints
    if (url.pathname === '/api/categories' && request.method === 'GET') {
      const response = await handleGetCategories(request, env, user);
      response.headers.set('Access-Control-Allow-Origin', origin || '*');
      return response;
    }

    if (url.pathname === '/api/categories' && request.method === 'PUT') {
      const response = await handleUpdateCategories(request, env, user);
      response.headers.set('Access-Control-Allow-Origin', origin || '*');
      return response;
    }

    // Not found
    const response = errorResponse('Not found', 404);
    response.headers.set('Access-Control-Allow-Origin', origin || '*');
    return response;
  } catch (error) {
    // Error handling
    console.error('Request error:', error);

    let statusCode = 500;
    let message = 'Internal server error';

    if (error instanceof AppError) {
      statusCode = error.statusCode;
      message = error.message;
    } else if (error && typeof error === 'object' && 'name' in error) {
      if (error.name === 'ValidationError') {
        statusCode = 400;
        message = (error as Record<string, unknown>).message || 'Validation failed';
      }
    }

    const response = errorResponse(message, statusCode);
    response.headers.set('Access-Control-Allow-Origin', origin || '*');
    return response;
  }
}
