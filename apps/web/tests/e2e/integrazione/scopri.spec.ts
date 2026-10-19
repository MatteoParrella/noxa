import { expect, test, type Browser, type Page } from '@playwright/test';

// Supabase locale reale con il seed (supabase/seed.sql): eventi di domani e14+ a un locale
// non attivo, e004 16+, e005 18+, e010 in revisione; e001 18+, e008 con alcol, e012 14+.
// Amici: minore_15 e minore_16, adulto_20 e adulto_21.

const evento = (numero: string) => `/evento/?id=00000000-0000-4000-8000-00000000e${numero}`;
const NON_DISPONIBILE = 'Questo evento non c’è più o non è adatto alla tua età';

async function accedi(browser: Browser, utente: string): Promise<Page> {
  const contesto = await browser.newContext({ serviceWorkers: 'block' });
  const pagina = await contesto.newPage();
  await pagina.goto('/accesso/');
  await pagina.getByLabel('Email').fill(`${utente}@example.com`);
  await pagina.getByLabel('Password', { exact: true }).fill('password-di-prova');
  await pagina.getByRole('button', { name: 'Accedi' }).click();
  await expect(pagina).toHaveURL(/\/scopri\/$/);
  return pagina;
}

test('R-20, R-23: ognuno vede solo gli eventi a cui può entrare', async ({ browser }) => {
  test.slow();
  const minore = await accedi(browser, 'minore_16');
  await minore.getByRole('radio', { name: 'Domani' }).click();
  await expect(minore.getByRole('link', { name: /Indie al Binario/ })).toBeVisible();
  await expect(minore.getByRole('link', { name: /Reggaeton Night/ })).toHaveCount(0);
  await expect(minore.getByRole('link', { name: /Chiusura Navile|Sotto Cassa/ })).toHaveCount(0);
  for (const numero of ['001', '008']) {
    await minore.goto(evento(numero));
    await expect(minore.getByRole('heading', { name: NON_DISPONIBILE })).toBeVisible();
  }

  const adulto = await accedi(browser, 'adulto_20');
  await adulto.getByRole('radio', { name: 'Domani' }).click();
  await expect(adulto.getByRole('link', { name: /Reggaeton Night/ })).toBeVisible();
  await expect(adulto.getByRole('link', { name: /Indie al Binario/ })).toBeVisible();
  await adulto.goto(evento('008'));
  await expect(
    adulto.getByRole('heading', { level: 1, name: 'Elettronica al Magazzino' }),
  ).toBeVisible();
  // R-20 vale anche per gli adulti: niente 21+ a chi ha 20 anni.
  await adulto.goto(evento('007'));
  await expect(adulto.getByRole('heading', { name: NON_DISPONIBILE })).toBeVisible();
});

test('R-67: la partecipazione si vede solo dagli amici e solo se resa visibile', async ({
  browser,
}) => {
  test.slow();
  const chiPartecipa = await accedi(browser, 'minore_16');
  await chiPartecipa.goto(evento('012'));
  await chiPartecipa.getByRole('button', { name: 'Partecipo' }).click();
  await expect(chiPartecipa.getByText('Segnato: partecipi', { exact: true })).toBeVisible();

  const amico = await accedi(browser, 'minore_15');
  await amico.goto(evento('012'));
  await expect(amico.getByRole('button', { name: 'Minore ci va' })).toBeVisible();

  const sconosciuto = await accedi(browser, 'minore_14');
  await sconosciuto.goto(evento('012'));
  await expect(
    sconosciuto.getByRole('heading', { level: 1, name: 'Pomeriggio in Cascina' }),
  ).toBeVisible();
  await expect(sconosciuto.getByText(/ci va/)).toHaveCount(0);

  await chiPartecipa.reload();
  await chiPartecipa.getByRole('switch', { name: 'Visibile ai tuoi amici' }).click();
  await expect(chiPartecipa.getByText('Ora è solo per te')).toBeVisible();
  await amico.reload();
  await expect(
    amico.getByRole('heading', { level: 1, name: 'Pomeriggio in Cascina' }),
  ).toBeVisible();
  await expect(amico.getByText(/ci va/)).toHaveCount(0);

  // Si toglie la scelta in un tocco: il database torna com'era.
  await chiPartecipa.getByRole('button', { name: 'Partecipo' }).click();
  await expect(chiPartecipa.getByText('Scelta tolta')).toBeVisible();
});
