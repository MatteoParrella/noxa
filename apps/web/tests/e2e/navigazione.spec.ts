import { expect, ID_GRUPPO, impostaTema, TEMI, test, verificaAccessibilita } from './supporto';

// Il titolo grande di ogni area è il nome dell'area nella barra (iterazione 12); Ricorda si apre
// sul diario e Vivi su «Stasera», scritti sopra il titolo.
const AREE = [
  { percorso: '/scopri/', nome: 'Scopri', titolo: 'Scopri' },
  { percorso: '/organizza/', nome: 'Organizza', titolo: 'Organizza' },
  { percorso: '/vivi/', nome: 'Vivi', titolo: 'Vivi' },
  { percorso: '/ricorda/', nome: 'Ricorda', titolo: 'Ricorda' },
  { percorso: '/profilo/', nome: 'Profilo', titolo: 'Profilo' },
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
        await expect(page.getByRole('heading', { level: 1, name: area.titolo })).toBeVisible();
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

test('«indietro» torna alla pagina da cui si è arrivati, altrimenti alla pagina madre', async ({
  page,
}) => {
  // Da un gruppo a una persona: si torna al gruppo, non ad Amici.
  await page.goto(`/gruppo/?id=${ID_GRUPPO}`);
  await expect(page.getByRole('heading', { name: 'Calcetto del giovedì' })).toBeVisible();
  await page.locator('a.mb-nome').first().click();
  await expect(page).toHaveURL(/\/persona\/\?id=/);
  const contenuto = page.getByRole('main');
  const indietro = contenuto.getByRole('link', { name: 'Indietro: Gruppo' });
  await expect(indietro).toBeVisible();
  await indietro.click();
  await expect(page).toHaveURL(new RegExp(`/gruppo/\\?id=${ID_GRUPPO}`));
  // Il gruppo si è aperto da un indirizzo diretto: il suo «indietro» porta a Organizza.
  await contenuto.getByRole('link', { name: 'Indietro: Organizza' }).click();
  await expect(page).toHaveURL(/\/organizza\/$/);
  // Una pagina aperta direttamente usa la pagina madre.
  await page.evaluate(() => sessionStorage.clear());
  await page.goto('/amici/cerca/');
  await contenuto.getByRole('link', { name: 'Indietro: Amici' }).click();
  await expect(page).toHaveURL(/\/amici\/$/);
});

test('un indirizzo che non esiste mostra la pagina 404 con il ritorno a Scopri', async ({
  page,
}) => {
  await page.goto('/pagina-che-non-esiste/');
  await expect(page.getByRole('heading', { name: 'Questa pagina non esiste' })).toBeVisible();
  await verificaAccessibilita(page);
  await page.getByRole('link', { name: 'Vai a Scopri' }).click();
  await expect(page).toHaveURL(/\/scopri\/$/);
});

test('l’anteprima dei link condivisi ha titolo, descrizione e immagine', async ({ page }) => {
  await page.goto('/benvenuto/');
  // React può ripetere i meta nel documento dopo l'aggancio: basta il primo.
  await expect(page.locator('meta[property="og:title"]').first()).toHaveAttribute(
    'content',
    'Noxa',
  );
  await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute(
    'content',
    /\/icone\/anteprima\.png$/,
  );
  const robots = await page.request.get('/robots.txt');
  expect(await robots.text()).toContain('Disallow: /');
});
