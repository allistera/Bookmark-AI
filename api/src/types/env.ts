/**
 * Cloudflare Workers environment bindings and variables
 */
export interface Env {
  // D1 Database binding
  DB: D1Database;

  // Secrets
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  ANTHROPIC_API_KEY: string;

  // Variables
  CORS_ALLOWED_ORIGINS: string;
  ENVIRONMENT: 'development' | 'staging' | 'production';
  DISABLE_REGISTRATION: string; // 'true' | 'false'
}
