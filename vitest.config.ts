import { defineConfig } from 'vitest/config'
import { cloudflareTest } from '@cloudflare/vitest-pool-workers'

// Tests run in real workerd (not a Node approximation) so HTMLRewriter and the
// CPU characteristics are the ones that matter. Backend is `replay` by default:
// a contributor must be able to clone, `npm test`, and get a green run with no
// API key and no cost (AGENTS.md §8).
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.test.jsonc' },
      miniflare: {
        bindings: { DECISION_BACKEND: 'replay' },
      },
    }),
  ],
})
