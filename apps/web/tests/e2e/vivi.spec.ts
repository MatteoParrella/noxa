import {
  checkinAmicoDiProva,
  expect,
  ID_CHECKIN,
  ID_CHECKIN_AMICO,
  impostaTema,
  LOCALI_DI_PROVA,
  mioCheckinDiProva,
  PERSONE,
  TEMI,
  test,
  verificaAccessibilita,
} from './supporto';

// Area Vivi e check-in "sono qui" (F-20, design/F-20-checkin): spento di default, solo il
// locale e mai la posizione del telefono, destinatari scelti tra gli amici confermati, 6 ore,
// fine in un tocco (R-30, R-43).

test.beforeEach(async ({ page }) => {
  // Il check-in non chiede mai la posizione del telefono: ogni richiesta resta registrata.
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
});

for (const tema of TEMI) {
  test(`Vivi e check-in senza violazioni axe (${tema})`, async ({ page, supabase }) => {
    test.slow();
    await impostaTema(page, tema);
    await page.goto('/vivi/');
    await expect(
      page.getByRole('heading', { name: 'Dì ad alcuni amici in quale locale sei' }),
    ).toBeVisible();
    await verificaAccessibilita(page);

    supabase.checkinAbilitato = true;
    supabase.checkinAmici = [checkinAmicoDiProva()];
    await page.goto('/vivi/');
    await page.getByRole('button', { name: 'Fai check-in' }).click();
    await expect(page.getByRole('radio', { name: /Vinili al Binario/ })).toBeVisible();
    await verificaAccessibilita(page, 'dialog[open]');
    await page.keyboard.press('Escape');

    supabase.mioCheckin = mioCheckinDiProva();
    await page.goto('/vivi/');
    await expect(page.getByRole('heading', { name: 'Club Binario 7' })).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto('/vivi/chi-lo-vede/');
    await expect(page.getByRole('heading', { name: 'Chi lo vede', level: 1 })).toBeVisible();
    await verificaAccessibilita(page);
  });
}

test('R-30: spento di default, si attiva solo da Privacy e dati', async ({ page }) => {
  await page.goto('/vivi/');
  await expect(page.getByText('Solo il locale', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fai check-in' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Attiva il check-in' }).click();
  await expect(page).toHaveURL(/\/profilo\/privacy\//);
  const interruttore = page.getByRole('switch', { name: /Check-in «sono qui»/ });
  await expect(interruttore).toHaveAttribute('aria-checked', 'false');
});

test('fare check-in: evento di stasera, amici della serata, riepilogo con la fine', async ({
  page,
  supabase,
}) => {
  supabase.checkinAbilitato = true;
  await page.goto('/vivi/');
  await expect(page.getByText('Nessun amico ha condiviso dove si trova.')).toBeVisible();
  await page.getByRole('button', { name: 'Fai check-in' }).click();
  const foglio = page.getByRole('dialog', { name: 'Fai check-in' });
  await expect(
    foglio.getByText('Non usiamo la posizione del telefono', { exact: false }),
  ).toBeVisible();
  await foglio.getByRole('radio', { name: /Vinili al Binario/ }).click();
  await foglio.getByRole('button', { name: 'Continua' }).click();

  // L'amico confermato della serata arriva già spuntato.
  await expect(foglio.getByText('Dalla serata Sabato al Binario 7')).toBeVisible();
  await expect(foglio.getByRole('checkbox', { name: /Marco/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await foglio.getByRole('button', { name: 'Continua' }).click();

  await expect(
    foglio.getByText(/Club Binario 7 · lo vedono Marco fino alle \d{2}:\d{2}\./),
  ).toBeVisible();
  await foglio.getByRole('button', { name: 'Fai check-in' }).click();
  await expect(page.getByText('Check-in fatto: lo vede 1 amico.').first()).toBeVisible();
  const invio = supabase.chiamate('fai_checkin').at(-1);
  expect(invio?.corpo).toEqual({
    locale: LOCALI_DI_PROVA.binario.id,
    evento: '00000000-0000-4000-8000-00000000e803',
    destinatari: [PERSONE.marco.id],
  });
  expect(
    await page.evaluate(
      () => (window as unknown as { __posizioneChiesta: number }).__posizioneChiesta,
    ),
  ).toBe(0);
});

test('un locale si cerca per nome; servono un locale e almeno un amico', async ({
  page,
  supabase,
}) => {
  supabase.checkinAbilitato = true;
  supabase.rispondi('suggerimenti_checkin', { stato: 200, corpo: { eventi: [], serate: [] } });
  await page.goto('/vivi/');
  await page.getByRole('button', { name: 'Fai check-in' }).click();
  const foglio = page.getByRole('dialog', { name: 'Fai check-in' });
  await expect(foglio.getByRole('button', { name: 'Continua' })).toBeDisabled();
  await foglio.getByRole('searchbox', { name: 'Oppure cerca un locale per nome' }).fill('sala');
  await foglio.getByRole('button', { name: /Sala Ventuno/ }).click();
  await expect(
    foglio.getByText('i tuoi amici vedono solo il locale', { exact: false }),
  ).toBeVisible();
  await foglio.getByRole('button', { name: 'Continua' }).click();
  // Nessun amico preselezionato senza una serata: niente "tutti gli amici" (R-30).
  await expect(foglio.getByRole('checkbox', { name: /Marco/ })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await expect(foglio.getByRole('button', { name: 'Continua' })).toBeDisabled();
  await foglio.getByRole('checkbox', { name: /Marco/ }).click();
  await foglio.getByRole('button', { name: 'Continua' }).click();
  await foglio.getByRole('button', { name: 'Fai check-in' }).click();
  expect(supabase.chiamate('fai_checkin').at(-1)?.corpo).toMatchObject({
    locale: LOCALI_DI_PROVA.ventuno.id,
    evento: null,
  });
});

test('check-in spento nel frattempo: lo dice e porta a Privacy e dati', async ({
  page,
  supabase,
}) => {
  supabase.checkinAbilitato = true;
  supabase.rispondi('fai_checkin', {
    stato: 400,
    corpo: { code: 'NX049', message: 'Il check-in è disattivato nelle impostazioni.' },
  });
  await page.goto('/vivi/');
  await page.getByRole('button', { name: 'Fai check-in' }).click();
  const foglio = page.getByRole('dialog', { name: 'Fai check-in' });
  await foglio.getByRole('radio', { name: /Vinili al Binario/ }).click();
  await foglio.getByRole('button', { name: 'Continua' }).click();
  await foglio.getByRole('button', { name: 'Continua' }).click();
  await foglio.getByRole('button', { name: 'Fai check-in' }).click();
  await expect(foglio.getByText('Il check-in è stato spento')).toBeVisible();
  await expect(foglio.getByRole('link', { name: 'Vai a Privacy e dati' })).toBeVisible();
});

test('il check-in attivo mostra gli orari e termina in un tocco', async ({ page, supabase }) => {
  supabase.checkinAbilitato = true;
  supabase.mioCheckin = mioCheckinDiProva();
  await page.goto('/vivi/');
  await expect(page.getByText(/^Dalle \d{2}:\d{2}$/)).toBeVisible();
  await expect(page.getByText(/^Fino alle \d{2}:\d{2}$/)).toBeVisible();
  await expect(page.getByText('Lo vedono 2 amici')).toBeVisible();
  supabase.mioCheckin = null;
  await page.getByRole('button', { name: 'Sono andato via' }).click();
  await expect(page.getByText('Check-in terminato. Nessuno lo vede più.')).toBeVisible();
  const fine = supabase.chiamate('checkin_aggiorna').at(-1);
  expect(fine?.url).toContain(`id=eq.${ID_CHECKIN}`);
  expect(fine?.corpo).toHaveProperty('terminato_il');
});

test('chi lo vede: togliere una persona, poi l’ultima termina il check-in', async ({
  page,
  supabase,
}) => {
  supabase.checkinAbilitato = true;
  supabase.mioCheckin = mioCheckinDiProva();
  await page.goto('/vivi/chi-lo-vede/');
  await page.getByRole('button', { name: 'Togli Davide' }).click();
  await expect(page.getByText('Togliere Davide?')).toBeVisible();
  supabase.mioCheckin = mioCheckinDiProva([PERSONE.marco]);
  await page.getByRole('button', { name: 'Togli', exact: true }).click();
  await expect(page.getByText('Davide non vede più il tuo check-in.')).toBeVisible();
  expect(supabase.chiamate('checkin_destinatari_elimina').at(-1)?.url).toContain(
    `amico_id=eq.${PERSONE.davide.id}`,
  );

  await page.getByRole('button', { name: 'Togli Marco' }).click();
  await expect(page.getByText('È l’ultima persona', { exact: false })).toBeVisible();
  supabase.mioCheckin = null;
  await page.getByRole('button', { name: 'Togli e termina' }).click();
  await expect(page.getByText('Nessun check-in attivo')).toBeVisible();
  expect(supabase.chiamate('checkin_aggiorna')).toHaveLength(1);
});

test('amici in giro stasera: nome, locale e da quando', async ({ page, supabase }) => {
  supabase.checkinAbilitato = true;
  supabase.checkinAmici = [checkinAmicoDiProva()];
  await page.goto('/vivi/');
  const riga = page.getByRole('link', { name: /Marco.*è a Club Binario 7/ });
  await expect(riga).toBeVisible();
  await expect(riga).toContainText(/Dalle \d{2}:\d{2}/);
  await expect(riga).toHaveAttribute('href', /\/evento\/\?id=/);
});

test('offline il check-in non parte e lo dice', async ({ page, context, supabase }) => {
  supabase.checkinAbilitato = true;
  await page.goto('/vivi/');
  await expect(page.getByRole('button', { name: 'Fai check-in' })).toBeEnabled();
  await context.setOffline(true);
  await expect(page.getByRole('button', { name: 'Fai check-in' })).toBeDisabled();
  await expect(page.getByText('Senza rete il check-in non parte', { exact: false })).toBeVisible();
  await context.setOffline(false);
});

test('spegnere il check-in con uno attivo: prima il foglio, poi termina', async ({
  page,
  supabase,
}) => {
  supabase.checkinAbilitato = true;
  supabase.mioCheckin = mioCheckinDiProva();
  await page.goto('/profilo/privacy/');
  const interruttore = page.getByRole('switch', { name: /Check-in «sono qui»/ });
  await expect(interruttore).toHaveAttribute('aria-checked', 'true');
  await interruttore.click();
  const foglio = page.getByRole('dialog', { name: 'Spegnere il check-in?' });
  await expect(
    foglio.getByText('Quello attivo a Club Binario 7 termina subito', { exact: false }),
  ).toBeVisible();
  // Il database salva la scelta e termina il check-in: la rilettura lo restituisce.
  supabase.checkinAbilitato = false;
  supabase.mioCheckin = null;
  await foglio.getByRole('button', { name: 'Spegni' }).click();
  await expect(interruttore).toHaveAttribute('aria-checked', 'false');
  expect(supabase.chiamate('profili_privati').at(-1)?.corpo).toEqual({ checkin_abilitato: false });
});

test('notifica di un check-in: attivo con il locale, poi «Check-in terminato»', async ({
  page,
  supabase,
}) => {
  const notifica = (id: string, checkin: string) => ({
    id,
    tipo: 'checkin_amico',
    dati: { checkin_id: checkin, utente_id: PERSONE.marco.id },
    letta_il: null,
    creata_il: new Date().toISOString(),
  });
  supabase.checkinAmici = [checkinAmicoDiProva()];
  supabase.notifiche = [
    notifica('00000000-0000-4000-8000-00000000e811', ID_CHECKIN_AMICO),
    notifica('00000000-0000-4000-8000-00000000e812', '00000000-0000-4000-8000-00000000e899'),
  ];
  await page.goto('/notifiche/');
  await expect(page.getByText('Marco è a Club Binario 7')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Vedi locale' })).toBeVisible();
  await expect(page.getByText('Check-in terminato', { exact: true })).toBeVisible();
});

test('i suggerimenti di stasera si scelgono anche con le frecce', async ({ page, supabase }) => {
  supabase.checkinAbilitato = true;
  await page.goto('/vivi/');
  await page.getByRole('button', { name: 'Fai check-in' }).click();
  const foglio = page.getByRole('dialog', { name: 'Fai check-in' });
  const evento = foglio.getByRole('radio', { name: /Vinili al Binario/ });
  const serata = foglio.getByRole('radio', { name: /Serata di gruppo/ });
  await evento.focus();
  await page.keyboard.press('ArrowDown');
  await expect(serata).toBeFocused();
  await expect(serata).toHaveAttribute('aria-checked', 'true');
  await expect(evento).toHaveAttribute('tabindex', '-1');
});
