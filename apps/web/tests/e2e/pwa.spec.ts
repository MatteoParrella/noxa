import { expect, test } from './supporto';

test('l’app è installabile: manifest, icone e service worker', async ({ page, request }) => {
  await page.goto('/scopri/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/manifest.webmanifest');

  const manifest = (await (await request.get('/manifest.webmanifest')).json()) as {
    lang: string;
    display: string;
    start_url: string;
    icons: Array<{ src: string; sizes: string; purpose: string }>;
  };
  expect(manifest).toMatchObject({ lang: 'it', display: 'standalone', start_url: '/scopri/' });
  expect(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable')).toBe(true);
  for (const icona of manifest.icons) expect((await request.get(icona.src)).ok()).toBe(true);

  expect((await request.get('/sw.js')).ok()).toBe(true);
  await expect
    .poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration())))
    .toBe(true);
});
