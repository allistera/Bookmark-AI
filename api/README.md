# Bookmark-AI Multi-User API

A serverless API for AI-powered bookmark analysis with multi-user authentication, built on Cloudflare Workers.

## Features

- 🔐 **JWT-based authentication** with refresh tokens
- 👤 **Multi-user support** with per-user categories and settings
- 🤖 **AI-powered bookmark analysis** using Claude 3.5 Haiku
- 📚 **Custom category trees** for each user
- 🔑 **API key generation** for programmatic access
- 🔗 **Integrations** with Instapaper and Todoist (per-user credentials)
- 🚀 **Serverless architecture** on Cloudflare Workers + D1
- 🔒 **Encrypted credential storage** for third-party integrations

## Quick Start

### Prerequisites

- Node.js 20+
- Cloudflare account
- Wrangler CLI installed (`npm install -g wrangler`)

### Installation

```bash
cd api
npm install
```

### Database Setup

1. Create a D1 database:
```bash
wrangler d1 create bookmark-ai
```

2. Update `wrangler.toml` with the database ID

3. Run migrations:
```bash
npm run migrate:local   # For local development
npm run migrate:prod    # For production
```

### Set Secrets

```bash
# Required secrets
wrangler secret put JWT_SECRET
# Enter a random 32+ character string

wrangler secret put ENCRYPTION_KEY
# Enter exactly 32 characters for AES-256

wrangler secret put ANTHROPIC_API_KEY
# Enter your Anthropic API key
```

### Development

```bash
npm run dev
```

The API will be available at `http://localhost:8787`

### Deployment

```bash
npm run deploy
```

## API Documentation

### Base URL

Production: `https://your-worker.workers.dev`
Local: `http://localhost:8787`

### Authentication

All protected endpoints require one of:
- **JWT Bearer Token** in `Authorization` header: `Bearer <token>`
- **API Key** in `X-API-Key` header: `bkm_...`

### Endpoints

#### Public Endpoints

##### `GET /health`
Health check endpoint

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-02T12:00:00Z"
}
```

##### `POST /api/auth/register`
Register a new user account (can be disabled via `DISABLE_REGISTRATION` env var)

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "fullName": "John Doe"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "abc123",
      "email": "user@example.com",
      "fullName": "John Doe",
      "createdAt": 1730548800
    },
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ...",
      "expiresIn": 900
    }
  }
}
```

##### `POST /api/auth/login`
Login with email and password

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response:**
Same as register

##### `POST /api/auth/refresh`
Refresh access token

**Request:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ...",
      "expiresIn": 900
    }
  }
}
```

#### Protected Endpoints

##### `POST /api/auth/logout`
Revoke refresh token

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Response:** 204 No Content

##### `GET /api/users/me`
Get current user profile

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "email": "user@example.com",
    "fullName": "John Doe",
    "createdAt": 1730548800,
    "settings": {
      "autoBookmark": true,
      "defaultFolder": "Reading List",
      "instapaperEnabled": true,
      "todoistEnabled": false
    }
  }
}
```

##### `PUT /api/users/me`
Update user profile and settings

**Request:**
```json
{
  "fullName": "John Doe Jr.",
  "settings": {
    "instapaperUsername": "user@example.com",
    "instapaperPassword": "password123",
    "todoistApiToken": "abc123token",
    "autoBookmark": true,
    "defaultFolder": "Work"
  }
}
```

##### `PUT /api/users/me/password`
Change password

**Request:**
```json
{
  "currentPassword": "OldPass123",
  "newPassword": "NewSecurePass456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Password updated successfully. Please log in again."
  }
}
```

##### `GET /api/users/me/api-keys`
List user's API keys

**Response:**
```json
{
  "success": true,
  "data": {
    "apiKeys": [
      {
        "id": "key123",
        "name": "My automation script",
        "prefix": "bkm_abc12345",
        "lastUsedAt": 1730548800,
        "expiresAt": null,
        "isActive": true,
        "createdAt": 1730548700
      }
    ]
  }
}
```

##### `POST /api/users/me/api-keys`
Create a new API key

**Request:**
```json
{
  "name": "My automation script",
  "expiresAt": 1735732800
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "apiKey": "bkm_abc123def456...",
    "keyInfo": {
      "id": "key123",
      "name": "My automation script",
      "prefix": "bkm_abc12345",
      "expiresAt": 1735732800,
      "isActive": true,
      "createdAt": 1730548800
    }
  }
}
```

**⚠️ Important:** The full API key is only returned once. Save it securely!

##### `DELETE /api/users/me/api-keys/:id`
Delete an API key

**Response:** 204 No Content

##### `POST /api/bookmarks/analyze`
Analyze a bookmark URL

**Request:**
```json
{
  "url": "https://example.com/article",
  "title": "Optional Title",
  "createTodoistTask": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://example.com/article",
    "isArticle": true,
    "contentType": "article",
    "title": "How to Build Great Software",
    "summary": "An in-depth guide to software engineering best practices...",
    "categories": ["Programming", "Software Engineering", "Best Practices"],
    "matchedCategory": "Work/Development/Best Practices",
    "instapaper": {
      "saved": true,
      "bookmarkId": 123456
    },
    "todoist": {
      "created": true,
      "taskId": "task123"
    },
    "analyzedAt": "2025-11-02T12:00:00Z"
  }
}
```

##### `GET /api/categories`
Get user's category tree

**Response:**
```json
{
  "success": true,
  "data": {
    "categoryTree": {
      "Personal": {
        "Reading_List": [],
        "Learning": {
          "Programming": [],
          "Design": []
        }
      },
      "Work": {
        "Documentation": [],
        "Projects": []
      }
    },
    "updatedAt": 1730548800
  }
}
```

##### `PUT /api/categories`
Update user's category tree

**Request (JSON):**
```json
{
  "categoryTree": {
    "Personal": {
      "Reading_List": [],
      "Tools": []
    },
    "Work": {
      "Projects": []
    }
  }
}
```

**Request (YAML string):**
```json
{
  "categoryTree": "Personal:\n  Reading_List: []\n  Tools: []\nWork:\n  Projects: []"
}
```

**Response:**
Same as GET /api/categories

## Rate Limits

- **Registration:** 3 requests per hour per IP
- **Login:** 5 requests per 15 minutes per IP
- **Bookmark analysis:** 60 requests per minute per user
- **General API:** 100 requests per minute per user

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**Status Codes:**
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid auth)
- `403` - Forbidden (registration disabled, etc.)
- `404` - Not Found
- `409` - Conflict (email already exists)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Environment Variables

### Required Secrets

```bash
JWT_SECRET          # Min 32 characters for signing JWTs
ENCRYPTION_KEY      # Exactly 32 characters for AES-256 encryption
ANTHROPIC_API_KEY   # Your Anthropic API key
```

### Configuration Variables

```toml
CORS_ALLOWED_ORIGINS = "chrome-extension://*"  # Comma-separated origins
ENVIRONMENT = "production"                      # development/staging/production
DISABLE_REGISTRATION = "false"                  # "true" to disable signups
```

## Database Schema

See `/src/db/migrations/001_initial_schema.sql` for the complete schema.

**Tables:**
- `users` - User accounts
- `categories` - User-specific category trees
- `api_keys` - API keys for programmatic access
- `refresh_tokens` - JWT refresh tokens

## Development

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

### Local D1 Database

Wrangler provides a local D1 database for development:

```bash
npm run dev
```

Data is stored in `.wrangler/state/v3/d1/`

## Security Best Practices

1. **Keep secrets secure:** Never commit `.dev.vars` or expose secret keys
2. **Use HTTPS:** Always use HTTPS in production
3. **Rotate tokens:** Implement token rotation and expiration
4. **Rate limiting:** Monitor and adjust rate limits as needed
5. **Audit logs:** Consider adding audit logging for sensitive operations
6. **Input validation:** All inputs are validated with Zod schemas
7. **Encryption:** User credentials are encrypted at rest

## Architecture

```
Client (Extension/Bookmarklet)
    ↓
Cloudflare Workers (API)
    ↓
Cloudflare D1 (SQLite Database)
    ↓
External APIs (Claude AI, Instapaper, Todoist)
```

## License

See main project LICENSE

## Support

For issues and questions, please open an issue on GitHub.
