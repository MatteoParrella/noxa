import {
  amicizia,
  expect,
  ID_RITORNO,
  impostaTema,
  mioRitornoDiProva,
  PERSONE,
  POSIZIONE_DI_PROVA,
  ritornoAmicoDiProva,
  TEMI,
  test,
  verificaAccessibilita,
} from './supporto';

// Ritorno sicuro (F-21, design/F-21-ritorno-sicuro): avvio esplicito, da 1 a 5 amici
// confermati, posizione chiesta solo dopo "Avvia", indicatore permanente, "Sono arrivato" in un
// tocco, area di arrivo solo sul telefono, allerta calma per chi riceve (R-31, R-32, R-43).

test.beforeEach(({ supabase }) => {
  supabase.amicizie = [
    amicizia('00000000-0000-4000-8000-00000000a001', PERSONE.marco, 'accettata', 'inviata'),
    amicizia('00000000-0000-4000-8000-00000000a004', PERSONE.sara, 'accettata', 'ricevuta'),
  ];
});

for (const tema of TEMI) {
  test(`ritorno sicuro senza violazioni axe (${tema})`, async ({ page, supabase, context }) => {
    test.slow();
    await impostaTema(page, tema);
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(POSIZIONE_DI_PROVA);
    supabase.ritorniAmici = [ritornoAmicoDiProva('in_viaggio')];
    await page.goto('/vivi/');
    await expect(page.getByRole('heading', { name: 'Torni a casa?' })).toBeVisible();
    await verificaAccessibilita(page);
    await page.getByRole('button', { name: 'Avvia il ritorno sicuro' }).click();
    await expect(page.getByRole('dialog', { name: 'Avvia il ritorno sicuro' })).toBeVisible();
    await verificaAccessibilita(page, 'dialog[open]');
    await page.keyboard.press('Escape');

    supabase.mioRitorno = mioRitornoDiProva();
    await page.goto('/vivi/');
    await expect(page.getByRole('heading', { name: /Binario 7|Verso Casa/ })).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto('/vivi/ritorno/');
    await expect(page.getByRole('region', { name: /ultima posizione/ })).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto('/vivi/ritorno/chi-lo-vede/');
    await expect(page.getByRole('heading', { name: 'Chi lo vede', level: 1 })).toBeVisible();
    await verificaAccessibilita(page);

    supabase.mioRitorno = null;
    supabase.ritorniAmici = [ritornoAmicoDiProva('in_ritardo')];
    await page.goto(`/vivi/ritorno-amico/?id=${ritornoAmicoDiProva().id}`);
    await expect(page.getByText(/non ha confermato l’arrivo/)).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto('/profilo/privacy/');
    await expect(page.getByRole('heading', { name: 'Ritorno sicuro' })).toBeVisible();
    await verificaAccessibilita(page);
  });
}

test('R-31: nessuna richiesta della posizione prima di "Avvia"', async ({ page }) => {
  await page.addInitScript(() => {
    const finestra = window as unknown as { __posizioneChiesta: number };
    finestra.__posizioneChiesta = 0;
    const conta = () => {
      finestra.__posizioneChiesta++;
    };
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: conta, watchPosition: conta, clearWatch: () => undefined },
      configurable: true,
    });
  });
  await page.goto('/vivi/');
  await page.getByRole('button', { name: 'Avvia il ritorno sicuro' }).click();
  const foglio = page.getByRole('dialog', { name: 'Avvia il ritorno sicuro' });
  await foglio.getByRole('button', { name: 'Continua' }).click();
  await foglio.getByRole('button', { name: 'Continua' }).click();
  await foglio.getByRole('button', { name: 'Continua' }).click();
  await expect(foglio.getByText(/Le posizioni si cancellano 24 ore dopo/)).toBeVisible();
  // Nessun interruttore "sempre attivo" e nessun avvio automatico.
  await expect(page.getByRole('switch', { name: /ritorno/i })).toHaveCount(0);
  // Dopo "Avvia" prima la spiegazione di Noxa, poi (con "Continua") la richiesta del sistema.
  await foglio.getByRole('button', { name: 'Avvia', exact: true }).click();
  await expect(
    foglio.getByRole('heading', { name: 'La tua posizione, solo durante il ritorno' }),
  ).toBeVisible();
  await expect(foglio.getByText('24 ore dopo la fine del ritorno.')).toBeVisible();
  await foglio.getByRole('button', { name: 'Non ora' }).click();
  expect(
    await page.evaluate(
      () => (window as unknown as { __posizioneChiesta: number }).__posizioneChiesta,
    ),
  ).toBe(0);
});

test('avviare il ritorno: arrivo previsto, chi torna con te, riepilogo, spiegazione e barra', async ({
  page,
  supabase,
  context,
}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(POSIZIONE_DI_PROVA);
  await page.goto('/vivi/');
  await page.getByRole('button', { name: 'Avvia il ritorno sicuro' }).click();
  const foglio = page.getByRole('dialog', { name: 'Avvia il ritorno sicuro' });

  // 1. Arrivo previsto: "1 ora" è la scelta iniziale; si sceglie "30 min".
  await expect(foglio.getByRole('radio', { name: '1 ora', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await foglio.getByRole('radio', { name: '30 min' }).click();
  await expect(foglio.getByText(/Tra 10 minuti e 4 ore da adesso/)).toBeVisible();
  await foglio.getByRole('button', { name: 'Continua' }).click();

  // 2. Chi lo vede: chi torna con te è già spuntato, il contatore dice il limite.
  await expect(foglio.getByText('Dalla serata Sabato al Binario 7')).toBeVisible();
  await expect(foglio.getByRole('checkbox', { name: /Marco/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(foglio.getByText('Torna con te')).toBeVisible();
  await expect(foglio.getByText('1 di 5 amici selezionati')).toBeAttached();
  await foglio.getByRole('checkbox', { name: /Sara/ }).click();
  await expect(foglio.getByText('2 di 5 amici selezionati')).toBeAttached();
  await foglio.getByRole('button', { name: 'Continua' }).click();

  // 3. Area di arrivo: "Nessuna, confermo io" è la scelta predefinita.
  await expect(foglio.getByRole('radio', { name: /Nessuna, confermo io/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  // Il pallino della scelta si riempie: si vede che il tocco ha funzionato.
  const pallino = foglio.getByRole('radio', { name: /Nessuna, confermo io/ }).locator('.ck-radio');
  await expect(pallino).toHaveCSS('border-top-width', '6px');
  await foglio.getByRole('button', { name: 'Continua' }).click();

  // 4. Riepilogo in tre righe e la nota della PWA prima di "Avvia".
  await expect(
    foglio.getByText('Marco e Sara vedono dove sei fino a quando arrivi.'),
  ).toBeVisible();
  await expect(foglio.getByText(/non hai confermato, li avvisiamo/)).toBeVisible();
  // Nota della posizione a schermo bloccato: nel browser del telefono sì, da computer no.
  const notaFoglio = foglio.getByText(/la posizione si ferma quando lo blocchi/);
  if (test.info().project.name.startsWith('mobile-')) await expect(notaFoglio).toBeVisible();
  else await expect(notaFoglio).toHaveCount(0);
  await foglio.getByRole('button', { name: 'Avvia', exact: true }).click();

  // Il permesso è già concesso: niente spiegazione, il ritorno parte.
  await expect(page.getByText('Ritorno avviato: lo vedono 2 amici.')).toBeVisible();
  const avvio = supabase.chiamate('avvia_ritorno')[0]?.corpo as {
    arrivo_previsto: string;
    destinatari: string[];
  };
  expect(avvio.destinatari.sort()).toEqual([PERSONE.marco.id, PERSONE.sara.id].sort());
  const minuti = (new Date(avvio.arrivo_previsto).getTime() - Date.now()) / 60_000;
  expect(minuti).toBeGreaterThan(25);
  expect(minuti).toBeLessThan(31);
  // La prima posizione parte subito, senza area di arrivo né indirizzi (R-32).
  const posizione = supabase.chiamate('invia_posizione_ritorno')[0]?.corpo as Record<
    string,
    unknown
  >;
  expect(Object.keys(posizione).sort()).toEqual(
    ['latitudine', 'longitudine', 'precisione_m', 'ritorno'].sort(),
  );
  expect(posizione.ritorno).toBe(ID_RITORNO);

  // Indicatore permanente anche in un'altra area, con la nota della PWA.
  await page.goto('/scopri/');
  const barra = page.getByRole('status').filter({ hasText: 'Ritorno attivo', visible: true });
  await expect(barra).toBeVisible();
  const notaBarra = page.getByText(/Con lo schermo bloccato gli amici vedono dove eri/);
  if (test.info().project.name.startsWith('mobile-'))
    await expect(notaBarra.filter({ visible: true })).toBeVisible();
  else await expect(notaBarra).toHaveCount(0);
});

test('posizione negata: il ritorno non parte e si spiega come riattivarla', async ({
  page,
  supabase,
  context,
}) => {
  await context.clearPermissions();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: (_ok: unknown, errore: (e: unknown) => void) =>
          errore({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }),
        watchPosition: () => 0,
        clearWatch: () => undefined,
      },
      configurable: true,
    });
    window.localStorage.setItem('noxa-posizione-spiegata', '1');
  });
  await page.goto('/vivi/');
  await page.getByRole('button', { name: 'Avvia il ritorno sicuro' }).click();
  const foglio = page.getByRole('dialog', { name: 'Avvia il ritorno sicuro' });
  for (let i = 0; i < 3; i++) await foglio.getByRole('button', { name: 'Continua' }).click();
  await foglio.getByRole('button', { name: 'Avvia', exact: true }).click();
  await expect(foglio.getByRole('heading', { name: 'Posizione negata' })).toBeVisible();
  await expect(foglio.getByText(/Puoi sempre usare il check-in/)).toBeVisible();
  expect(supabase.chiamate('avvia_ritorno')).toHaveLength(0);
});

test('"Sono arrivato" in un tocco dalla barra, in qualsiasi area', async ({ page, supabase }) => {
  supabase.mioRitorno = mioRitornoDiProva();
  await page.goto('/ricorda/');
  const barra = page.getByRole('status').filter({ hasText: 'Ritorno attivo', visible: true });
  await barra.getByRole('button', { name: 'Sono arrivato' }).click();
  await expect(page.getByText('Gli amici sanno che sei a casa.')).toBeVisible();
  expect(supabase.chiamate('ritorni_aggiorna')[0]?.corpo).toEqual({ stato: 'arrivato' });
  await expect(page.getByRole('status').filter({ hasText: 'Ritorno attivo' })).toHaveCount(0);
});

test('proroga di 30 minuti e annullamento con una conferma leggera', async ({ page, supabase }) => {
  supabase.mioRitorno = mioRitornoDiProva();
  await page.goto('/vivi/');
  await page.getByRole('link', { name: 'Proroga' }).click();
  const foglio = page.getByRole('dialog', { name: 'Proroga l’arrivo' });
  await foglio.getByRole('radio', { name: '+30 min' }).click();
  await foglio.getByRole('button', { name: 'Proroga' }).click();
  await expect(page.getByText(/Arrivo previsto spostato alle/)).toBeVisible();
  expect(supabase.chiamate('proroga_ritorno')[0]?.corpo).toEqual({
    ritorno: ID_RITORNO,
    minuti: 30,
  });

  await page.getByRole('link', { name: 'Annulla ritorno' }).click();
  await expect(page.getByText('Gli amici sapranno che hai annullato')).toBeVisible();
  await page.getByRole('button', { name: 'Annulla ritorno' }).click();
  await expect(page).toHaveURL(/\/vivi\/$/);
  expect(supabase.chiamate('ritorni_aggiorna')[0]?.corpo).toEqual({ stato: 'annullato' });
});

test('chi lo vede: togliere l’ultima persona annulla il ritorno, e lo dice prima', async ({
  page,
  supabase,
}) => {
  supabase.mioRitorno = mioRitornoDiProva([PERSONE.marco]);
  await page.goto('/vivi/ritorno/chi-lo-vede/');
  await page.getByRole('button', { name: 'Togli Marco' }).click();
  await expect(
    page.getByText(/È l’ultima persona: se la togli, il ritorno si annulla/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Togli e annulla' }).click();
  await expect(page).toHaveURL(/\/vivi\/$/);
  expect(supabase.chiamate('ritorni_destinatari_elimina')).toHaveLength(1);
});

test('chi riceve: allerta calma, ultima posizione scritta e nessun pulsante per chiamare o scrivere', async ({
  page,
  supabase,
}) => {
  supabase.ritorniAmici = [ritornoAmicoDiProva('in_ritardo')];
  await page.goto('/vivi/');
  await page.getByRole('link', { name: 'Apri il ritorno di Sara' }).click();
  const allerta = page.getByRole('alert').filter({ hasText: 'chiama il 112' });
  await expect(allerta).toContainText('Sara non ha confermato l’arrivo delle');
  await expect(allerta).toContainText('Ultima posizione alle');
  await expect(allerta).toContainText('chiama il 112');
  await expect(page.getByText('In ritardo').first()).toBeVisible();
  await expect(page.getByText(/Nessun percorso, nessun indirizzo/)).toBeVisible();
  await expect(page.locator('a[href^="tel:"], a[href^="sms:"]')).toHaveCount(0);

  supabase.ritorniAmici = [ritornoAmicoDiProva('arrivato')];
  await page.reload();
  await expect(page.getByText(/Sara ha confermato l’arrivo alle/)).toBeVisible();
  await expect(page.getByRole('region', { name: /ultima posizione di Sara/ })).toHaveCount(0);
});

test('R-17: un ritorno non più visibile porta alle notifiche con "Non è più disponibile"', async ({
  page,
}) => {
  await page.goto('/vivi/ritorno-amico/?id=00000000-0000-4000-8000-0000000000ff');
  await expect(page).toHaveURL(/\/notifiche\//);
  await expect(page.getByText('Non è più disponibile.')).toBeVisible();
});

test('R-32: le aree di arrivo restano solo su questo telefono', async ({
  page,
  supabase,
  context,
}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(POSIZIONE_DI_PROVA);
  await page.goto('/profilo/privacy/');
  await expect(
    page.getByText('Nessuna area. Puoi sempre confermare l’arrivo a mano.'),
  ).toBeVisible();
  const prima = supabase.richieste.length;
  await page.getByRole('button', { name: 'Aggiungi area' }).click();
  const foglio = page.getByRole('dialog', { name: 'Nuova area di arrivo' });
  await foglio.getByRole('button', { name: 'Aggiungi area' }).click();
  await foglio.getByLabel('Nome').fill('Da Sara');
  await foglio.getByRole('radio', { name: '100 m' }).click();
  await foglio.getByRole('button', { name: 'Salva qui' }).click();
  await expect(page.getByText('Area Da Sara salvata su questo telefono.')).toBeVisible();
  await expect(page.getByText('raggio 100 m · solo qui')).toBeVisible();
  // Nessuna richiesta a Supabase contiene il nome o il centro dell'area.
  const nuove = supabase.richieste.slice(prima);
  expect(JSON.stringify(nuove)).not.toMatch(/Da Sara|45\.5845/);
  const salvate = await page.evaluate(() => window.localStorage.getItem('noxa-aree-arrivo'));
  expect(salvate).toContain('Da Sara');
});

test.describe('su iPhone', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });

  test('la nota dice cosa succede a schermo bloccato, senza chiedere di tenere Noxa aperta', async ({
    page,
  }) => {
    await page.goto('/vivi/');
    await page.getByRole('button', { name: 'Avvia il ritorno sicuro' }).click();
    const foglio = page.getByRole('dialog', { name: 'Avvia il ritorno sicuro' });
    for (let i = 0; i < 3; i++) await foglio.getByRole('button', { name: 'Continua' }).click();
    await expect(foglio.getByText(/la posizione si ferma quando lo blocchi/)).toBeVisible();
    await expect(foglio.getByText(/li avvisiamo comunque/)).toBeVisible();
    await expect(page.getByText(/Noxa aperta/)).toHaveCount(0);
  });
});
