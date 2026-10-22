import { attendiAnimazioni, expect, test, verificaAccessibilita } from './supporto';

test.describe('movimento espressivo (ADR-0019)', () => {
  test('titolo, contenuto e indicatore si animano e arrivano allo stato finale', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/organizza/');
    await expect(page.locator('html')).toHaveClass(/movimento/);

    const titolo = page.getByRole('heading', { level: 1, name: 'Organizza' });
    await expect(titolo).toBeVisible();
    const parola = titolo.locator('.parola > span').first();
    const animazioni = await parola.evaluate((el) =>
      el.getAnimations().map((a) => (a instanceof CSSAnimation ? a.animationName : '')),
    );
    expect(animazioni).toContain('sale');
    // Le parole del titolo restano nel carattere editoriale (nessuna classe globale le cambia).
    await expect(titolo.locator('.parola').first()).toHaveCSS('font-family', /^"Archivo Variable"/);

    const contenuto = page.locator('.rivela').first();
    await expect(contenuto).toHaveClass(/is-visibile/);
    await attendiAnimazioni(page);
    await expect(contenuto).toHaveCSS('opacity', '1');

    const indicatore = page.locator('.nav-indicatore');
    await expect(indicatore).toHaveAttribute('style', /--indice:\s*1/);
    await page
      .getByRole('navigation', { name: 'Principale' })
      .getByRole('link', { name: 'Ricorda' })
      .click();
    await expect(indicatore).toHaveAttribute('style', /--indice:\s*3/);
    await verificaAccessibilita(page);
  });

  test('con “riduci movimento” niente spostamenti né animazioni', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/vivi/');
    const parola = page
      .getByRole('heading', { level: 1, name: 'Vivi' })
      .locator('.parola > span')
      .first();
    await expect(parola).toHaveCSS('transform', 'none');
    expect(await parola.evaluate((el) => el.getAnimations().length)).toBe(0);
    const contenuto = page.locator('.rivela').first();
    await expect(contenuto).toHaveClass(/is-visibile/);
    await expect(contenuto).toHaveCSS('transform', 'none');
    await expect(contenuto).toHaveCSS('filter', 'none');
  });

  test('i titoli animati restano leggibili come testo unico dai lettori di schermo', async ({
    page,
  }) => {
    await page.goto('/ricorda/');
    await expect(page.getByRole('heading', { level: 1, name: 'Ricorda' })).toBeVisible();
  });
});
