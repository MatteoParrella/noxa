import { expect, test } from '@playwright/test';
import { impostaTema, TEMI, verificaAccessibilita } from './supporto';

// Il catalogo esiste solo in sviluppo e nella build dei test (NOXA_CATALOGO=1).
for (const tema of TEMI) {
  test(`catalogo dei componenti senza violazioni axe (pagina in tema ${tema})`, async ({
    page,
  }) => {
    await impostaTema(page, tema);
    await page.goto('/catalogo/');
    await expect(page.getByRole('region', { name: 'Tema scuro' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Tema chiaro' })).toBeVisible();
    await verificaAccessibilita(page);
  });
}

test('il foglio si apre, tiene il focus e si chiude con Esc', async ({ page }) => {
  await page.goto('/catalogo/');
  const sezione = page.getByRole('region', { name: 'Tema scuro' });
  const apri = sezione.getByRole('button', { name: 'Apri il foglio' });
  await apri.click();
  const dialogo = page.getByRole('dialog', { name: 'Filtri' });
  await expect(dialogo).toBeVisible();
  await verificaAccessibilita(page);
  await page.keyboard.press('Escape');
  await expect(dialogo).toBeHidden();
  await expect(apri).toBeFocused();
});
