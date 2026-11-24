import { attendiAnimazioni, expect, test, verificaAccessibilita } from './supporto';

test.describe('movimento breve a molla (ADR-0035)', () => {
  test('titolo fermo nel carattere di sistema, contenuto visibile, capsula della scheda che si sposta', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/organizza/');
    await expect(page.locator('html')).toHaveClass(/movimento/);

    // Il titolo grande non sale più parola per parola ed è nel carattere di sistema.
    const titolo = page.getByRole('heading', { level: 1, name: 'Organizza' });
    await expect(titolo).toBeVisible();
    expect(await titolo.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
    await expect(titolo).toHaveCSS('font-family', /^-apple-system,/);

    const contenuto = page.locator('.rivela').first();
    await expect(contenuto).toHaveClass(/is-visibile/);
    await attendiAnimazioni(page);
    await expect(contenuto).toHaveCSS('opacity', '1');

    // La capsula della scheda attiva scivola con una transizione breve sulla trasformazione.
    const indicatore = page.locator('.nav-indicatore');
    await expect(indicatore).toHaveAttribute('style', /--indice:\s*1/);
    await expect(indicatore).toHaveCSS('transition-property', /transform/);
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
    const titolo = page.getByRole('heading', { level: 1, name: 'Vivi' });
    await expect(titolo).toBeVisible();
    expect(await titolo.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
    const contenuto = page.locator('.rivela').first();
    await expect(contenuto).toHaveClass(/is-visibile/);
    await expect(contenuto).toHaveCSS('transform', 'none');
    await expect(contenuto).toHaveCSS('filter', 'none');
    // La capsula della barra delle schede cambia posto senza scivolare.
    await expect(page.locator('.nav-indicatore')).not.toHaveCSS('transition-property', /transform/);
  });

  test('i titoli restano leggibili come testo unico dai lettori di schermo', async ({ page }) => {
    await page.goto('/ricorda/');
    await expect(page.getByRole('heading', { level: 1, name: 'Ricorda' })).toBeVisible();
  });
});

test.describe('schermata di apertura', () => {
  test.use({ apertura: true });

  test('compare una volta per sessione, non blocca i tocchi e si dissolve da sola', async ({
    page,
  }) => {
    await page.goto('/scopri/');
    const apertura = page.locator('.apertura');
    // La dissolvenza è un'animazione CSS che parte da sola: si controlla che ci sia, non il
    // momento in cui è visibile (su WebKit la pagina si aggancia quando è già finita).
    await expect(apertura).toHaveCSS('position', 'fixed');
    await expect(apertura).toHaveCSS('animation-name', 'apertura-esci');
    await expect(apertura).toHaveAttribute('aria-hidden', 'true');
    await expect(apertura).toHaveCSS('pointer-events', 'none');
    await expect(apertura).toBeHidden({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Scopri', level: 1 })).toBeVisible();

    // Stessa sessione: alla pagina successiva non si ripete.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-apertura', 'vista');
    await expect(apertura).toHaveCSS('display', 'none');
  });

  test('con il movimento ridotto non compare', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/scopri/');
    await expect(page.locator('.apertura')).toBeHidden();
  });
});
