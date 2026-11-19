import {
  CATALOGO_BADGE_DI_PROVA,
  diarioDiProva,
  expect,
  impostaTema,
  RIEPILOGO_DI_PROVA,
  STATISTICHE_DI_PROVA,
  TEMI,
  test,
  verificaAccessibilita,
} from './supporto';

// Statistiche (F-31), badge (F-32) e riepilogo annuale (F-33): solo per te, nessun confronto
// né spesa in evidenza (R-43), amici solo contati (R-42).

const OTTENUTO = { badge_codice: 'prima_pagina', ottenuto_il: '2026-01-17T05:00:00Z' };

for (const tema of TEMI) {
  test(`statistiche, badge e riepilogo senza violazioni axe (${tema})`, async ({
    page,
    supabase,
  }) => {
    test.slow();
    supabase.diario = diarioDiProva();
    supabase.statistiche = STATISTICHE_DI_PROVA;
    supabase.mieiBadge = [OTTENUTO];
    supabase.riepiloghi = [RIEPILOGO_DI_PROVA];
    await impostaTema(page, tema);
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await page.goto('/ricorda/statistiche/');
    await expect(page.getByRole('link', { name: 'Statistiche' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByText('Binario 7')).toBeVisible();
    await page.getByRole('button', { name: /Spese/ }).click();
    await expect(page.getByText('€ 214,60')).toBeVisible();
    await verificaAccessibilita(page);

    await page.goto('/ricorda/badge/');
    await expect(
      page.getByRole('button', { name: /Prima pagina, ottenuto il 17 gennaio 2026/ }),
    ).toBeVisible();
    await verificaAccessibilita(page);
    await page.getByRole('button', { name: 'Cronista, da ottenere' }).click();
    const foglio = page.getByRole('dialog', { name: 'Cronista' });
    await expect(foglio.getByText('10 serate con le note')).toBeVisible();
    await verificaAccessibilita(page);

    await page.goto('/ricorda/wrapped/?anno=2026');
    await expect(page.getByRole('img', { name: /Il tuo 2026 di notte/ })).toBeVisible();
    await verificaAccessibilita(page);
  });
}

test('statistiche: periodi, grafico come elenco e spese chiuse di default', async ({
  page,
  supabase,
}) => {
  // WebKit è lento quando girano molti test insieme.
  test.slow();
  supabase.diario = diarioDiProva();
  supabase.statistiche = STATISTICHE_DI_PROVA;
  await page.goto('/ricorda/statistiche/');
  await expect(page.getByRole('img', { name: /Settembre: 4 serate/ })).toBeVisible();
  await expect(page.getByText('€ 214,60')).toBeHidden();
  await expect(page.getByRole('button', { name: /Spese/ })).toHaveAttribute(
    'aria-expanded',
    'false',
  );

  await page.getByRole('button', { name: 'Vedi come elenco' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Settembre' })).toBeVisible();

  await page.getByRole('radio', { name: 'Sempre' }).click();
  await expect
    .poll(() => supabase.chiamate('mie_statistiche').map((c) => JSON.stringify(c.corpo)))
    .toContain('{}');
  await page.getByRole('radio', { name: 'Anno scorso' }).click();
  await expect
    .poll(() =>
      supabase.chiamate('mie_statistiche').some((c) => {
        const anno = (c.corpo as { anno?: number } | null)?.anno;
        return typeof anno === 'number' && anno === new Date().getFullYear() - 1;
      }),
    )
    .toBe(true);
});

test('statistiche con il diario vuoto: invito ad annotare', async ({ page }) => {
  await page.goto('/ricorda/statistiche/');
  await expect(page.getByText('Ancora nessuna statistica')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Aggiungi una serata' })).toBeVisible();
});

test('statistiche: errore con riprova', async ({ page, supabase }) => {
  test.slow();
  supabase.diario = diarioDiProva();
  supabase.rispondi('mie_statistiche', { stato: 500, corpo: { message: 'errore' } });
  await page.goto('/ricorda/statistiche/');
  await expect(page.getByText('Le statistiche non si sono caricate')).toBeVisible();
  supabase.rispondi('mie_statistiche', { stato: 200, corpo: STATISTICHE_DI_PROVA });
  await page.getByRole('button', { name: /Riprova/ }).click();
  await expect(page.getByText('Binario 7')).toBeVisible();
});

test('badge: nessuna percentuale, nessun pulsante per condividere, riga nel profilo', async ({
  page,
  supabase,
}) => {
  supabase.mieiBadge = [OTTENUTO];
  await page.goto('/ricorda/badge/?badge=prima_pagina');
  const foglio = page.getByRole('dialog', { name: 'Prima pagina' });
  await expect(foglio.getByText('17.01.2026')).toBeVisible();
  await expect(foglio.getByRole('button', { name: /condividi/i })).toHaveCount(0);
  await expect(page.getByText(/%|ti manca/i)).toHaveCount(0);
  await expect(page.getByText(`1 di ${CATALOGO_BADGE_DI_PROVA.length}`)).toBeVisible();

  await page.goto('/profilo/');
  await expect(page.getByRole('link', { name: /I tuoi badge · 1/ })).toBeVisible();
});

test('badge: nessuno ancora', async ({ page }) => {
  await page.goto('/ricorda/badge/');
  await expect(page.getByText('Ancora nessun badge')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Esploratore II, da ottenere' })).toBeVisible();
});

test('riepilogo: avanti, pausa, immagine salvata sul telefono, Esc chiude', async ({
  page,
  supabase,
}) => {
  supabase.riepiloghi = [RIEPILOGO_DI_PROVA];
  supabase.mieiBadge = [OTTENUTO];
  await page.goto('/ricorda/wrapped/?anno=2026');
  await page.getByRole('button', { name: 'Pausa' }).click();
  await expect(page.getByRole('button', { name: 'Riprendi' })).toBeVisible();
  await expect(page.getByText(/In pausa · 1 di 8/)).toBeVisible();

  await page.getByRole('button', { name: 'Scheda successiva' }).click();
  await expect(page.getByRole('img', { name: /Hai annotato 16 serate/ })).toBeVisible();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Scheda successiva' }).click();
  // R-42: gli amici sono solo numeri.
  await expect(
    page.getByRole('img', { name: '11 serate in compagnia, con 7 amici diversi.' }),
  ).toBeVisible();

  const scaricamento = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Salva immagine' }).click();
  expect((await scaricamento).suggestedFilename()).toBe('noxa-2026-compagnia.png');

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/ricorda\/$/);
});

test('riepilogo con il movimento ridotto: niente avanzamento automatico', async ({
  page,
  supabase,
}) => {
  supabase.riepiloghi = [RIEPILOGO_DI_PROVA];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/ricorda/wrapped/?anno=2026');
  await expect(page.getByRole('button', { name: 'Pausa' })).toHaveCount(0);
  await page.waitForTimeout(6500);
  await expect(page.getByText('1 di 8')).toBeVisible();
  await page.getByRole('button', { name: 'Scheda successiva' }).click();
  await expect(page.getByText('2 di 8')).toBeVisible();
});

test('riepilogo assente e elenco degli anni', async ({ page, supabase }) => {
  await page.goto('/ricorda/wrapped/?anno=2025');
  await expect(page.getByText('Questo riepilogo non c’è')).toBeVisible();
  supabase.riepiloghi = [RIEPILOGO_DI_PROVA];
  await page.goto('/ricorda/riepiloghi/');
  await expect(page.getByRole('link', { name: /2026.*16 serate · 7 locali/ })).toBeVisible();
});
