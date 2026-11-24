import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', use: { baseURL: 'http://127.0.0.1:4173', trace: 'on-first-retry', channel: 'chrome', headless: true },
  webServer: { command: 'npm run build -w frontend && npm run preview -w frontend -- --host 127.0.0.1', url: 'http://127.0.0.1:4173', reuseExistingServer: true, timeout: 180_000 }
});
