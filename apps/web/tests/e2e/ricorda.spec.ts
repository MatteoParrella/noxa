import {
  diarioDiProva,
  expect,
  ID_VOCE,
  impostaTema,
  PERSONE,
  TEMI,
  test,
  verificaAccessibilita,
} from './supporto';

// Diario delle serate (F-30, design/F-30-tracker): privato, spese senza alcolici per i
// minorenni (R-40), coda offline delle scritture (F-43).

for (const tema of TEMI) {
  test(`diario, dettaglio e modulo senza violazioni axe (${tema})`, async ({ page, supabase }) => {
    test.slow();
    supabase.diario = diarioDiProva();
    await impostaTema(page, tema);
    await page.goto('/ricorda/');
    await expect(page.getByRole('link', { name: /Indie al Binario/ })).toBeVisible();
    await expect(page.getByText('Da sincronizzare')).toHaveCount(0);
    await verificaAccessibilita(page);
    await page.goto(`/ricorda/serata/?id=${ID_VOCE}`);
    await expect(page.getByRole('heading', { name: 'Indie al Binario' })).toBeVisible();
    await expect(page.getByText('Il secondo gruppo era il migliore.')).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto(`/ricorda/modifica/?id=${ID_VOCE}`);
    await expect(page.getByRole('button', { name: 'Salva' })).toBeVisible();
    await verificaAccessibilita(page);
  });
}

test('diario vuoto: invito ad annotare la prima serata', async ({ page }) => {
  await page.goto('/ricorda/');
  await expect(page.getByText('Il tuo diario è vuoto')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Aggiungi una serata' })).toBeVisible();
});

test('errore di caricamento con riprova', async ({ page, supabase }) => {
  supabase.rispondi('mio_diario', { stato: 500, corpo: { message: 'errore' } });
  await page.goto('/ricorda/');
  await expect(page.getByText('Il diario non si è caricato')).toBeVisible();
  supabase.rispondi('mio_diario', { stato: 200, corpo: diarioDiProva() });
  await page.getByRole('button', { name: /Riprova/ }).click();
  await expect(page.getByRole('link', { name: /Indie al Binario/ })).toBeVisible();
});

test('una nuova serata richiede solo la data e non è nel futuro', async ({ page, supabase }) => {
  await page.goto('/ricorda/modifica/');
  await page.getByLabel('Data').fill('');
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Manca la data')).toBeVisible();
  expect(supabase.chiamate('salva_serata_diario')).toHaveLength(0);

  await page.getByLabel('Data').fill('2099-01-01');
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('La data è nel futuro', { exact: true })).toBeVisible();
  expect(supabase.chiamate('salva_serata_diario')).toHaveLength(0);

  await page.getByLabel('Data').fill('2026-10-10');
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Serata salvata nel diario')).toBeVisible();
  const corpo = supabase.chiamate('salva_serata_diario')[0]?.corpo as {
    serata: Record<string, unknown>;
  };
  expect(corpo.serata).toMatchObject({ data_serata: '2026-10-10', spese: [], amici: [] });
  expect(corpo.serata['id']).toMatch(/^[0-9a-f-]{36}$/);
});

test('R-40: le categorie di spesa sono quelle del database, senza alcolici per i minorenni', async ({
  page,
  supabase,
}) => {
  await page.goto('/ricorda/modifica/');
  const spese = page.getByRole('group', { name: 'Aggiungi una spesa' });
  await expect(spese.getByRole('button', { name: 'Ingresso' })).toBeVisible();
  await expect(spese.getByRole('button')).toHaveCount(7);
  await expect(page.getByText('Alcolici')).toHaveCount(0);
  expect(supabase.chiamate('categorie_spesa_disponibili')).toHaveLength(1);
});

test.describe('maggiorenne', () => {
  test.use({
    account: {
      username: 'luca.ferri',
      nome_visualizzato: 'Luca',
      stato_account: 'attivo',
      minorenne: false,
      onboarding_completato: true,
      documenti_da_accettare: [],
    },
  });

  test('vede la categoria alcolici che il database gli concede', async ({ page }) => {
    await page.goto('/ricorda/modifica/');
    const spese = page.getByRole('group', { name: 'Aggiungi una spesa' });
    await expect(spese.getByRole('button', { name: 'Alcolici' })).toBeVisible();
  });
});

test('un evento non più visibile si segnala sul campo', async ({ page, supabase }) => {
  supabase.diario = diarioDiProva();
  supabase.rispondi('salva_serata_diario', {
    stato: 403,
    corpo: { code: '42501', message: 'Evento non disponibile.', details: null, hint: null },
  });
  await page.goto(`/ricorda/modifica/?id=${ID_VOCE}`);
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Non siamo riusciti a salvare').first()).toBeVisible();
});

test('eliminare una serata chiede conferma', async ({ page, supabase }) => {
  supabase.diario = diarioDiProva();
  await page.goto(`/ricorda/serata/?id=${ID_VOCE}`);
  await page.getByRole('button', { name: 'Azioni sulla serata' }).click();
  await page.getByRole('menuitem', { name: 'Elimina' }).click();
  await expect(page.getByText('Eliminare questa serata dal diario?')).toBeVisible();
  supabase.diario = diarioDiProva().slice(1);
  await page.getByRole('button', { name: 'Elimina', exact: true }).click();
  await expect(page).toHaveURL(/\/ricorda\/$/);
  expect(supabase.chiamate('serate_tracker_elimina')).toHaveLength(1);
  await expect(page.getByRole('link', { name: /Indie al Binario/ })).toHaveCount(0);
});

test('senza rete la serata resta sul telefono e parte al ritorno della connessione', async ({
  page,
  context,
  supabase,
}) => {
  // L'installazione del service worker è lenta quando girano altri test in parallelo.
  test.slow();
  await page.goto('/ricorda/modifica/');
  await expect(page.getByRole('button', { name: 'Salva' })).toBeVisible();
  // Come nell'app installata: le pagine arrivano dal service worker anche senza rete.
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {
      timeout: 30_000,
    })
    .toBe(true);
  await context.setOffline(true);
  await page.getByLabel('Data').fill('2026-10-10');
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Salvata sul telefono')).toBeVisible();
  expect(supabase.chiamate('salva_serata_diario')).toHaveLength(0);

  await page.getByRole('link', { name: 'Torna al diario' }).click();
  await expect(page.getByText('Da sincronizzare')).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText('Una serata del diario è stata sincronizzata')).toBeVisible();
  expect(supabase.chiamate('salva_serata_diario')).toHaveLength(1);
});

test('gli amici indicati sono solo amici confermati', async ({ page, supabase }) => {
  await page.goto('/ricorda/modifica/');
  await page.getByRole('checkbox', { name: /Marco/ }).click();
  await page.getByLabel('Data').fill('2026-10-10');
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Serata salvata nel diario')).toBeVisible();
  const corpo = supabase.chiamate('salva_serata_diario')[0]?.corpo as {
    serata: { amici: string[] };
  };
  expect(corpo.serata.amici).toEqual([PERSONE.marco.id]);
});
