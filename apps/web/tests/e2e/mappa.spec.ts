import {
  expect,
  ORIGINE_MAPPE,
  ORIGINE_SUPABASE,
  simulaMappe,
  test,
  verificaAccessibilita,
} from './supporto';

test('la mappa si apre senza richieste a domini esterni (ADR-0016)', async ({ page, baseURL }) => {
  await simulaMappe(page);

  const origini = new Set<string>();
  page.on('request', (richiesta) => {
    const url = new URL(richiesta.url());
    if (url.protocol.startsWith('http')) origini.add(url.origin);
  });

  await page.goto('/scopri/');
  await page.getByRole('radio', { name: 'Mappa' }).click();
  const mappa = page.getByRole('region', { name: /Mappa degli eventi/ });
  await expect(mappa).toHaveAttribute('data-stato', 'pronta', { timeout: 20_000 });
  await expect(page.getByText(/OpenStreetMap/)).toBeVisible();
  await verificaAccessibilita(page);

  // Supabase è il backend dell'app (simulato nei test): nessun altro dominio.
  const consentite = new Set([new URL(baseURL ?? '').origin, ORIGINE_MAPPE, ORIGINE_SUPABASE]);
  expect([...origini].filter((origine) => !consentite.has(origine))).toEqual([]);
});
