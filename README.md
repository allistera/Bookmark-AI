# Bookmark-AI

Use AI to Automatically Sort Bookmarks

## Overview

This project contains a Cloudflare Worker that serves as the backend for the Bookmark-AI service. The worker is deployed automatically using GitHub Actions.

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
- Wrangler CLI (installed automatically with npm install)

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. The worker will be available at `http://localhost:8787`

## API Endpoints

- `GET /` - Welcome message and API documentation
- `GET /health` - Health check endpoint
- `GET /api/bookmarks` - Bookmark API (coming soon)

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

## License

ISC
