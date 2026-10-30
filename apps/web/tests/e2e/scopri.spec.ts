import {
  DETTAGLIO_DI_PROVA,
  EVENTI_DI_PROVA,
  eventoDiProva,
  expect,
  impostaTema,
  LOCALI_DI_PROVA,
  ORIGINE_SUPABASE,
  PIXEL_PNG,
  serataDiProva,
  simulaMappe,
  TEMI,
  test,
  verificaAccessibilita,
  type SupabaseSimulato,
} from './supporto';
import type { Page } from '@playwright/test';

// Scopri, mappa e dettaglio evento (F-01…F-05, design/F-01-scopri).

const EVENTO = '/evento/?id=00000000-0000-4000-8000-00000000e001';

/** Foto del locale firmata dallo storage simulato (ADR-0018). */
async function simulaFoto(pagina: Page, supabase: SupabaseSimulato) {
  supabase.rispondi('firma_immagini', {
    stato: 200,
    corpo: [
      {
        path: '00000000-0000-4000-8000-00000000c001.webp',
        signedURL: '/object/sign/immagini-locali/00000000-0000-4000-8000-00000000c001.webp?token=t',
        error: null,
      },
    ],
  });
  await pagina.route(`${ORIGINE_SUPABASE}/storage/v1/object/sign/immagini-locali/**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: PIXEL_PNG,
    }),
  );
}

/** Ultimo corpo inviato a cerca_eventi. */
function ultimaRicerca(supabase: SupabaseSimulato) {
  return supabase.chiamate('cerca_eventi').at(-1)?.corpo as Record<string, unknown>;
}

for (const tema of TEMI) {
  test(`elenco, filtri, calendario e mappa senza violazioni axe (${tema})`, async ({
    page,
    supabase,
  }) => {
    test.slow();
    await impostaTema(page, tema);
    await simulaFoto(page, supabase);
    await simulaMappe(page);
    await page.goto('/scopri/');
    await expect(page.getByRole('link', { name: /Notte Ferrovia, Club Binario 7/ })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Foto di Club Binario 7' })).toBeVisible();
    await verificaAccessibilita(page);

    await page.getByRole('button', { name: 'Filtri' }).click();
    await expect(page.getByRole('dialog', { name: 'Filtri' })).toBeVisible();
    await page.getByRole('radio', { name: 'Scegli un comune' }).check();
    await page.getByLabel('Comune', { exact: true }).fill('Mo');
    await expect(page.getByRole('button', { name: 'Monza' })).toBeVisible();
    await verificaAccessibilita(page);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Scegli data' }).click();
    await expect(page.getByRole('dialog', { name: 'Scegli una data' })).toBeVisible();
    await verificaAccessibilita(page);
    await page.keyboard.press('Escape');

    await page.getByRole('radio', { name: 'Mappa' }).click();
    await expect(page.getByRole('region', { name: /Mappa degli eventi/ })).toHaveAttribute(
      'data-stato',
      'pronta',
      { timeout: 20_000 },
    );
    const segnaposto = page.getByRole('button', { name: 'Sala Ventuno, 1 evento' });
    await expect(segnaposto).toBeVisible();
    await segnaposto.click();
    await expect(page.getByRole('region', { name: 'Anteprima: Sala Ventuno' })).toBeVisible();
    await verificaAccessibilita(page);
  });

  test(`dettaglio con foto, amici, menu ⋯ e stati senza violazioni axe (${tema})`, async ({
    page,
    supabase,
  }) => {
    test.slow();
    await impostaTema(page, tema);
    await simulaFoto(page, supabase);
    await page.goto(EVENTO);
    await expect(page.getByRole('heading', { level: 1, name: 'Notte Ferrovia' })).toBeVisible();
    await expect(page.getByText('Foto: Laura Bassi, CC BY 4.0')).toBeVisible();
    await verificaAccessibilita(page);

    await page.getByRole('button', { name: 'Marco e Sara ci vanno' }).click();
    await expect(page.getByRole('dialog', { name: 'Amici a questo evento' })).toBeVisible();
    await verificaAccessibilita(page);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Altre azioni per Notte Ferrovia' }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await verificaAccessibilita(page);
    await page.getByRole('menuitem', { name: 'Segnala' }).click();
    await expect(page.getByRole('dialog', { name: 'Segnala l’evento' })).toBeVisible();
    await verificaAccessibilita(page);
    await page.keyboard.press('Escape');

    supabase.rispondi('dettaglio_evento', {
      stato: 200,
      corpo: [
        {
          ...DETTAGLIO_DI_PROVA,
          stato: 'annullato',
          eta_minima_dichiarata: false,
          copertina_tipo: 'tipografica',
          copertina_path: null,
        },
      ],
    });
    await page.reload();
    await expect(page.getByText('Il locale ha annullato l’evento')).toBeVisible();
    await expect(page.getByText('Età non dichiarata')).toBeVisible();
    await verificaAccessibilita(page);

    supabase.rispondi('dettaglio_evento', { stato: 200, corpo: [] });
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Questo evento non c’è più o non è adatto alla tua età' }),
    ).toBeVisible();
    await verificaAccessibilita(page);
  });
}

test('le schede mostrano solo quello che serve, senza pressione (F-01, F-04, R-43)', async ({
  page,
}) => {
  await page.goto('/scopri/');
  const evidenza = page.getByRole('link', { name: /Notte Ferrovia/ });
  await expect(evidenza).toContainText('18+');
  await expect(evidenza).toContainText('techno');
  await expect(evidenza).toContainText('Marco e Sara ci vanno');
  await expect(page.getByRole('link', { name: /Open Decks/ })).toContainText('Ingresso libero');
  await expect(page.getByRole('link', { name: /Bassi Lunghi/ })).toContainText(
    '18+ · non dichiarata',
  );
  await expect(page.getByRole('heading', { name: /^Stasera ·/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Domani ·/ })).toBeVisible();
  // Nessun contatore di persone in generale né conto alla rovescia.
  await expect(
    page.getByText(/persone ci vanno|ultimi biglietti|non perderti|tra \d+ ore/i),
  ).toHaveCount(0);
  await expect(page.getByText('Vedi solo gli eventi a cui puoi entrare.')).toBeVisible();
});

test('quando: stasera, domani, weekend e una data dal calendario', async ({ page, supabase }) => {
  await page.goto('/scopri/');
  await expect(page.getByRole('link', { name: /Notte Ferrovia/ })).toBeVisible();
  expect(ultimaRicerca(supabase)).toMatchObject({ dal: serataDiProva(), al: serataDiProva() });

  await page.getByRole('radio', { name: 'Domani' }).click();
  await expect.poll(() => ultimaRicerca(supabase)?.['dal']).toBe(serataDiProva(1));

  await page.getByRole('radio', { name: 'Weekend' }).click();
  await expect
    .poll(() => {
      const corpo = ultimaRicerca(supabase);
      return typeof corpo?.['al'] === 'string' && corpo['al'] >= serataDiProva();
    })
    .toBe(true);

  await page.getByRole('button', { name: 'Scegli data' }).click();
  const domani = new Date(`${serataDiProva(2)}T12:00:00Z`);
  const mese = domani.toLocaleString('it-IT', { month: 'long', timeZone: 'UTC' });
  await page.getByRole('combobox', { name: 'Mese' }).selectOption(String(domani.getUTCMonth() + 1));
  await page
    .getByRole('button', {
      name: `${domani.getUTCDate()} ${mese} ${domani.getUTCFullYear()}`,
      // «1 novembre» non deve trovare anche l'11 e il 21.
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: /^Mostra / }).click();
  await expect.poll(() => ultimaRicerca(supabase)?.['dal']).toBe(serataDiProva(2));
  await expect(page.getByRole('button', { name: 'Scegli data' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('filtri: comune, distanza, generi, età e solo con amici (F-01, F-04)', async ({
  page,
  supabase,
}) => {
  await page.goto('/scopri/');
  await page.getByRole('button', { name: 'Filtri' }).click();
  await page.getByRole('radio', { name: 'Scegli un comune' }).check();
  await page.getByLabel('Comune', { exact: true }).fill('monz');
  await page.getByRole('button', { name: 'Monza' }).click();
  await page.getByRole('radio', { name: '10 km' }).click();
  await page.getByRole('button', { name: 'techno' }).click();
  await page.getByRole('button', { name: 'house' }).click();
  await page
    .getByRole('radiogroup', { name: 'Età minima' })
    .getByRole('radio', { name: '16+' })
    .click();
  await page.getByRole('switch', { name: 'Solo eventi con amici' }).click();
  await expect(page.getByRole('button', { name: /^Mostra \d+ event/ })).toBeVisible();
  await page.getByRole('button', { name: /^Mostra \d+ event/ }).click();

  await expect(page.getByRole('button', { name: 'Filtri, 4 attivi' })).toBeVisible();
  await expect(
    page.getByText('Monza · 10 km · techno, house · fino a 16+ · con amici'),
  ).toBeVisible();
  await expect(page.getByText('Monza · entro 10 km')).toBeVisible();
  expect(ultimaRicerca(supabase)).toMatchObject({
    lat: 45.5845,
    lon: 9.2744,
    raggio_km: 10,
    generi: ['house', 'techno'],
    eta_minima_max: 16,
    solo_amici: true,
  });

  // I filtri restano dopo il dettaglio e il ritorno.
  await page.goto(EVENTO);
  await page.goto('/scopri/');
  await expect(page.getByRole('button', { name: 'Filtri, 4 attivi' })).toBeVisible();
});

test('la posizione si chiede solo con un tocco e si arrotonda (R-33)', async ({
  page,
  context,
  supabase,
}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 45.612345, longitude: 9.245678 });
  await page.goto('/scopri/');
  await expect(page.getByRole('link', { name: /Notte Ferrovia/ })).toBeVisible();
  expect(ultimaRicerca(supabase)).not.toHaveProperty('lat');

  await page.getByRole('button', { name: 'Filtri' }).click();
  await expect(
    page.getByText('La posizione serve solo a calcolare le distanze e non viene salvata.'),
  ).toBeVisible();
  await page.getByRole('radio', { name: 'Usa la mia posizione' }).check();
  await page.getByRole('button', { name: /^Mostra \d+ event/ }).click();
  await expect.poll(() => ultimaRicerca(supabase)?.['lat']).toBe(45.612);
  expect(ultimaRicerca(supabase)).toMatchObject({ lon: 9.246, raggio_km: 10 });
  await expect(page.getByText('Vicino a te · entro 10 km')).toBeVisible();

  // Le coordinate non finiscono nella memoria del dispositivo.
  const salvato = await page.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }));
  expect(salvato).not.toContain('45.61');
});

test('senza permesso di posizione si spiega e si propone il comune', async ({ page }) => {
  await page.goto('/scopri/');
  await page.getByRole('button', { name: 'Filtri' }).click();
  // Il telefono nega il permesso: la scelta torna a tutta l'area.
  await page.getByRole('radio', { name: 'Usa la mia posizione' }).click();
  await expect(page.getByText('Posizione non disponibile')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Tutta Milano e Brianza' })).toBeChecked();
});

test('nessun evento con i filtri: si tolgono in un tocco', async ({ page, supabase }) => {
  await page.goto('/scopri/');
  await expect(page.getByRole('link', { name: /Notte Ferrovia/ })).toBeVisible();
  supabase.rispondi('cerca_eventi', { stato: 200, corpo: [] });
  await page.getByRole('button', { name: 'Filtri' }).click();
  await page.getByRole('switch', { name: 'Solo eventi con amici' }).click();
  await page.getByRole('button', { name: /^Mostra/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Nessun evento con questi filtri' }),
  ).toBeVisible();
  supabase.rispondi('cerca_eventi', { stato: 200, corpo: EVENTI_DI_PROVA });
  await page.getByRole('button', { name: 'Togli i filtri' }).click();
  await expect(page.getByRole('link', { name: /Notte Ferrovia/ })).toBeVisible();
  await expect(page.getByText('Tutti gli eventi')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Filtri', exact: true })).toBeVisible();
});

test('errore di caricamento con Riprova e striscia offline', async ({
  page,
  supabase,
  context,
}) => {
  supabase.rispondi('cerca_eventi', { stato: 500, corpo: { message: 'errore' } });
  await page.goto('/scopri/');
  await expect(
    page.getByRole('heading', { name: 'Gli eventi non si sono caricati' }),
  ).toBeVisible();
  supabase.rispondi('cerca_eventi', { stato: 200, corpo: EVENTI_DI_PROVA });
  await page.getByRole('button', { name: 'Riprova' }).click();
  await expect(page.getByRole('link', { name: /Notte Ferrovia/ })).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByText('Sei offline: vedi gli eventi salvati sul telefono.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Notte Ferrovia/ })).toBeVisible();
  await page.getByRole('radio', { name: 'Mappa' }).click();
  await expect(page.getByText('La mappa non è disponibile offline')).toBeVisible();
  await page.getByRole('button', { name: 'Vedi gli eventi in elenco' }).click();
  await expect(page.getByRole('link', { name: /Notte Ferrovia/ })).toBeVisible();
  await context.setOffline(false);
});

test('Mi interessa / Partecipo: un tocco, Annulla e visibilità per l’evento (F-05, R-67)', async ({
  page,
  supabase,
}) => {
  await page.goto(EVENTO);
  const partecipo = page.getByRole('button', { name: 'Partecipo' });
  await expect(page.getByText('Non hai ancora scelto.')).toBeVisible();
  await partecipo.click();
  await expect(partecipo).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Segnato: partecipi', { exact: true })).toBeVisible();
  expect(supabase.chiamate('partecipazioni_crea')[0]?.corpo).toMatchObject({
    evento_id: '00000000-0000-4000-8000-00000000e001',
    stato: 'partecipo',
    visibile_agli_amici: true,
  });

  await page.getByRole('button', { name: 'Annulla' }).click();
  await expect(partecipo).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => supabase.chiamate('partecipazioni_elimina').length).toBe(1);

  // Con una scelta salvata, la visibilità si cambia per questo evento.
  supabase.partecipazione = { stato: 'interessato', visibile: true };
  await page.reload();
  await expect(page.getByRole('button', { name: 'Mi interessa' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('switch', { name: 'Visibile ai tuoi amici' }).click();
  await expect(page.getByText('Solo per te', { exact: true })).toBeVisible();
  await expect
    .poll(() => supabase.chiamate('partecipazioni_aggiorna')[0]?.corpo)
    .toMatchObject({ stato: 'interessato', visibile_agli_amici: false });

  // Un secondo tocco toglie la scelta.
  await page.getByRole('button', { name: 'Mi interessa' }).click();
  await expect(page.getByText('Scelta tolta')).toBeVisible();
  await expect.poll(() => supabase.chiamate('partecipazioni_elimina').length).toBe(2);
});

test('una scelta non salvata torna indietro e lo dice', async ({ page, supabase }) => {
  supabase.rispondi('partecipazioni_crea', { stato: 403, corpo: { code: '42501', message: 'no' } });
  await page.goto(EVENTO);
  await page.getByRole('button', { name: 'Partecipo' }).click();
  await expect(page.getByText('La scelta non è stata salvata. Riprova.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Partecipo' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('dettaglio: fonte, biglietti, Apri in Mappe e link condiviso (F-03)', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined });
  });
  await page.goto(EVENTO);
  const fonte = page.getByRole('link', { name: /Fonte: sito del locale/ });
  await expect(fonte).toHaveAttribute('href', 'https://binario7.example/eventi/notte-ferrovia');
  await expect(fonte).toHaveAttribute('target', '_blank');
  await expect(page.getByRole('link', { name: /Biglietti/ })).toHaveAttribute(
    'href',
    'https://binario7.example/biglietti',
  );
  await expect(page.getByRole('link', { name: /Apri in Mappe/ })).toHaveAttribute(
    'href',
    /45\.5845/,
  );
  await expect(page.getByText('Nera Vale · Corrado B. · Otto Fili')).toBeVisible();
  await expect(page.getByText('da 15 €')).toBeVisible();

  await page.getByRole('button', { name: 'Altre azioni per Notte Ferrovia' }).click();
  await page.getByRole('menuitem', { name: 'Condividi il link' }).click();
  await expect(page.getByText('Link copiato')).toBeVisible();
  const copiato = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiato).toMatch(/\/evento\/\?id=00000000-0000-4000-8000-00000000e001$/);
});

test('segnala l’evento e la foto del locale in due tocchi (R-50)', async ({ page, supabase }) => {
  await simulaFoto(page, supabase);
  await page.goto(EVENTO);
  await expect(page.getByText('Foto: Laura Bassi, CC BY 4.0')).toBeVisible();
  await page.getByRole('button', { name: 'Altre azioni per Notte Ferrovia' }).click();
  await page.getByRole('menuitem', { name: 'Segnala' }).click();
  await expect(page.getByRole('button', { name: 'Foto del locale inappropriata' })).toBeVisible();
  await page.getByRole('button', { name: 'Riferimenti all’alcol non segnalati' }).click();
  await expect(page.getByRole('heading', { name: 'Grazie, ce ne occupiamo noi.' })).toBeVisible();
  expect(supabase.chiamate('segnalazioni_crea')[0]?.corpo).toMatchObject({
    tipo_oggetto: 'evento',
    oggetto_id: '00000000-0000-4000-8000-00000000e001',
    motivo: 'alcol_a_minori',
  });
});

test('dettaglio offline: dati salvati, azioni e link spenti con il motivo', async ({
  page,
  context,
}) => {
  await page.goto(EVENTO);
  await expect(page.getByRole('heading', { level: 1, name: 'Notte Ferrovia' })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText('Sei offline: vedi i dettagli salvati sul telefono.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Partecipo' })).toBeDisabled();
  await expect(
    page.getByText('Partecipazione e link tornano attivi con la connessione.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Fonte: sito del locale/ })).toHaveCount(0);
  await context.setOffline(false);
});

test('la mappa ha gli stessi eventi dell’elenco e l’anteprima porta al dettaglio (F-02)', async ({
  page,
  supabase,
}) => {
  supabase.rispondi('cerca_eventi', {
    stato: 200,
    corpo: [
      ...EVENTI_DI_PROVA,
      eventoDiProva({
        id: '00000000-0000-4000-8000-00000000e009',
        titolo: 'Anni Zero',
        locale: LOCALI_DI_PROVA.ventuno,
        inizio: '22:00',
        eta: 16,
      }),
    ],
  });
  await simulaMappe(page);
  await page.goto('/scopri/');
  await page.getByRole('radio', { name: 'Mappa' }).click();
  await expect(page.getByRole('region', { name: /Mappa degli eventi/ })).toHaveAttribute(
    'data-stato',
    'pronta',
    { timeout: 20_000 },
  );
  await expect(page.getByText(/OpenStreetMap/)).toBeVisible();
  // Club Binario 7 e Officina Lambro sono a 800 metri: un gruppo che si apre avvicinandosi.
  await page.getByRole('button', { name: /^2 locali vicini/ }).click();
  const binario = page.getByRole('button', { name: 'Club Binario 7, 1 evento' });
  await binario.click();
  await expect(binario).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'Apri Notte Ferrovia' }).click();
  await expect(page).toHaveURL(/\/evento\/\?id=00000000-0000-4000-8000-00000000e001/);

  await page.goto('/scopri/');
  await page.getByRole('radio', { name: 'Mappa' }).click();
  await page.getByRole('button', { name: 'Mostra elenco' }).click();
  await expect(page.getByRole('link', { name: /Anni Zero/ })).toBeVisible();
});
