import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// The web app is served by `vite preview` (port and /api proxy set in apps/web/vite.config.mts, block 02).
const baseURL = process.env['BASE_URL'] || 'http://localhost:4300';
const apiPort = process.env['API_PORT'] || '3454';

/**
 * See https://playwright.dev/docs/test-configuration.
 * Every spec duplicates the demo project in beforeEach (POST /api/projects/:id/duplicate) and works on the copy.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npx nx serve api',
      url: `http://localhost:${apiPort}/api/health`,
      reuseExistingServer: !process.env['CI'],
      cwd: workspaceRoot,
      timeout: 180_000,
    },
    {
      command: 'npx nx run web:preview',
      url: baseURL,
      reuseExistingServer: !process.env['CI'],
      cwd: workspaceRoot,
      timeout: 180_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
