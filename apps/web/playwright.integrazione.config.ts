import path from 'node:path';
import nextEnv from '@next/env';
import { defineConfig, devices } from '@playwright/test';

// Le chiavi di Supabase locale servono anche ai test, che chiamano l'API direttamente.
nextEnv.loadEnvConfig(path.resolve(import.meta.dirname, '../..'), false, console, true);

const porta = 4173;
const ci = Boolean(process.env.CI);

/**
 * Test e2e con Supabase locale reale (`supabase start`): registrazione, email da Mailpit,
 * controllo dell'età nel database (R-01). Le variabili NEXT_PUBLIC_SUPABASE_* arrivano dal
 * .env della radice o, in CI, da `supabase status`. Senza CAPTCHA: in locale è spento.
 */
export default defineConfig({
  testDir: './tests/e2e/integrazione',
  fullyParallel: false,
  workers: 1,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report-integrazione' }]]
    : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: `http://127.0.0.1:${porta}`,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    trace: 'on-first-retry',
  },
  webServer: {
    command: `pnpm build && pnpm exec serve out --listen ${porta} --no-clipboard`,
    env: { NEXT_PUBLIC_TURNSTILE_SITE_KEY: '' },
    url: `http://127.0.0.1:${porta}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
