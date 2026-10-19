import type { Page } from '@playwright/test';
import { expect, impostaTema, simulaMappe, TEMI, test, verificaAccessibilita } from './supporto';
import {
  CODICE_GIUSTO,
  ID_MODERAZIONE as ID,
  ModerazioneSimulata,
  type OpzioniModerazione,
} from './supportoModerazione';

// Area di moderazione di locali, fonti, duplicati ed eventi (F-40, F-44,
// design/F-40-moderazione-fonti). Regole: R-06, R-22, R-23, R-56, R-69; ADR-0008.

const DENTRO: OpzioniModerazione = { ruolo: true, fattore: 'verificato', aal: 'aal2' };

async function apri(page: Page, opzioni: OpzioniModerazione = DENTRO) {
  const simulata = new ModerazioneSimulata(opzioni);
  await simulata.collega(page);
  await simulata.impostaSessione(page);
  await simulaMappe(page);
  return simulata;
}

test.describe('accesso con due fattori (R-06)', () => {
  test('senza ruolo di moderatore l’area non si apre', async ({ page }) => {
    const simulata = await apri(page, { ruolo: false, fattore: 'assente', aal: 'aal1' });
    await page.goto('/moderazione/locali/');
    await expect(
      page.getByRole('heading', { name: 'Quest’area è riservata al team di moderazione' }),
    ).toBeVisible();
    await verificaAccessibilita(page);
    expect(simulata.di('POST /rest/v1/rpc/locali_moderazione')).toHaveLength(0);
  });

  test('la prima volta si attivano i due fattori con il QR e il primo codice', async ({ page }) => {
    const simulata = await apri(page, { ruolo: true, fattore: 'assente', aal: 'aal1' });
    await page.goto('/moderazione/locali/');
    await expect(page.getByRole('heading', { name: 'Attiva i due fattori' })).toBeVisible();
    await expect(page.getByText('NXQ47KD2M9WP3HTR')).toBeVisible();
    await expect(page.getByRole('img', { name: /Codice QR/ })).toBeVisible();
    await verificaAccessibilita(page);

    await page.getByRole('textbox', { name: 'Cifra 1 di 6' }).fill('123456');
    await expect(page.getByText(/Codice non valido/)).toBeVisible();
    // Con l'errore le cifre restano: si corregge e si riprova.
    await expect(page.getByRole('textbox', { name: 'Cifra 6 di 6' })).toHaveValue('6');
    await page.getByRole('textbox', { name: 'Cifra 1 di 6' }).fill(CODICE_GIUSTO);
    await expect(page.getByRole('heading', { name: /^Locali/ })).toBeVisible();
    expect(simulata.di('POST /auth/v1/factors')).toHaveLength(1);
  });

  test('agli accessi successivi basta il codice; si può incollare', async ({ page }) => {
    await apri(page, { ruolo: true, fattore: 'verificato', aal: 'aal1' });
    await page.goto('/moderazione/fonti/');
    await expect(page.getByRole('heading', { name: 'Inserisci il codice' })).toBeVisible();
    await verificaAccessibilita(page);
    await page.getByRole('textbox', { name: 'Cifra 1 di 6' }).focus();
    await page.evaluate((codice) => {
      const dati = new DataTransfer();
      dati.setData('text', codice);
      document.activeElement?.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dati, bubbles: true }),
      );
    }, CODICE_GIUSTO);
    await expect(page.getByRole('heading', { name: /^Fonti/ })).toBeVisible();
  });

  test('troppi tentativi mettono l’accesso in pausa', async ({ page }) => {
    const simulata = await apri(page, { ruolo: true, fattore: 'verificato', aal: 'aal1' });
    simulata.rispondi(`POST /auth/v1/factors/fattore-totp-1/verify`, {
      stato: 429,
      corpo: { code: 429, error_code: 'over_request_rate_limit', msg: 'Too many requests' },
    });
    await page.goto('/moderazione/locali/');
    await page.getByRole('textbox', { name: 'Cifra 1 di 6' }).fill('000000');
    await expect(page.getByText(/Troppi tentativi/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continua' })).toBeDisabled();
  });
});

for (const tema of TEMI) {
  test(`locali, fonti, duplicati ed eventi senza violazioni axe (${tema})`, async ({ page }) => {
    test.slow();
    await impostaTema(page, tema);
    await apri(page);
    await page.goto('/moderazione/locali/');
    await expect(page.getByRole('link', { name: 'Club Binario 7' })).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto('/moderazione/locali/?vista=candidati');
    await expect(page.getByText('Club Binario Sette')).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto(`/moderazione/locale/?id=${ID.binario}`);
    await expect(page.getByRole('textbox', { name: 'Nome' })).toHaveValue('Club Binario 7');
    await verificaAccessibilita(page);
    await page.goto('/moderazione/fonti/');
    await expect(page.getByText('binario7.example/eventi').first()).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto(`/moderazione/fonte/?id=${ID.fonteSito}`);
    await expect(page.getByRole('heading', { name: 'Ultime esecuzioni' })).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto('/moderazione/duplicati/');
    await expect(
      page.getByRole('heading', { name: 'NOTTE FERROVIA – techno all night' }),
    ).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto('/moderazione/eventi/');
    await expect(page.getByRole('link', { name: 'Bassi Lunghi' })).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto(`/moderazione/evento/?id=${ID.evento}`);
    await expect(page.getByRole('textbox', { name: 'Titolo' })).toHaveValue('Bassi Lunghi');
    await verificaAccessibilita(page);
  });
}

test.describe('locali e candidati', () => {
  test('filtri, elenco vuoto e "Togli i filtri"', async ({ page }) => {
    await apri(page);
    await page.goto('/moderazione/locali/');
    await expect(page.getByRole('link', { name: 'Spazio Navile' })).toBeVisible();
    await page.getByRole('button', { name: 'MI', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Club Binario 7' })).toBeHidden();
    await page.getByRole('button', { name: 'Senza foto' }).click();
    await page.getByRole('button', { name: 'Attivo', exact: true }).click();
    await expect(page.getByText('Nessun locale con questi filtri')).toBeVisible();
    await page.getByRole('button', { name: 'Togli i filtri' }).click();
    await expect(page.getByRole('link', { name: 'Club Binario 7' })).toBeVisible();
  });

  test('le frecce passano da una riga all’altra', async ({ page }) => {
    await apri(page);
    await page.goto('/moderazione/locali/');
    await page.getByRole('link', { name: 'Club Binario 7' }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('link', { name: 'Officina Lambro' })).toBeFocused();
  });

  test('unire un candidato chiede la motivazione e la registra', async ({ page }) => {
    const simulata = await apri(page);
    await page.goto('/moderazione/locali/?vista=candidati');
    await expect(page.getByRole('link', { name: 'Apri su Google Maps' })).toBeVisible();
    await page.getByRole('button', { name: 'Unisci…' }).first().click();
    const dialogo = page.getByRole('dialog', { name: 'Unire a un locale esistente' });
    await expect(dialogo.getByRole('radio', { name: /Club Binario 7/ })).toBeChecked();
    await dialogo.getByRole('button', { name: 'Unisci' }).click();
    await expect(dialogo.getByText('Scrivi la motivazione: resta nel registro.')).toBeVisible();
    expect(simulata.di('POST /rest/v1/rpc/decidi_candidato_locale')).toHaveLength(0);
    await dialogo
      .getByRole('textbox', { name: 'Motivazione (obbligatoria)' })
      .fill('Stesso indirizzo.');
    await dialogo.getByRole('button', { name: 'Unisci' }).click();
    await expect(page.getByText('Candidato unito al locale.')).toBeVisible();
    expect(simulata.di('POST /rest/v1/rpc/decidi_candidato_locale')[0]?.corpo).toEqual({
      candidato: ID.candidatoOsm,
      esito: 'unito',
      locale: ID.binario,
      motivazione: 'Stesso indirizzo.',
    });
  });

  test('la scheda salva le modifiche e controlla i dati', async ({ page }) => {
    const simulata = await apri(page);
    await page.goto(`/moderazione/locale/?id=${ID.binario}`);
    await page.getByRole('textbox', { name: 'Nome' }).fill('');
    await page.getByRole('textbox', { name: /Sito/ }).fill('binario7.example');
    await page.getByRole('button', { name: 'Salva modifiche' }).click();
    await expect(page.getByText('Scrivi il nome (fino a 120 caratteri).')).toBeVisible();
    await expect(page.getByText('Il sito inizia con https:// o http://.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Nome' }).fill('Club Binario 7 – Sala grande');
    await page.getByRole('textbox', { name: /Sito/ }).fill('https://binario7.example');
    await page.getByRole('textbox', { name: 'Latitudine' }).fill('45.59');
    await page.getByRole('button', { name: 'Salva modifiche' }).click();
    await expect(page.getByText('Modifiche salvate e registrate.')).toBeVisible();
    const salvataggio = simulata.di('PATCH /rest/v1/locali')[0];
    expect(salvataggio?.corpo).toMatchObject({
      nome: 'Club Binario 7 – Sala grande',
      posizione: 'SRID=4326;POINT(9.2744 45.59)',
      instagram_username: 'clubbinario7',
    });
  });

  test('la foto si salva solo con la fonte e le due conferme (R-56)', async ({ page }) => {
    const simulata = await apri(page);
    await page.goto(`/moderazione/locale/?id=${ID.binario}`);
    await page.getByLabel('scegli un file').setInputFiles({
      name: 'facciata.heic',
      mimeType: 'image/heic',
      buffer: Buffer.from("non è un'immagine"),
    });
    await expect(page.getByText(/«facciata.heic» non è in un formato valido/)).toBeVisible();

    const png = await page.evaluate(async () => {
      const tela = document.createElement('canvas');
      tela.width = 320;
      tela.height = 240;
      const contesto = tela.getContext('2d');
      if (contesto) {
        contesto.fillStyle = '#336699';
        contesto.fillRect(0, 0, 320, 240);
      }
      const blob = await new Promise<Blob | null>((risolvi) => tela.toBlob(risolvi, 'image/png'));
      return Array.from(new Uint8Array(await (blob as Blob).arrayBuffer()));
    });
    await page.getByLabel('scegli un file').setInputFiles({
      name: 'facciata.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png),
    });
    await expect(page.getByText('Ritaglio 16:10 · con velatura')).toBeVisible();
    await page.getByRole('button', { name: 'Salva foto' }).click();
    await expect(page.getByText('Scrivi il riferimento all’autorizzazione.')).toBeVisible();
    await page
      .getByRole('textbox', { name: 'Riferimento del documento di autorizzazione' })
      .fill('AUT-2026-021');
    await page.getByRole('button', { name: 'Salva foto' }).click();
    await expect(page.getByText('Spunta le due conferme prima di salvare.')).toBeVisible();
    expect(simulata.di('POST /rest/v1/rpc/salva_foto_locale')).toHaveLength(0);
    await page.getByRole('checkbox', { name: /persone riconoscibili/ }).check();
    await page.getByRole('checkbox', { name: /alcolici in evidenza/ }).check();
    await page.getByRole('button', { name: 'Salva foto' }).click();
    await expect(page.getByText('Foto salvata e registrata.')).toBeVisible();
    const caricamento = simulata.chiamate.find((c) =>
      c.chiave.startsWith('POST /storage/v1/object/immagini-locali/'),
    );
    expect(caricamento?.chiave).toBe(`POST /storage/v1/object/immagini-locali/${ID.binario}.webp`);
    expect(simulata.di('POST /rest/v1/rpc/salva_foto_locale')[0]?.corpo).toEqual({
      locale: ID.binario,
      fonte: 'autorizzazione_locale',
      senza_persone: true,
      senza_alcol: true,
      riferimento: 'AUT-2026-021',
    });
  });

  test('errore di caricamento con "Riprova"', async ({ page }) => {
    const simulata = await apri(page);
    simulata.rispondi('POST /rest/v1/rpc/locali_moderazione', {
      stato: 503,
      corpo: { code: '503' },
    });
    await page.goto('/moderazione/locali/');
    await expect(page.getByText('Non si è caricato')).toBeVisible();
    simulata.rispondi('POST /rest/v1/rpc/locali_moderazione', {
      stato: 200,
      corpo: [],
    });
    await page.getByRole('button', { name: 'Riprova' }).click();
    await expect(page.getByText('Nessun locale con questi filtri')).toBeVisible();
  });
});

test.describe('fonti (ADR-0008)', () => {
  test('stati scritti, filtro "Con errori" e pannello della fonte spenta in automatico', async ({
    page,
  }) => {
    const simulata = await apri(page);
    await page.goto('/moderazione/fonti/');
    await expect(page.getByText('Spenta auto')).toBeVisible();
    await expect(page.getByText('Da verificare').first()).toBeVisible();
    await page.getByRole('button', { name: 'Con errori' }).click();
    await expect(page.getByText('@officinalambro')).toBeVisible();
    await expect(page.getByText('binario7.example/eventi')).toBeHidden();
    await page.getByText('@officinalambro').click();
    const pannello = page.getByRole('complementary');
    await expect(pannello.getByText('5 errori di fila: fonte disattivata')).toBeVisible();
    await pannello.getByRole('button', { name: 'Esegui ora' }).click();
    await expect(pannello.getByText(/In coda/)).toBeVisible();
    expect(simulata.di('POST /rest/v1/rpc/esegui_fonte_ora')[0]?.corpo).toEqual({
      fonte: ID.fonteInstagram,
    });
  });

  test('una fonte da verificare non si esegue né si attiva', async ({ page }) => {
    await apri(page);
    await page.goto(`/moderazione/fonte/?id=${ID.fonteDaVerificare}`);
    await expect(page.getByText(/Non si può attivare/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Esegui ora' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Attiva', exact: true })).toBeDisabled();
  });

  test('"Consentita" richiede robots.txt, termini e data di lettura', async ({ page }) => {
    const simulata = await apri(page);
    await page.goto(`/moderazione/fonte/?locale=${ID.ventuno}`);
    await page.getByRole('textbox', { name: 'URL' }).fill('https://salaventuno.example/calendario');
    await page.getByRole('radio', { name: 'Consentita' }).click();
    await page.getByRole('button', { name: 'Salva fonte' }).click();
    await expect(page.getByText('Scegli l’esito di robots.txt.')).toBeVisible();
    await expect(page.getByText(/Scrivi quando hai letto i termini/)).toBeVisible();
    expect(simulata.di('POST /rest/v1/fonti')).toHaveLength(0);
    await page.getByRole('combobox', { name: /Esito di robots.txt/ }).selectOption('consentito');
    await page
      .getByRole('textbox', { name: 'Termini d’uso · link' })
      .fill('https://salaventuno.example/termini');
    await page.getByLabel('Data di lettura').fill('2026-10-18');
    await page.getByRole('button', { name: 'Salva fonte' }).click();
    await expect.poll(() => simulata.di('POST /rest/v1/fonti').length).toBe(1);
    expect(simulata.di('POST /rest/v1/fonti')[0]?.corpo).toMatchObject({
      locale_id: ID.ventuno,
      tipo: 'sito_locale',
      stato_conformita: 'consentita',
      robots_esito: 'consentito',
      termini_letti_il: '2026-10-18',
      frequenza_minuti: 360,
    });
  });

  test('gli aggregatori restano vietati (D-05)', async ({ page }) => {
    await apri(page);
    await page.goto('/moderazione/fonte/');
    await page.getByRole('radio', { name: 'Aggregatore' }).click();
    await expect(page.getByText(/Gli aggregatori restano vietati/)).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Consentita' })).toHaveCount(0);
  });

  test('"Segna come vietata" chiede la motivazione', async ({ page }) => {
    const simulata = await apri(page);
    await page.goto(`/moderazione/fonte/?id=${ID.fonteSito}`);
    await page.getByRole('button', { name: 'Segna come vietata…' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Segnare la fonte come vietata?' });
    await dialogo
      .getByRole('textbox', { name: 'Motivazione (obbligatoria)' })
      .fill('Richiesta del titolare del sito.');
    await dialogo.getByRole('button', { name: 'Segna come vietata' }).click();
    await expect(dialogo).toBeHidden();
    expect(simulata.di('PATCH /rest/v1/fonti')[0]?.corpo).toEqual({
      stato_conformita: 'vietata',
      attiva: false,
      note_conformita: 'Richiesta del titolare del sito.',
    });
  });
});

test.describe('duplicati', () => {
  test('confronto con le differenze scritte e decisione con la tastiera', async ({ page }) => {
    const simulata = await apri(page);
    await page.goto('/moderazione/duplicati/');
    await expect(
      page.getByRole('heading', { name: 'NOTTE FERROVIA – techno all night' }),
    ).toBeVisible();
    await expect(page.getByText('≠ diverso').first()).toBeVisible();
    await expect(
      page.getByText(/età 18\+ \(la più alta\), alcol: sì \(basta una fonte\)/),
    ).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('heading', { name: 'Cortile Live' })).toBeVisible();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('s');
    await expect(
      page.getByText(/Salvato: «NOTTE FERROVIA – techno all night» è lo stesso evento/),
    ).toBeVisible();
    expect(simulata.di('POST /rest/v1/rpc/decidi_duplicato')[0]?.corpo).toEqual({
      grezzo: ID.grezzo,
      stesso_evento: true,
    });
  });

  test('coda vuota ed errore di salvataggio', async ({ page }) => {
    const simulata = await apri(page);
    simulata.rispondi('POST /rest/v1/rpc/decidi_duplicato', {
      stato: 500,
      corpo: { code: 'XX000' },
    });
    await page.goto('/moderazione/duplicati/');
    await page.getByRole('button', { name: /Eventi distinti/ }).click();
    await expect(page.getByText('La decisione non è stata salvata')).toBeVisible();
    simulata.rispondi('POST /rest/v1/rpc/coda_duplicati', { stato: 200, corpo: [] });
    await page.goto('/moderazione/duplicati/');
    await expect(page.getByText('Niente da controllare')).toBeVisible();
  });
});

test.describe('eventi (R-22, R-23)', () => {
  test('abbassare l’età spiega l’effetto sui minorenni e chiede la motivazione', async ({
    page,
  }) => {
    const simulata = await apri(page);
    await page.goto(`/moderazione/evento/?id=${ID.evento}`);
    await expect(page.getByText('18+ · non dichiarata').first()).toBeVisible();
    await page.getByRole('button', { name: 'Abbassa l’età…' }).click();
    const dialogo = page.getByRole('dialog', { name: /età di «Bassi Lunghi»/ });
    await dialogo.getByRole('combobox', { name: 'Nuova età minima' }).selectOption('16');
    await expect(
      dialogo.getByText(/visibile anche a chi ha meno di 18 anni: lo vedranno da 16 anni/),
    ).toBeVisible();
    await dialogo.getByRole('button', { name: 'Abbassa a 16+' }).click();
    await expect(dialogo.getByText('Scrivi la motivazione: resta nel registro.')).toBeVisible();
    await dialogo
      .getByRole('textbox', { name: 'Motivazione (obbligatoria)' })
      .fill('Il locale ha confermato via email.');
    await dialogo.getByRole('button', { name: 'Abbassa a 16+' }).click();
    await expect(page.getByText('Età corretta e registrata.')).toBeVisible();
    expect(simulata.di('POST /rest/v1/rpc/correggi_eta_alcol_evento')[0]?.corpo).toEqual({
      evento: ID.evento,
      eta_minima: 16,
      eta_minima_dichiarata: true,
      riferimenti_alcol: true,
      motivazione: 'Il locale ha confermato via email.',
    });
  });

  test('annullare un evento avvisa chi partecipa', async ({ page }) => {
    const simulata = await apri(page);
    await page.goto(`/moderazione/evento/?id=${ID.evento}`);
    await page.getByRole('button', { name: 'Annulla evento…' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Annullare «Bassi Lunghi»?' });
    await expect(dialogo.getByText(/Chi aveva scelto «Partecipo»/)).toBeVisible();
    await dialogo
      .getByRole('textbox', { name: 'Motivazione (obbligatoria)' })
      .fill('Serata rimandata.');
    await dialogo.getByRole('button', { name: 'Annulla evento' }).click();
    await expect(page.getByText('Evento annullato e registrato.')).toBeVisible();
    expect(simulata.di('POST /rest/v1/rpc/cambia_stato_evento')[0]?.corpo).toEqual({
      evento: ID.evento,
      stato: 'annullato',
      motivazione: 'Serata rimandata.',
    });
  });

  test('possibili annullamenti: "È ancora in programma"', async ({ page }) => {
    const simulata = await apri(page);
    await page.goto('/moderazione/eventi/?vista=annullamenti');
    await expect(page.getByText('Sì, alcuni utenti')).toBeVisible();
    await page.getByRole('button', { name: 'È ancora in programma' }).click();
    await expect(page.getByText(/Confermato in programma/)).toBeVisible();
    expect(simulata.di('POST /rest/v1/rpc/decidi_possibile_annullamento')[0]?.corpo).toMatchObject({
      annullato: false,
    });
  });

  test('il registro mostra moderatori e operazioni della raccolta', async ({ page }) => {
    await apri(page);
    await page.goto(`/moderazione/evento/?id=${ID.evento}`);
    const registro = page.getByRole('list').filter({ hasText: 'Sistema' });
    await expect(registro.getByText('ha creato l’evento da @officinalambro')).toBeVisible();
    await expect(registro.getByText('Moderatore Uno')).toBeVisible();
  });
});

test('a 390 px la navigazione si apre dal menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await apri(page);
  await page.goto('/moderazione/locali/');
  await expect(
    page.getByRole('navigation', { name: 'Sezioni dell’area di moderazione' }),
  ).toBeHidden();
  await page.getByRole('button', { name: 'Apri il menu' }).click();
  const navigazione = page.getByRole('navigation', { name: 'Sezioni dell’area di moderazione' });
  await expect(navigazione).toBeVisible();
  await navigazione.getByRole('link', { name: 'Fonti' }).click();
  await expect(page.getByRole('heading', { name: /^Fonti/ })).toBeVisible();
  await expect(navigazione).toBeHidden();
  await verificaAccessibilita(page);
});
