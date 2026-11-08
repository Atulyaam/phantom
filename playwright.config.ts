import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: false,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium-extension',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: {
    command: 'npx vite preview --outDir .output/chrome-mv3 --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
