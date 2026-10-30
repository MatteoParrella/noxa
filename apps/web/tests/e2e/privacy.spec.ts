import { expect, impostaTema, TEMI, test, verificaAccessibilita } from './supporto';

// Privacy e dati (F-41, F-42, design/F-42-privacy): partecipazioni visibili (R-67),
// esportazione ed eliminazione self-service (R-64), informativa in breve (R-63).

for (const tema of TEMI) {
  test(`privacy e dati senza violazioni axe (${tema})`, async ({ page }) => {
    test.slow();
    await impostaTema(page, tema);
    for (const [percorso, titolo] of [
      ['/profilo/privacy/', 'Privacy e dati'],
      ['/profilo/privacy/scarica/', 'Scarica i tuoi dati'],
      ['/profilo/privacy/informativa/', 'Informativa in breve'],
      ['/profilo/privacy/elimina/', 'Elimina l’account'],
    ] as const) {
      await page.goto(percorso);
      await expect(page.getByRole('heading', { name: titolo, level: 1 })).toBeVisible();
      await verificaAccessibilita(page);
    }
    await page.getByRole('button', { name: 'Continua' }).click();
    await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
    await verificaAccessibilita(page, 'dialog[open]');
  });
}

test('R-67: l’interruttore delle partecipazioni si salva nel database', async ({
  page,
  supabase,
}) => {
  supabase.rispondi('profili_privati_leggi', {
    stato: 200,
    corpo: { partecipazioni_visibili: true },
  });
  await page.goto('/profilo/privacy/');
  const interruttore = page.getByRole('switch', { name: /Mostra ai tuoi amici/ });
  await expect(interruttore).toHaveAttribute('aria-checked', 'true');
  // Il database salva la scelta: la rilettura dopo il salvataggio la restituisce.
  supabase.rispondi('profili_privati_leggi', {
    stato: 200,
    corpo: { partecipazioni_visibili: false },
  });
  await interruttore.click();
  await expect(interruttore).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText('Spento: nei nuovi eventi', { exact: false })).toBeVisible();
  const salvataggio = supabase.chiamate('profili_privati').at(-1);
  expect(salvataggio?.corpo).toEqual({ partecipazioni_visibili: false });
});

test('un salvataggio non riuscito riporta l’interruttore com’era', async ({ page, supabase }) => {
  supabase.rispondi('profili_privati_leggi', {
    stato: 200,
    corpo: { partecipazioni_visibili: true },
  });
  supabase.rispondi('profili_privati', { stato: 500, corpo: { message: 'errore' } });
  await page.goto('/profilo/privacy/');
  const interruttore = page.getByRole('switch', { name: /Mostra ai tuoi amici/ });
  await expect(interruttore).toHaveAttribute('aria-checked', 'true');
  await interruttore.click();
  await expect(page.getByText('Non siamo riusciti a salvare')).toBeVisible();
  await expect(page.getByText('L’interruttore è tornato com’era: acceso.')).toBeVisible();
  await expect(interruttore).toHaveAttribute('aria-checked', 'true');
});

test('scaricare i propri dati prepara un file JSON sul dispositivo', async ({ page, supabase }) => {
  await page.goto('/profilo/privacy/scarica/');
  await page.getByRole('button', { name: 'Prepara il file' }).click();
  const link = page.getByRole('link', { name: /Scarica/ });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('download', /^noxa-dati-\d{4}-\d{2}-\d{2}\.json$/);
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
  const percorso = await download.path();
  const { readFile } = await import('node:fs/promises');
  const contenuto = JSON.parse(await readFile(percorso, 'utf8')) as { formato: string };
  expect(contenuto.formato).toBe('noxa-esportazione-1');
  expect(supabase.chiamate('esporta_miei_dati')).toHaveLength(1);
});

test('R-64: una sola esportazione all’ora, con l’ora della prossima', async ({
  page,
  supabase,
}) => {
  supabase.rispondi('esporta_miei_dati', {
    stato: 400,
    corpo: {
      code: 'NX047',
      message: 'Esportazione già richiesta nell’ultima ora.',
      details: '2026-10-30T15:30:00Z',
      hint: null,
    },
  });
  await page.goto('/profilo/privacy/scarica/');
  await page.getByRole('button', { name: 'Prepara il file' }).click();
  await expect(page.getByText('Puoi richiederlo di nuovo alle 16:30.')).toBeVisible();
});

test('eliminare l’account: due passi, password verificata dal database', async ({
  page,
  supabase,
}) => {
  await page.goto('/profilo/privacy/elimina/');
  await expect(page.getByText('Non si può annullare', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Continua' }).click();

  await page.getByRole('button', { name: 'Elimina definitivamente' }).click();
  await expect(page.getByText('Scrivi la password del tuo account.')).toBeVisible();
  expect(supabase.chiamate('elimina_account')).toHaveLength(0);

  supabase.rispondi('elimina_account', { stato: 200, corpo: { esito: 'password_errata' } });
  await page.getByRole('textbox', { name: 'Password' }).fill('sbagliata-123');
  await page.getByRole('button', { name: 'Elimina definitivamente' }).click();
  await expect(page.getByText('La password non è giusta.', { exact: false })).toBeVisible();

  supabase.rispondi('elimina_account', { stato: 200, corpo: { esito: 'eliminato' } });
  await page.getByRole('textbox', { name: 'Password' }).fill('password-giusta-1');
  await page.getByRole('button', { name: /Elimina definitivamente|Riprova a eliminare/ }).click();
  await expect(page).toHaveURL(/\/account-eliminato\/$/);
  await expect(
    page.getByRole('heading', { name: 'Il tuo account è stato eliminato' }),
  ).toBeVisible();
  expect(supabase.chiamate('elimina_account').at(-1)?.corpo).toEqual({
    password: 'password-giusta-1',
  });
  // Niente resta sul dispositivo: la sessione è chiusa.
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('noxa-sessione')))
    .toBeNull();
  await verificaAccessibilita(page);
});

test('troppi tentativi: l’eliminazione si ferma per un’ora', async ({ page, supabase }) => {
  supabase.rispondi('elimina_account', { stato: 429, corpo: { errore: 'tentativi' } });
  await page.goto('/profilo/privacy/elimina/');
  await page.getByRole('button', { name: 'Continua' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('sbagliata-123');
  await page.getByRole('button', { name: 'Elimina definitivamente' }).click();
  await expect(
    page.getByText('Troppi tentativi con una password sbagliata.', { exact: false }),
  ).toBeVisible();
});

test('senza rete non si elimina niente', async ({ page, context }) => {
  await page.goto('/profilo/privacy/elimina/');
  await page.getByRole('button', { name: 'Continua' }).click();
  await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText('Per eliminare l’account serve la rete.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Elimina definitivamente' })).toBeDisabled();
});
