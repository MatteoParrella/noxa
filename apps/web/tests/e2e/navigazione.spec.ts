import { expect, impostaTema, TEMI, test, verificaAccessibilita } from './supporto';

const AREE = [
  { percorso: '/scopri/', nome: 'Scopri' },
  { percorso: '/organizza/', nome: 'Organizza' },
  { percorso: '/vivi/', nome: 'Vivi' },
  { percorso: '/ricorda/', nome: 'Ricorda' },
  { percorso: '/profilo/', nome: 'Profilo' },
] as const;

test('la home apre Scopri', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/scopri\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Scopri' })).toBeVisible();
});

for (const tema of TEMI) {
  test.describe(`tema ${tema}`, () => {
    test.beforeEach(async ({ page }) => {
      await impostaTema(page, tema);
    });

    for (const area of AREE) {
      test(`${area.nome}: navigazione e accessibilità`, async ({ page }) => {
        await page.goto(area.percorso);
        await expect(page.locator('html')).toHaveAttribute('lang', 'it');
        if (tema === 'chiaro')
          await expect(page.locator('html')).toHaveAttribute('data-tema', 'chiaro');
        await expect(page.getByRole('heading', { level: 1, name: area.nome })).toBeVisible();
        const navigazione = page.getByRole('navigation', { name: 'Principale' });
        await expect(navigazione.getByRole('link', { name: area.nome })).toHaveAttribute(
          'aria-current',
          'page',
        );
        await verificaAccessibilita(page);
      });
    }
  });
}

test('la barra porta da un’area all’altra e il link “Vai al contenuto” è il primo elemento', async ({
  page,
}) => {
  await page.goto('/scopri/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Vai al contenuto' })).toBeFocused();
  await page
    .getByRole('navigation', { name: 'Principale' })
    .getByRole('link', { name: 'Ricorda' })
    .click();
  await expect(page).toHaveURL(/\/ricorda\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Ricorda' })).toBeVisible();
});

test('il tema chiaro scelto nel profilo resta dopo il ricaricamento', async ({ page }) => {
  await page.goto('/profilo/');
  const interruttore = page.getByRole('switch', { name: 'Tema chiaro' });
  await expect(interruttore).toHaveAttribute('aria-checked', 'false');
  await interruttore.click();
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'chiaro');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'chiaro');
  await expect(page.getByRole('switch', { name: 'Tema chiaro' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});
