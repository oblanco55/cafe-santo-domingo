import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: "npm run build && npm start",
    url: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    reuseExistingServer: true,
    // Cuenta admin de los E2E de /admin (tests/e2e/admin-monetizacion.spec.ts).
    env: { ADMIN_EMAILS: process.env.ADMIN_EMAILS ?? 'e2e.admin@example.test' },
    timeout: 300 * 1000,
  },
});
