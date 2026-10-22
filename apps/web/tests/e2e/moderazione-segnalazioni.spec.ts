import type { Page } from '@playwright/test';
import { expect, impostaTema, simulaMappe, TEMI, test, verificaAccessibilita } from './supporto';
import {
  ID_MODERAZIONE as ID,
  ModerazioneSimulata,
  type OpzioniModerazione,
} from './supportoModerazione';

// Area di moderazione di flyer, segnalazioni e reclami (F-06, F-12, F-40,
// design/F-40-moderazione). Regole: R-21, R-22, R-23, R-51, R-53, R-55, R-69; DSA art. 17 e 20.

const DENTRO: OpzioniModerazione = { ruolo: true, fattore: 'verificato', aal: 'aal2' };

async function apri(page: Page) {
  const simulata = new ModerazioneSimulata(DENTRO);
  await simulata.collega(page);
  await simulata.impostaSessione(page);
  await simulaMappe(page);
  return simulata;
}

function corpo(simulata: ModerazioneSimulata, chiave: string) {
  return simulata.di(chiave)[0]?.corpo as Record<string, unknown> | undefined;
}

for (const tema of TEMI) {
  test(`flyer, segnalazioni e reclami senza violazioni axe (${tema})`, async ({ page }) => {
    await apri(page);
    await impostaTema(page, tema);
    await page.goto('/moderazione/flyer/');
    await expect(page.getByRole('link', { name: 'Luci Basse' })).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto(`/moderazione/flyer/?id=${ID.flyerCorrispondenza}`);
    await expect(page.getByText('Notte Ferrovia · già pubblicato')).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto('/moderazione/segnalazioni/');
    await expect(page.getByText('P1 · Rischio minore').first()).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto(`/moderazione/segnalazione/?id=${ID.segnalazioneP1}`);
    await expect(page.getByRole('heading', { name: 'Profilo segnalato' })).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto('/moderazione/reclami/');
    await expect(
      page.getByText('Il flyer era leggibile: la data è scritta in basso.'),
    ).toBeVisible();
    await verificaAccessibilita(page);
  });
}

test.describe('guscio', () => {
  test('l’avviso urgente compare in tutte le sezioni e porta alla coda (R-53)', async ({
    page,
  }) => {
    await apri(page);
    await page.goto('/moderazione/locali/');
    const avviso = page.getByRole('status').filter({ hasText: '1 segnalazione urgente' });
    await expect(avviso).toContainText('Rischio per un minore');
    await expect(avviso).toContainText(/scade alle \d{2}:\d{2} \(tra 2 h 1\d min\)/);
    // A 390 px la navigazione si apre dal menu.
    const menu = page.getByRole('button', { name: 'Apri il menu' });
    if (await menu.isVisible()) await menu.click();
    await expect(
      page.getByRole('link', { name: /Segnalazioni.*1 segnalazione di priorità 1/ }),
    ).toBeVisible();
    if (await page.getByRole('button', { name: 'Chiudi il menu' }).isVisible()) {
      await page.getByRole('button', { name: 'Chiudi il menu' }).click();
    }
    await avviso.getByRole('link', { name: 'Apri la segnalazione' }).click();
    await expect(page).toHaveURL(/\/moderazione\/segnalazioni\/$/);
  });
});

test.describe('flyer (R-51)', () => {
  test('la coda non mostra chi ha caricato e segna confidenza e corrispondenze', async ({
    page,
  }) => {
    await apri(page);
    await page.goto('/moderazione/flyer/');
    await expect(page.getByText('Chi ha caricato il flyer non compare (R-69).')).toBeVisible();
    await expect(page.getByText('88 %')).toBeVisible();
    await expect(page.getByText('Possibile')).toBeVisible();
    await expect(page.getByRole('table').getByText('Non leggibile')).toBeVisible();
    await page.getByRole('button', { name: 'Con corrispondenza' }).click();
    await expect(page.getByRole('link', { name: 'Luci Basse' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Notte Ferrovia' })).toBeVisible();
  });

  test('approvare richiede alcol, conferme e locale; l’età non dichiarata vale 18 (R-21, R-23)', async ({
    page,
  }) => {
    const simulata = await apri(page);
    await page.goto(`/moderazione/flyer/?id=${ID.flyerBozza}`);
    // Il locale letto sul flyer corrisponde a un solo locale censito.
    await expect(page.getByLabel('Locale', { exact: true })).toHaveValue(ID.lambro);
    await expect(page.getByLabel('Titolo')).toHaveValue('Luci Basse');
    await expect(page.getByLabel('Inizio')).toHaveValue('2026-11-01T23:00');
    await expect(page.getByLabel('Fine')).toHaveValue('2026-11-02T04:00');
    await expect(page.getByText('Sul flyer l’età non c’è: vale 18+ (R-21).')).toBeVisible();
    await expect(page.getByText(/da controllare · 41 %/)).toBeVisible();

    await page.getByRole('button', { name: 'Approva e pubblica' }).click();
    await expect(page.getByText('Scegli sì o no.')).toBeVisible();
    await expect(page.getByText('Spunta le due conferme: servono per pubblicare.')).toBeVisible();
    expect(simulata.di('POST /rest/v1/rpc/decidi_flyer')).toHaveLength(0);

    await page.getByRole('radio', { name: 'Sì' }).check();
    await page.getByRole('checkbox', { name: 'Ho confrontato i campi con il flyer' }).check();
    await page.getByRole('checkbox', { name: /Il flyer non contiene contenuti inadatti/ }).check();
    await page.getByRole('button', { name: 'Approva e pubblica' }).click();
    await expect.poll(() => simulata.di('POST /rest/v1/rpc/decidi_flyer').length).toBe(1);
    const inviato = corpo(simulata, 'POST /rest/v1/rpc/decidi_flyer');
    expect(inviato?.esito).toBe('approva');
    expect(inviato?.dati).toMatchObject({
      titolo: 'Luci Basse',
      locale_id: ID.lambro,
      eta_minima: null,
      eta_minima_dichiarata: false,
      riferimenti_alcol: true,
      generi: ['techno', 'house'],
      artisti: ['Nera Vale'],
      prezzo_min_centesimi: 1200,
      confrontato: true,
      immagine_adatta: true,
      pubblica_immagine: true,
    });
    // Dopo la decisione si passa al flyer successivo.
    await expect(page).toHaveURL(new RegExp(`id=${ID.flyerCorrispondenza}`));
  });

  test('sotto i 18 anni serve la motivazione (R-22)', async ({ page }) => {
    const simulata = await apri(page);
    await page.goto(`/moderazione/flyer/?id=${ID.flyerBozza}`);
    await page.getByLabel('Età minima').selectOption('16');
    await expect(page.getByText(/visibile anche a chi ha meno di 18 anni/)).toBeVisible();
    await page.getByRole('radio', { name: 'No' }).check();
    await page.getByRole('checkbox', { name: 'Ho confrontato i campi con il flyer' }).check();
    await page.getByRole('checkbox', { name: /Il flyer non contiene contenuti inadatti/ }).check();
    await page.getByRole('button', { name: 'Approva e pubblica' }).click();
    await expect(
      page.getByText('Scrivi perché l’età è sotto i 18 anni: resta nel registro.'),
    ).toBeVisible();
    await page.getByLabel('Motivazione per l’età sotto i 18 anni').fill('Il locale conferma 16+.');
    await page.getByRole('button', { name: 'Approva e pubblica' }).click();
    await expect.poll(() => simulata.di('POST /rest/v1/rpc/decidi_flyer').length).toBe(1);
    expect(corpo(simulata, 'POST /rest/v1/rpc/decidi_flyer')).toMatchObject({
      motivazione: 'Il locale conferma 16+.',
      dati: { eta_minima: 16, eta_minima_dichiarata: true, riferimenti_alcol: false },
    });
  });

  test('rifiutare con un motivo mostra l’anteprima del messaggio', async ({ page }) => {
    const simulata = await apri(page);
    await page.goto(`/moderazione/flyer/?id=${ID.flyerBozza}`);
    await expect(page.getByLabel('Titolo')).toHaveValue('Luci Basse');
    await page.keyboard.press('r');
    const dialogo = page.getByRole('dialog', { name: 'Perché rifiuti questo flyer?' });
    await dialogo.getByRole('radio', { name: 'Evento già passato' }).check();
    await expect(dialogo.getByText('Il tuo flyer non è stato pubblicato')).toBeVisible();
    await expect(dialogo.getByText('La serata del flyer è già passata.')).toBeVisible();
    await dialogo.getByRole('button', { name: 'Rifiuta il flyer' }).click();
    await expect.poll(() => simulata.di('POST /rest/v1/rpc/decidi_flyer').length).toBe(1);
    expect(corpo(simulata, 'POST /rest/v1/rpc/decidi_flyer')).toMatchObject({
      esito: 'rifiuta',
      motivazione: 'La serata del flyer è già passata.',
    });
  });

  test('unire a un evento pubblicato aggiunge solo la fonte', async ({ page }) => {
    const simulata = await apri(page);
    await page.goto(`/moderazione/flyer/?id=${ID.flyerCorrispondenza}`);
    await page.getByRole('button', { name: 'Unisci a questo evento' }).click();
    await page
      .getByRole('dialog', { name: 'Unire il flyer all’evento pubblicato?' })
      .getByRole('button', { name: 'Unisci il flyer' })
      .click();
    await expect.poll(() => simulata.di('POST /rest/v1/rpc/decidi_flyer').length).toBe(1);
    expect(corpo(simulata, 'POST /rest/v1/rpc/decidi_flyer')).toMatchObject({
      esito: 'unisci',
      evento_esistente: ID.eventoPubblicato,
    });
  });

  test('l’escalation chiede due passaggi e la parola di conferma (R-55)', async ({ page }) => {
    const simulata = await apri(page);
    await page.goto(`/moderazione/flyer/?id=${ID.flyerBozza}`);
    await page.getByRole('button', { name: 'Altre azioni sul flyer' }).click();
    await page.getByRole('menuitem', { name: 'Escalation alle autorità…' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Escalation alle autorità' });
    await expect(dialogo.getByText('L’account viene sospeso.')).toBeVisible();
    await dialogo.getByRole('button', { name: 'Continua' }).click();
    await dialogo.getByLabel('Motivazione (obbligatoria)').fill('Materiale che coinvolge minori.');
    await dialogo.getByLabel('Per confermare scrivi ESCALATION').fill('escalation');
    await dialogo.getByRole('button', { name: 'Conferma l’escalation' }).click();
    await expect(dialogo.getByText('Scrivi ESCALATION in maiuscolo per confermare.')).toBeVisible();
    expect(simulata.di('POST /rest/v1/rpc/escalation_flyer')).toHaveLength(0);
    await dialogo.getByLabel('Per confermare scrivi ESCALATION').fill('ESCALATION');
    await dialogo.getByRole('button', { name: 'Conferma l’escalation' }).click();
    await expect.poll(() => simulata.di('POST /rest/v1/rpc/escalation_flyer').length).toBe(1);
    expect(corpo(simulata, 'POST /rest/v1/rpc/escalation_flyer')).toMatchObject({
      caricamento: ID.flyerBozza,
      motivazione: 'Materiale che coinvolge minori.',
      conferma: 'ESCALATION',
    });
  });

  test('un flyer già deciso da un altro moderatore lo dice', async ({ page }) => {
    await apri(page);
    await page.goto('/moderazione/flyer/?id=00000000-0000-4000-8000-0000000000ff');
    await expect(page.getByText('Questo flyer è già stato deciso')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Vai al successivo' })).toBeVisible();
  });
});

test.describe('segnalazioni (R-53, R-69)', () => {
  test('la coda mostra priorità e tempo scritti, senza contenuto', async ({ page }) => {
    await apri(page);
    await page.goto('/moderazione/segnalazioni/');
    await expect(page.getByText('P1 · Rischio minore').first()).toBeVisible();
    await expect(page.getByText(/^2 h 1\d min$/)).toBeVisible();
    await expect(page.getByText(/Scade a breve/)).toBeVisible();
    await expect(page.getByText('In lavorazione · Moderatore Due')).toBeVisible();
    await expect(page.getByText('teo.m.night')).toHaveCount(0);
    await page.getByRole('button', { name: 'P2 · Minorenne' }).click();
    await expect(page.getByText('Adescamento o rischio per un minore')).toHaveCount(0);
  });

  test('il dettaglio dice che l’apertura è registrata e sfoca la foto', async ({ page }) => {
    await apri(page);
    await page.goto(`/moderazione/segnalazione/?id=${ID.segnalazioneP1}`);
    await expect(
      page.getByText(/L’apertura di questa segnalazione è stata registrata · Moderatore Uno/),
    ).toBeVisible();
    await expect(page.getByText('@teo.m.night')).toBeVisible();
    await expect(
      page.getByText('«Ha chiesto l’amicizia a mia sorella di 14 anni e le ha scritto altrove.»'),
    ).toBeVisible();
    await expect(
      page.getByText('L’identità di chi ha segnalato non è disponibile in quest’area.'),
    ).toBeVisible();
    await expect(page.getByRole('img', { name: 'Immagine segnalata' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Mostra', exact: true }).click();
    await expect(page.getByRole('img', { name: 'Immagine segnalata' })).toBeVisible();
    await expect(page.getByText('Altre segnalazioni sullo stesso oggetto · 1')).toBeVisible();
  });

  test('rimuovere la foto mostra le anteprime per chi ha segnalato e per chi è coinvolto', async ({
    page,
  }) => {
    const simulata = await apri(page);
    await page.goto(`/moderazione/segnalazione/?id=${ID.segnalazioneP1}`);
    await page.getByRole('button', { name: 'Rimuovi contenuto…' }).click();
    const dialogo = page.getByRole('dialog', { name: /Rimuovere contenuto da Teo M\./ });
    await expect(dialogo.getByRole('radio', { name: /Foto profilo/ })).toBeChecked();
    await dialogo.getByLabel('Motivazione (obbligatoria)').fill('Foto di un’altra persona.');
    await expect(dialogo.getByText('Abbiamo esaminato la tua segnalazione')).toBeVisible();
    await expect(dialogo.getByText('Abbiamo rimosso la tua foto profilo')).toBeVisible();
    await expect(
      dialogo.locator('.msg-anteprima').getByText('Foto di un’altra persona.'),
    ).toHaveCount(2);
    await dialogo.getByRole('button', { name: 'Rimuovi la foto' }).click();
    await expect.poll(() => simulata.di('POST /rest/v1/rpc/decidi_segnalazione').length).toBe(1);
    expect(corpo(simulata, 'POST /rest/v1/rpc/decidi_segnalazione')).toEqual({
      segnalazione: ID.segnalazioneP1,
      azione: 'rimuovi_contenuto',
      motivazione: 'Foto di un’altra persona.',
      contenuto: 'foto',
    });
  });

  test('"Prendi in carico" e segnalazione in carico a un altro', async ({ page }) => {
    const simulata = await apri(page);
    await page.goto(`/moderazione/segnalazione/?id=${ID.segnalazioneP1}`);
    await page.getByRole('button', { name: 'Prendi in carico' }).click();
    await expect
      .poll(() => simulata.di('POST /rest/v1/rpc/prendi_in_carico_segnalazione').length)
      .toBe(1);
    await page.goto(`/moderazione/segnalazione/?id=${ID.segnalazioneP2}`);
    await expect(page.getByText(/In carico a Moderatore Due/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nessuna violazione…' })).toBeDisabled();
    await expect(
      page.getByText('Pulsanti spenti: la segnalazione è in carico a Moderatore Due.'),
    ).toBeVisible();
  });
});

test.describe('reclami (DSA art. 20)', () => {
  test('chi ha preso la decisione non può decidere il reclamo', async ({ page }) => {
    await apri(page);
    await page.goto('/moderazione/reclami/');
    await page.getByRole('button', { name: /@giulia\.r/ }).click();
    await expect(page.getByRole('button', { name: 'Conferma la decisione…' })).toBeDisabled();
    await expect(page.getByText(/Hai preso tu la decisione contestata/)).toBeVisible();
  });

  test('cambiare la decisione chiede la motivazione e la mostra in anteprima', async ({ page }) => {
    const simulata = await apri(page);
    await page.goto('/moderazione/reclami/');
    await page.getByRole('button', { name: 'Cambia la decisione…' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Cambiare la decisione?' });
    await dialogo.getByLabel('Motivazione (obbligatoria)').fill('La data si legge bene.');
    await expect(dialogo.getByText('Abbiamo deciso sul tuo reclamo')).toBeVisible();
    await dialogo.getByRole('button', { name: 'Cambia la decisione' }).click();
    await expect.poll(() => simulata.di('POST /rest/v1/rpc/decidi_reclamo').length).toBe(1);
    expect(simulata.di('POST /rest/v1/rpc/esamina_reclamo')).toHaveLength(1);
    expect(corpo(simulata, 'POST /rest/v1/rpc/decidi_reclamo')).toEqual({
      reclamo: ID.reclamoAltrui,
      cambia: true,
      motivazione: 'La data si legge bene.',
    });
  });
});
