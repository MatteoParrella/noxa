import { defineConfig, devices } from '@playwright/test';

const porta = 4173;
const ci = Boolean(process.env.CI);

// I test e2e girano sull'export statico, lo stesso che va su Vercel e nelle app native.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 2 : 0,
  reporter: ci ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${porta}`,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // Build dedicata ai test: include il catalogo dei componenti e punta la mappa a un bucket
    // simulato dai test (tests/e2e/supporto.ts). La build di produzione si verifica a parte.
    command: `pnpm build && pnpm exec serve out --listen ${porta} --no-clipboard`,
    env: {
      NOXA_CATALOGO: '1',
      NEXT_PUBLIC_MAPPA_PMTILES_URL: 'http://mappe.noxa.test/mappe/milano-brianza.pmtiles',
    },
    url: `http://127.0.0.1:${porta}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
