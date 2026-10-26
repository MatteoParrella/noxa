import {
  expect,
  ID_GRUPPO,
  ID_SERATA,
  impostaTema,
  PERSONE,
  TEMI,
  test,
  verificaAccessibilita,
} from './supporto';

// Gruppi e serate di gruppo (F-13…F-16, design/F-13-gruppi, design/F-14-serata).

const gruppo = `/gruppo/?id=${ID_GRUPPO}`;
const serata = `/serata/?id=${ID_SERATA}`;

for (const tema of TEMI) {
  test(`gruppi, crea, dettaglio, serata e proposta senza violazioni axe (${tema})`, async ({
    page,
  }) => {
    test.slow();
    await impostaTema(page, tema);
    await page.goto('/organizza/');
    await expect(page.getByRole('tab', { name: 'Gruppi' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('link', { name: /^Calcetto del giovedì/ })).toBeVisible();
    await expect(page.getByText('Marco ti invita in «Live del venerdì»')).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto('/gruppi/nuovo/');
    await expect(page.getByRole('checkbox', { name: /Davide/ })).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto(gruppo);
    await expect(page.getByRole('heading', { name: 'Calcetto del giovedì' })).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto(serata);
    await expect(page.getByRole('heading', { name: 'Pizza e poi da Marco' })).toBeVisible();
    await verificaAccessibilita(page);
    await page.goto(`/serata/nuova/?gruppo=${ID_GRUPPO}`);
    await expect(page.getByRole('radiogroup', { name: 'Tipo di serata' })).toBeVisible();
    await verificaAccessibilita(page);
  });
}

test('creare un gruppo: nome obbligatorio, amici non invitabili spenti con il motivo', async ({
  page,
  supabase,
}) => {
  await page.goto('/gruppi/nuovo/');
  await page.getByRole('button', { name: 'Crea il gruppo' }).click();
  await expect(page.getByText('Scrivi un nome per il gruppo.')).toBeVisible();
  expect(supabase.richieste.some((r) => r.endpoint === 'crea_gruppo')).toBe(false);

  // R-15: chi non è amico di tutti resta visibile ma non si può scegliere.
  const marta = page.getByRole('checkbox', { name: /Marta/ });
  await expect(marta).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText('Non è amico di tutte le persone del gruppo')).toBeVisible();
  await marta.click({ force: true });
  await expect(marta).toHaveAttribute('aria-checked', 'false');

  await page.getByLabel('Nome del gruppo').fill('Quelli del sabato');
  await page.getByRole('checkbox', { name: /Davide/ }).click();
  await expect(page.getByText('1 selezionato · 2/30')).toBeVisible();
  await page.getByRole('button', { name: 'Crea il gruppo' }).click();
  await expect(page).toHaveURL(new RegExp(`/gruppo/\\?id=${ID_GRUPPO}`));
  const richiesta = supabase.richieste.find((r) => r.endpoint === 'crea_gruppo');
  expect(richiesta?.corpo).toEqual({ nome: 'Quelli del sabato', invitati: [PERSONE.davide.id] });
});

test('creare un gruppo rifiutato dal database mostra il motivo (R-15)', async ({
  page,
  supabase,
}) => {
  supabase.rispondi('crea_gruppo', {
    stato: 400,
    corpo: { code: 'NX038', message: 'non invitabile', details: null, hint: null },
  });
  await page.goto('/gruppi/nuovo/');
  await page.getByLabel('Nome del gruppo').fill('Misto');
  await page.getByRole('checkbox', { name: /Davide/ }).click();
  await page.getByRole('button', { name: 'Crea il gruppo' }).click();
  await expect(
    page.getByText('Qualcuno tra gli amici scelti non si può più invitare', { exact: false }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/gruppi\/nuovo\/$/);
});

test('rispondere a una serata salva la risposta del solo utente', async ({ page, supabase }) => {
  await page.goto(serata);
  const risposta = page.getByRole('radiogroup', { name: 'La mia risposta' });
  await expect(risposta.getByRole('radio', { name: 'Sì' })).toHaveAttribute('aria-checked', 'true');
  await risposta.getByRole('radio', { name: 'Forse' }).click();
  await expect
    .poll(() => supabase.richieste.filter((r) => r.endpoint === 'partecipazioni_serata_salva'))
    .toHaveLength(1);
  const salvata = supabase.richieste.find((r) => r.endpoint === 'partecipazioni_serata_salva');
  expect(salvata?.corpo).toMatchObject({ serata_id: ID_SERATA, risposta: 'forse' });
});

test('«Guido» compare solo quando il database dice che si può guidare (F-16)', async ({
  page,
  supabase,
}) => {
  await page.goto(serata);
  const andata = page.getByRole('radiogroup', { name: 'Come vai?' });
  await expect(andata.getByRole('radio', { name: 'Mezzi pubblici' })).toBeVisible();
  await expect(andata.getByRole('radio', { name: 'Guido' })).toHaveCount(0);
  // L'auto di Marco resta visibile a tutti con i posti liberi.
  await expect(page.getByRole('heading', { name: 'Auto del gruppo' })).toBeVisible();

  supabase.possoGuidare = true;
  await page.reload();
  await expect(
    page.getByRole('radiogroup', { name: 'Come vai?' }).getByRole('radio', { name: 'Guido' }),
  ).toBeVisible();
});

test('proporre una serata libera controlla titolo e link https', async ({ page, supabase }) => {
  await page.goto(`/serata/nuova/?gruppo=${ID_GRUPPO}`);
  await page.getByRole('radio', { name: 'Serata libera' }).click();
  await page.getByLabel('Link alla lista').fill('http://binario7.example/lista');
  await page.getByRole('button', { name: 'Proponi' }).click();
  await expect(page.getByText('Scrivi un titolo per la serata.')).toBeVisible();
  await expect(page.getByText('Il link deve iniziare con https://')).toBeVisible();
  expect(supabase.richieste.some((r) => r.endpoint === 'serate_crea')).toBe(false);

  await page.getByLabel('Titolo della serata').fill('Pizza e poi da Marco');
  await page.getByLabel('Link alla lista').fill('https://binario7.example/lista');
  await page.getByRole('button', { name: 'Proponi' }).click();
  await expect(page.getByRole('heading', { name: 'Serata proposta' })).toBeVisible();
  const creata = supabase.richieste.find((r) => r.endpoint === 'serate_crea');
  expect(creata?.corpo).toMatchObject({
    gruppo_id: ID_GRUPPO,
    evento_id: null,
    titolo: 'Pizza e poi da Marco',
    url_lista: 'https://binario7.example/lista',
  });
});

test('le azioni in fondo ai moduli restano sopra la barra di navigazione', async ({ page }) => {
  for (const [indirizzo, nome] of [
    [`/serata/nuova/?gruppo=${ID_GRUPPO}`, 'Proponi'],
    ['/gruppi/nuovo/', 'Crea il gruppo'],
  ] as const) {
    await page.goto(indirizzo);
    const pulsante = page.getByRole('button', { name: nome, exact: true });
    await pulsante.scrollIntoViewIfNeeded();
    await expect(pulsante).toBeInViewport();
    // Il punto centrale del pulsante appartiene al pulsante, non alla barra fissa sopra.
    const libero = await pulsante.evaluate((elemento) => {
      const r = elemento.getBoundingClientRect();
      const sopra = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return sopra !== null && elemento.contains(sopra);
    });
    expect(libero).toBe(true);
  }
});
