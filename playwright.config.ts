import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE_URL = `http://localhost:${PORT}`;

// Software WebGL so Phaser renders in headless Chromium without a GPU.
const chromiumWebGL = {
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  },
};

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 }, ...chromiumWebGL },
    },
    {
      name: 'android',
      use: { ...devices['Pixel 7'], ...chromiumWebGL },
    },
    {
      name: 'android-landscape',
      use: { ...devices['Pixel 7 landscape'], ...chromiumWebGL },
    },
    {
      // WebKit is the closest headless stand-in for iOS Safari.
      name: 'iphone',
      use: { ...devices['iPhone 14'] },
    },
  ],

  // Build with test hooks enabled, then serve the production bundle.
  // Override with E2E_SERVER_CMD if your build script differs (e.g. build-nolog).
  webServer: {
    command:
      process.env.E2E_SERVER_CMD ??
      `VITE_E2E=1 npm run build && npx vite preview --outDir dist --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
