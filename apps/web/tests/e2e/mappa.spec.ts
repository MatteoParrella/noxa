import { readFile } from 'node:fs/promises';
import { expect, ORIGINE_MAPPE, ORIGINE_SUPABASE, test, verificaAccessibilita } from './supporto';

const FIXTURE = new URL('./fixture/', import.meta.url);

test('la mappa si apre senza richieste a domini esterni (ADR-0016)', async ({ page, baseURL }) => {
  const pmtiles = await readFile(new URL('fixture-e2e.pmtiles', FIXTURE));
  const glifo = await readFile(new URL('glifo-0-255.pbf', FIXTURE));

  // Il bucket `mappe` è simulato: PMTiles con le richieste a intervalli (Range), glifi dalla fixture.
  await page.route(`${ORIGINE_MAPPE}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('.pmtiles')) {
      const intervallo = /bytes=(\d+)-(\d+)/.exec(route.request().headers()['range'] ?? '');
      const inizio = Number(intervallo?.[1] ?? 0);
      const fine = Math.min(Number(intervallo?.[2] ?? pmtiles.length - 1), pmtiles.length - 1);
      await route.fulfill({
        status: 206,
        headers: {
          'Content-Range': `bytes ${inizio}-${fine}/${pmtiles.length}`,
          'Content-Type': 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'Content-Range, ETag',
        },
        body: pmtiles.subarray(inizio, fine + 1),
      });
      return;
    }
    if (url.pathname.includes('/assets/fonts/')) {
      await route.fulfill({
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: glifo,
      });
      return;
    }
    await route.fulfill({ status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
  });

  const origini = new Set<string>();
  page.on('request', (richiesta) => {
    const url = new URL(richiesta.url());
    if (url.protocol.startsWith('http')) origini.add(url.origin);
  });

  await page.goto('/scopri/');
  await page.getByRole('radio', { name: 'Mappa' }).click();
  const mappa = page.getByRole('region', { name: /Mappa di Milano e Brianza/ });
  await expect(mappa).toHaveAttribute('data-stato', 'pronta', { timeout: 20_000 });
  await expect(page.getByText(/OpenStreetMap/)).toBeVisible();
  await verificaAccessibilita(page);

  // Supabase è il backend dell'app (simulato nei test): nessun altro dominio.
  const consentite = new Set([new URL(baseURL ?? '').origin, ORIGINE_MAPPE, ORIGINE_SUPABASE]);
  expect([...origini].filter((origine) => !consentite.has(origine))).toEqual([]);
});
