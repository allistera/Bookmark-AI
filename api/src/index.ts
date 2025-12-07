/**
 * Bookmark-AI Multi-User API
 * Cloudflare Workers entry point
 */

import { Env } from './types/env';
import { router } from './router';

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    return router(request, env, ctx);
  },
};
