import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 1,
  reporter: 'list',
  outputDir: 'test-results',

  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    cwd: 'd:\\QueryArena\\client',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
