import { expect, impostaTema, TEMI, test, verificaAccessibilita } from './supporto';

// Scopri senza account sul sito (D-18, ADR-0036): elenco ridotto, ogni clic porta all'iscrizione.
test.use({ account: null });

test.describe('elenco pubblico delle serate', () => {
  for (const tema of TEMI) {
    test(`senza account si vedono le serate, senza violazioni axe (${tema})`, async ({ page }) => {
      await impostaTema(page, tema);
      await page.goto('/scopri/');
      await expect(page).toHaveURL(/\/scopri\/$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Scopri' })).toBeVisible();
      await expect(page.getByRole('link', { name: /^Notte Ferrovia, Binario 7/ })).toBeVisible();
      await verificaAccessibilita(page);
    });
  }

  test('R-23: una serata con riferimenti all’alcol non mostra il titolo', async ({ page }) => {
    await page.goto('/scopri/');
    const riservata = page.getByRole('link', { name: /^Serata 18\+, Magazzino Nove/ });
    await expect(riservata).toBeVisible();
    await expect(riservata).toContainText('La vedi con un account maggiorenne.');
    // La serata con il titolo va in evidenza, quella riservata resta una riga.
    await expect(page.locator('.evidenza')).toContainText('Notte Ferrovia');
  });

  test('un clic su una serata porta all’iscrizione e ricorda la serata', async ({ page }) => {
    await page.goto('/scopri/');
    await page.getByRole('link', { name: /^Notte Ferrovia, Binario 7/ }).click();
    await expect(page).toHaveURL(/\/registrazione\/$/);
    expect(await page.evaluate(() => window.sessionStorage.getItem('noxa-dopo-accesso'))).toBe(
      '/evento/?id=00000000-0000-4000-8000-00000000e001',
    );
  });

  test('un clic su un’altra area porta all’iscrizione', async ({ page }) => {
    await page.goto('/scopri/');
    await expect(page.getByRole('link', { name: /^Notte Ferrovia/ })).toBeVisible();
    await page.getByRole('link', { name: 'Organizza' }).first().click();
    await expect(page).toHaveURL(/\/registrazione\/$/);
  });

  test('«Entra» apre l’accesso', async ({ page }) => {
    await page.goto('/scopri/');
    await page.getByRole('link', { name: 'Entra', exact: true }).click();
    await expect(page).toHaveURL(/\/accesso\/$/);
  });

  test('l’elenco pubblico non chiede dati degli utenti', async ({ page, supabase }) => {
    await page.goto('/scopri/');
    await expect(page.getByRole('link', { name: /^Notte Ferrovia/ })).toBeVisible();
    expect(supabase.chiamate('cerca_eventi_pubblici')).toHaveLength(1);
    expect(supabase.chiamate('mio_account')).toHaveLength(0);
  });

  test('«Vai al contenuto» e la scheda Scopri non portano all’iscrizione', async ({ page }) => {
    await page.goto('/scopri/');
    await expect(page.getByRole('link', { name: /^Notte Ferrovia/ })).toBeVisible();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/scopri\/(#contenuto)?$/);
    await page.getByRole('link', { name: 'Scopri' }).first().click();
    await expect(page).toHaveURL(/\/scopri\/(#contenuto)?$/);
  });
});
