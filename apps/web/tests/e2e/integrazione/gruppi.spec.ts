import { expect, test, type Browser, type Page } from '@playwright/test';

// Supabase locale reale con il seed: adulto_18 e minore_17 sono amici con il codice (R-12),
// adulto_21 non conosce minore_17. Nomi dei gruppi unici, così il test si può ripetere.

async function accedi(browser: Browser, email: string): Promise<Page> {
  const contesto = await browser.newContext({ serviceWorkers: 'block' });
  const pagina = await contesto.newPage();
  await pagina.goto('/accesso/');
  await pagina.getByLabel('Email').fill(email);
  await pagina.getByLabel('Password', { exact: true }).fill('password-di-prova');
  await pagina.getByRole('button', { name: 'Accedi' }).click();
  await expect(pagina).toHaveURL(/\/scopri\/$/);
  return pagina;
}

/** adulto_18 e adulto_21 diventano amici (stessa fascia), se non lo sono già. */
async function rendiAmici(adulto18: Page, adulto21: Page) {
  await adulto18.goto('/amici/cerca/');
  await adulto18.getByRole('searchbox', { name: 'Username' }).fill('adulto_21');
  await expect(adulto18.getByText('@adulto_21')).toBeVisible();
  const aggiungi = adulto18.getByRole('button', { name: 'Aggiungi' });
  if ((await aggiungi.count()) === 0) return;
  await aggiungi.click();
  await expect(adulto18.getByText('Richiesta inviata')).toBeVisible();
  await adulto21.goto('/amici/');
  await expect(adulto21.getByText('@adulto_18')).toBeVisible();
  await adulto21.getByRole('button', { name: 'Accetta' }).first().click();
  await expect(adulto21.getByRole('button', { name: 'Accetta' })).toHaveCount(0);
}

test('R-15: gruppo misto valido tra amici, invito rifiutato a chi non è amico del minorenne, risposte dal vivo', async ({
  browser,
}) => {
  test.slow();
  const nome = `Mista ${Date.now().toString(36)}`;
  const adulto = await accedi(browser, 'adulto_18@example.com');
  const amico = await accedi(browser, 'adulto_21@example.com');
  await rendiAmici(adulto, amico);

  // Gruppo misto valido: adulto_18 e minore_17 sono amici confermati.
  await adulto.goto('/gruppi/nuovo/');
  await adulto.getByLabel('Nome del gruppo').fill(nome);
  await adulto.getByRole('checkbox', { name: /Minore 17/ }).click();
  await adulto.getByRole('button', { name: 'Crea il gruppo' }).click();
  await expect(adulto.getByRole('heading', { name: nome })).toBeVisible();
  const indirizzoGruppo = adulto.url();

  // Gruppo misto rifiutato: adulto_21 non è amico di minore_17, quindi non è invitabile.
  await adulto.getByRole('button', { name: 'Invita amici' }).click();
  const foglio = adulto.getByRole('dialog');
  const adulto21 = foglio.getByRole('checkbox', { name: /Adulto 21/ });
  await expect(adulto21).toHaveAttribute('aria-disabled', 'true');
  await expect(foglio.getByText('Non è amico di tutte le persone del gruppo')).toBeVisible();
  await adulto21.click({ force: true });
  await expect(adulto21).toHaveAttribute('aria-checked', 'false');
  await adulto.keyboard.press('Escape');

  // minore_17 accetta l'invito.
  const minore = await accedi(browser, 'minore_17@example.com');
  await minore.goto('/organizza/');
  const invito = minore.getByRole('listitem').filter({ hasText: `«${nome}»` });
  await invito.getByRole('button', { name: 'Accetta' }).click();
  await expect(minore.getByText(`Sei entrato in «${nome}»`)).toBeVisible();

  // Serata libera proposta da adulto_18.
  await adulto.goto(indirizzoGruppo);
  await adulto.getByRole('link', { name: 'Proponi una serata' }).click();
  await adulto.getByRole('radio', { name: 'Serata libera' }).click();
  await adulto.getByLabel('Titolo della serata').fill('Pizza tutti insieme');
  await adulto.getByRole('button', { name: 'Proponi' }).click();
  await adulto.getByRole('link', { name: 'Apri la serata' }).click();
  await expect(adulto.getByRole('heading', { name: 'Pizza tutti insieme' })).toBeVisible();
  await expect(adulto.getByText('0 sì · 0 forse · 0 no')).toBeVisible();

  // Il minorenne non vede «Guido» (F-16); la sua risposta arriva all'altra sessione dal vivo.
  await minore.goto(adulto.url().replace(/^https?:\/\/[^/]+/, ''));
  await expect(minore.getByRole('heading', { name: 'Pizza tutti insieme' })).toBeVisible();
  await minore
    .getByRole('radiogroup', { name: 'La mia risposta' })
    .getByRole('radio', { name: 'Sì' })
    .click();
  await expect(
    minore.getByRole('radiogroup', { name: 'Come vai?' }).getByRole('radio', { name: 'Guido' }),
  ).toHaveCount(0);
  await expect(adulto.getByText('1 sì · 0 forse · 0 no')).toBeVisible({ timeout: 15_000 });
});
