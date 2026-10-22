import {
  ACCOUNT_DI_PROVA,
  expect,
  impostaTema,
  PERSONE,
  TEMI,
  test,
  verificaAccessibilita,
} from './supporto';

// Amici, codice invito, profili, segnala e blocca (F-11, F-12, F-42, design/F-11-amici).

const persona = (id: string) => `/persona/?id=${id}`;

for (const tema of TEMI) {
  test(`profilo, amici, ricerca, codice, bloccati e segnalazioni senza violazioni axe (${tema})`, async ({
    page,
  }) => {
    test.slow();
    await impostaTema(page, tema);
    await page.goto('/profilo/');
    await expect(page.getByText('@giulia.rota')).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto('/amici/');
    await expect(page.getByRole('heading', { name: 'Richieste' })).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto('/amici/cerca/');
    await page.getByRole('searchbox', { name: 'Username' }).fill('mar');
    await expect(page.getByText('@sara.colombo')).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto('/amici/codice/');
    await expect(page.getByText('K7Q4-M2XP-9H')).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto('/profilo/bloccati/');
    await expect(page.getByText('@sara.colombo')).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto('/profilo/segnalazioni/');
    await expect(page.getByText('Profilo @utente.anonimo')).toBeVisible();
    await verificaAccessibilita(page);
  });

  test(`anteprima del codice con l’avviso e profilo con il menu ⋯ senza violazioni axe (${tema})`, async ({
    page,
    supabase,
  }) => {
    await impostaTema(page, tema);
    supabase.rispondi('anteprima_codice_invito', {
      stato: 200,
      corpo: [
        {
          stato: 'valido',
          titolare_id: PERSONE.sara.id,
          username: 'sara.colombo',
          nome_visualizzato: 'Sara',
          avviso_fasce: true,
        },
      ],
    });
    await page.goto('/amici/invito/?c=K7Q4M2XP9H');
    await expect(page.getByRole('alert').filter({ hasText: 'Persona maggiorenne' })).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto(persona(PERSONE.marco.id));
    await page.getByRole('button', { name: 'Altre azioni per @marco.brivio' }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await verificaAccessibilita(page);
  });
}

test('il profilo mostra il contatore delle richieste e porta agli amici', async ({ page }) => {
  await page.goto('/profilo/');
  await expect(page.getByRole('link', { name: /Amici/ })).toContainText('1');
  await page.getByRole('link', { name: /Amici/ }).click();
  await expect(page).toHaveURL(/\/amici\/$/);
  // Nessun numero di amici, nessun suggerimento (design/F-11-amici).
  await expect(page.getByText(/persone che potresti conoscere/i)).toHaveCount(0);
});

test('accettare e rifiutare una richiesta dalla ricerca', async ({ page, supabase }) => {
  supabase.amicizie = [
    {
      id: '00000000-0000-4000-8000-00000000a010',
      stato: 'in_attesa',
      canale: 'ricerca',
      creata_il: '2026-10-16T10:00:00Z',
      richiedente_id: PERSONE.sara.id,
      destinatario_id: '00000000-0000-4000-8000-0000000000e2',
      richiedente: PERSONE.sara,
      destinatario: {
        id: '00000000-0000-4000-8000-0000000000e2',
        username: 'giulia.rota',
        nome_visualizzato: 'Giulia',
        avatar_path: null,
        avatar_nascosto: false,
      },
    },
  ];
  await page.goto('/amici/');
  await page.getByRole('button', { name: 'Accetta' }).click();
  await expect.poll(() => supabase.chiamate('amicizie_aggiorna').length).toBe(1);
  expect(supabase.chiamate('amicizie_aggiorna')[0]?.corpo).toEqual({ stato: 'accettata' });
  await page.getByRole('button', { name: 'Rifiuta' }).click();
  await expect.poll(() => supabase.chiamate('amicizie_elimina').length).toBe(1);
});

test('una richiesta arrivata con il codice si decide dal profilo', async ({ page }) => {
  await page.goto('/amici/');
  await expect(page.getByText('Richiesta arrivata con il tuo codice')).toBeVisible();
  await page.getByRole('link', { name: 'Vedi il profilo' }).click();
  await expect(page).toHaveURL(new RegExp(`/persona/\\?id=${PERSONE.davide.id}`));
  await expect(page.getByText('Vuole aggiungerti agli amici.')).toBeVisible();
});

test.describe('chi ha 14–17 anni e riceve la richiesta di un adulto (R-12)', () => {
  test.use({ account: { ...ACCOUNT_DI_PROVA, minorenne: true } });

  test('vede l’avviso prima di accettare', async ({ page, supabase }) => {
    supabase.rispondi('avviso_richiesta', { stato: 200, corpo: true });
    await page.goto(persona(PERSONE.davide.id));
    await expect(page.getByText('Stai aggiungendo una persona maggiorenne')).toBeVisible();
    // Accetta e Rifiuta hanno lo stesso peso visivo.
    await expect(page.getByRole('button', { name: 'Accetta' })).toHaveClass(/btn-secondario/);
    await expect(page.getByRole('button', { name: 'Rifiuta' })).toHaveClass(/btn-secondario/);
    await page.getByRole('button', { name: 'Accetta' }).click();
    await expect.poll(() => supabase.chiamate('amicizie_aggiorna').length).toBe(1);
  });
});

test('ricerca: almeno 3 lettere, Aggiungi invia la richiesta, il limite si spiega', async ({
  page,
  supabase,
}) => {
  await page.goto('/amici/cerca/');
  const campo = page.getByRole('searchbox', { name: 'Username' });
  await campo.fill('ma');
  await expect(page.getByText('Scrivi almeno 3 lettere.')).toBeVisible();
  expect(supabase.chiamate('cerca_utenti')).toHaveLength(0);
  await campo.fill('@mar');
  await expect(page.getByText('@sara.colombo')).toBeVisible();
  expect(supabase.chiamate('cerca_utenti').at(-1)?.corpo).toEqual({ testo: 'mar' });
  await expect(page.getByText('Trovi solo persone della tua fascia d’età.')).toBeVisible();

  supabase.rispondi('amicizie_crea', {
    stato: 400,
    corpo: { code: 'NX008', message: 'Troppe richieste', details: null, hint: null },
  });
  await page.getByRole('button', { name: 'Aggiungi' }).click();
  await expect(page.getByText('Hai inviato molte richieste oggi')).toBeVisible();
  expect(supabase.chiamate('amicizie_crea')[0]?.corpo).toMatchObject({
    destinatario_id: PERSONE.sara.id,
    canale: 'ricerca',
  });
});

test('ricerca senza risultati propone il codice', async ({ page, supabase }) => {
  supabase.rispondi('cerca_utenti', { stato: 200, corpo: [] });
  await page.goto('/amici/cerca/');
  await page.getByRole('searchbox', { name: 'Username' }).fill('zzzz');
  await expect(page.getByText('Nessuno con questo username nella tua fascia')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Il mio codice' }).last()).toBeVisible();
});

test('il mio codice: QR con alternativa scritta, scadenza e limite giornaliero', async ({
  page,
  supabase,
}) => {
  await page.goto('/amici/codice/');
  await expect(
    page.getByRole('img', { name: 'Codice QR. Il codice scritto è sotto.' }),
  ).toBeVisible();
  await expect(page.getByText('K7Q4-M2XP-9H')).toBeVisible();
  await expect(page.getByText(/Valido ancora 1[45] min/)).toBeVisible();

  supabase.rispondi('crea_codice_invito', {
    stato: 200,
    corpo: [{ codice: 'K7Q4M2XP9H', scade_il: new Date(Date.now() - 60_000).toISOString() }],
  });
  await page.getByRole('button', { name: 'Nuovo codice' }).click();
  await expect(page.getByText('Questo codice è scaduto')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Condividi link' })).toBeDisabled();

  supabase.rispondi('crea_codice_invito', {
    stato: 400,
    corpo: { code: 'NX010', message: 'Troppi codici', details: null, hint: null },
  });
  await page.getByRole('button', { name: 'Nuovo codice' }).click();
  await expect(page.getByText('Hai creato 10 codici oggi')).toBeVisible();
});

test('scansiona: il codice scritto a mano apre l’anteprima', async ({ page }) => {
  await page.goto('/amici/scansiona/');
  await page.getByLabel('Scrivi il codice').fill('k7q4-m2xp-9h');
  await page.getByRole('button', { name: 'Continua' }).click();
  await expect(page).toHaveURL(/\/amici\/invito\/\?c=K7Q4M2XP9H$/);
  await expect(page.getByText('@sara.colombo')).toBeVisible();
});

test('anteprima: invia la richiesta e gli stati del codice', async ({ page, supabase }) => {
  await page.goto('/amici/invito/?c=K7Q4M2XP9H');
  await expect(page.getByText('Persona maggiorenne')).toHaveCount(0);
  await page.getByRole('button', { name: 'Invia richiesta' }).click();
  await expect(
    page.getByText('Richiesta inviata. Diventerete amici quando la accetta.'),
  ).toBeVisible();
  expect(supabase.chiamate('usa_codice_invito')[0]?.corpo).toEqual({ codice: 'K7Q4M2XP9H' });

  for (const [stato, testo] of [
    ['scaduto', 'Codice scaduto'],
    ['usato', 'Codice già usato'],
    ['non_valido', 'Codice non valido'],
  ] as const) {
    supabase.rispondi('anteprima_codice_invito', {
      stato: 200,
      corpo: [
        { stato, titolare_id: null, username: null, nome_visualizzato: null, avviso_fasce: false },
      ],
    });
    await page.goto('/amici/invito/?c=K7Q4M2XP9H');
    await expect(page.getByText(testo)).toBeVisible();
  }
});

test('profilo non disponibile: stesso messaggio per ogni motivo', async ({ page, supabase }) => {
  supabase.profiliVisibili = [];
  await page.goto(persona(PERSONE.sara.id));
  await expect(page.getByText('Questo profilo non si può vedere.')).toBeVisible();
  await page.goto('/persona/?id=non-un-uuid');
  await expect(page.getByText('Questo profilo non si può vedere.')).toBeVisible();
});

test('menu ⋯: si usa da tastiera e si chiude con Esc', async ({ page }) => {
  await page.goto(persona(PERSONE.marco.id));
  const apri = page.getByRole('button', { name: 'Altre azioni per @marco.brivio' });
  await apri.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Rimuovi dall’elenco' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Segnala' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(apri).toBeFocused();
});

test('segnala in due tocchi; il rischio per un minorenne ricorda il 112 (R-50, R-53)', async ({
  page,
  supabase,
}) => {
  await page.goto(persona(PERSONE.marco.id));
  await page.getByRole('button', { name: 'Altre azioni per @marco.brivio' }).click();
  await page.getByRole('menuitem', { name: 'Segnala' }).click();
  const foglio = page.getByRole('dialog', { name: 'Segnala @marco.brivio' });
  await expect(foglio.getByLabel('Blocca anche questa persona')).not.toBeChecked();
  await foglio.getByLabel(/Vuoi aggiungere qualcosa/).fill('Mi scrive di continuo.');
  await foglio
    .getByRole('button', { name: 'Mi sembra che metta a rischio una persona minorenne' })
    .click();
  await expect(page.getByRole('dialog', { name: 'Lo guardiamo entro 4 ore' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Chiama il 112' })).toHaveAttribute(
    'href',
    'tel:112',
  );
  expect(supabase.chiamate('segnalazioni_crea')[0]?.corpo).toEqual({
    segnalante_id: '00000000-0000-4000-8000-0000000000e2',
    tipo_oggetto: 'profilo',
    oggetto_id: PERSONE.marco.id,
    motivo: 'adescamento_o_rischio_minore',
    dettagli: 'Mi scrive di continuo.',
  });
  expect(supabase.chiamate('blocchi_crea')).toHaveLength(0);
});

test('blocca con conferma e "Annulla" nel toast (R-17)', async ({ page, supabase }) => {
  await page.goto('/amici/');
  await page.getByRole('button', { name: 'Altre azioni per @marco.brivio' }).click();
  await page.getByRole('menuitem', { name: 'Blocca' }).click();
  const foglio = page.getByRole('dialog', { name: 'Bloccare @marco.brivio?' });
  await expect(foglio.getByText('Non riceverà nessun avviso.')).toBeVisible();
  await foglio.getByRole('button', { name: 'Blocca' }).click();
  const toast = page.getByRole('status').filter({ hasText: 'Persona bloccata' });
  await expect(toast).toBeVisible();
  expect(supabase.chiamate('blocchi_crea')[0]?.corpo).toEqual({
    bloccante_id: '00000000-0000-4000-8000-0000000000e2',
    bloccato_id: PERSONE.marco.id,
  });
  await toast.getByRole('button', { name: 'Annulla' }).click();
  await expect.poll(() => supabase.chiamate('blocchi_elimina').length).toBe(1);
});

test('persone bloccate: sbloccare chiede conferma', async ({ page, supabase }) => {
  await page.goto('/profilo/bloccati/');
  await page.getByRole('button', { name: 'Sblocca' }).click();
  const foglio = page.getByRole('dialog', { name: 'Sbloccare @sara.colombo?' });
  await expect(foglio.getByText('Non tornerete amici da soli.')).toBeVisible();
  await foglio.getByRole('button', { name: 'Sblocca' }).click();
  await expect.poll(() => supabase.chiamate('blocchi_elimina').length).toBe(1);
});

test('le mie segnalazioni mostrano stato e decisione motivata', async ({ page }) => {
  await page.goto('/profilo/segnalazioni/');
  await expect(page.getByText('In lavorazione')).toBeVisible();
  await expect(page.getByText('Chiusa')).toBeVisible();
  await expect(
    page.getByText('Abbiamo controllato: il profilo non viola i Termini.'),
  ).toBeVisible();
  await expect(page.getByText('Decisione presa da una persona del team')).toBeVisible();
});

test('modifica: lo username già in uso si spiega sul campo', async ({ page, supabase }) => {
  supabase.rispondi('profili_aggiorna', {
    stato: 409,
    corpo: { code: '23505', message: 'duplicate key', details: null, hint: null },
  });
  await page.goto('/profilo/modifica/');
  await page.getByLabel('Username').fill('marco.brivio');
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Questo username è già in uso: provane un altro.')).toBeVisible();
});

test('stati vuoti di amici, bloccati e segnalazioni', async ({ page, supabase }) => {
  supabase.amicizie = [];
  supabase.rispondi('miei_bloccati', { stato: 200, corpo: [] });
  supabase.rispondi('mie_segnalazioni', { stato: 200, corpo: [] });
  await page.goto('/amici/');
  await expect(page.getByText('Non hai ancora amici su Noxa')).toBeVisible();
  await page.goto('/profilo/bloccati/');
  await expect(page.getByText('Non hai bloccato nessuno.')).toBeVisible();
  await page.goto('/profilo/segnalazioni/');
  await expect(page.getByText('Non hai fatto segnalazioni.')).toBeVisible();
});

test('errore di caricamento degli amici con "Riprova"', async ({ page, supabase }) => {
  supabase.rispondi('amicizie_leggi', { stato: 500, corpo: { message: 'errore' } });
  await page.goto('/amici/');
  await expect(page.getByText('L’elenco non si è caricato')).toBeVisible();
  supabase.rispondi('amicizie_leggi', { stato: 200, corpo: [] });
  await page.getByRole('button', { name: 'Riprova' }).click();
  await expect(page.getByText('Non hai ancora amici su Noxa')).toBeVisible();
});
