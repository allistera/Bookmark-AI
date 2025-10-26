# Bookmark-AI

Use AI to Automatically Sort Bookmarks

## Overview

This project contains a Cloudflare Worker that serves as the backend for the Bookmark-AI service. The worker uses Claude AI to automatically analyze bookmark URLs and extract metadata including title, summary, categories, and content type classification. For articles, it automatically generates an Instapaper URL to easily add them to your reading list. The worker is deployed automatically using GitHub Actions.

## Project Structure

```
.
├── src/
│   └── index.ts          # Main worker code
├── .github/
│   └── workflows/
│       └── deploy.yml    # GitHub Actions deployment workflow
├── wrangler.toml         # Cloudflare Worker configuration
├── package.json          # Node.js dependencies
└── tsconfig.json         # TypeScript configuration
```

## Prerequisites

- Node.js 20 or later
- npm or yarn
- A Cloudflare account
- An Anthropic API key (get one at https://console.anthropic.com/)
- Wrangler CLI (installed automatically with npm install)

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .dev.vars.example .dev.vars
   ```

   Edit `.dev.vars` and add your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=your-anthropic-api-key-here
   ```

   Get your API key from: https://console.anthropic.com/

3. Start the development server:
   ```bash
   npm run dev
   ```

4. The worker will be available at `http://localhost:8787`

## API Endpoints

### `GET /`
Welcome message and API documentation

### `GET /health`
Health check endpoint

### `POST /api/bookmarks`
Analyze a bookmark URL using Claude AI

**Request:**
```json
{
  "url": "https://example.com/article"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bookmark analyzed successfully",
  "data": {
    "url": "https://example.com/article",
    "isArticle": true,
    "contentType": "article",
    "title": "Example Article Title",
    "summary": "A brief summary of the article content.",
    "categories": ["technology", "web development"],
    "instapaperUrl": "https://www.instapaper.com/hello2?url=https%3A%2F%2Fexample.com%2Farticle&title=Example%20Article%20Title",
    "analyzedAt": "2025-10-26T08:56:01.509Z"
  }
}
```

The API uses Claude AI to:
- Determine if the URL is a web article or another type of content
- Classify the content type (article, tool, documentation, homepage, video, etc.)
- Generate a suggested title
- Create a brief summary
- Suggest relevant categories/tags
- Generate an Instapaper URL for articles (null for non-articles)

## Deployment

### Automatic Deployment

The worker is automatically deployed to Cloudflare Workers when code is pushed to the `main` branch via GitHub Actions.

### Required GitHub Secrets

Add the following secrets to your GitHub repository (Settings > Secrets and variables > Actions):

1. `CLOUDFLARE_API_TOKEN` - Your Cloudflare API token
   - Go to Cloudflare Dashboard > My Profile > API Tokens
   - Create a token with "Edit Cloudflare Workers" permissions

2. `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare Account ID
   - Found in Cloudflare Dashboard > Workers & Pages > Overview

3. `ANTHROPIC_API_KEY` - Your Anthropic API key for Claude AI
   - Get your API key from: https://console.anthropic.com/
   - This is required for the bookmark analysis feature

### Manual Deployment

To deploy manually:

```bash
npm run deploy
```

Note: You'll need to authenticate with Wrangler first:
```bash
npx wrangler login
```

## Configuration

Edit `wrangler.toml` to configure:
- Worker name
- Compatibility date
- Routes and domains
- KV namespaces
- Environment variables

## Development

The worker is written in TypeScript and uses:
- Cloudflare Workers runtime
- Wrangler for development and deployment
- TypeScript for type safety
- Anthropic's Claude AI (Claude 3.5 Sonnet) for bookmark analysis
- ESLint for code linting
- yamllint for YAML file validation

### Linting

Run linters to check code quality:
```bash
npm run lint        # Run all linters
npm run lint:js     # Run ESLint only
npm run lint:yaml   # Run yamllint only
npm run lint:fix    # Auto-fix ESLint issues
```

## License

ISC
