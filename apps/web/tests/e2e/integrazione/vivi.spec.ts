import { expect, test, type Browser, type Page } from '@playwright/test';

// Check-in con Supabase locale reale e il seed (F-20, R-30): minore_15 e minore_16 sono amici,
// adulto_21 non conosce nessuno dei due.

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

async function impostaCheckin(pagina: Page, acceso: boolean) {
  await pagina.goto('/profilo/privacy/');
  const interruttore = pagina.getByRole('switch', { name: /Check-in «sono qui»/ });
  await expect(interruttore).toBeEnabled();
  if ((await interruttore.getAttribute('aria-checked')) !== String(acceso)) {
    await interruttore.click();
    const conferma = pagina.getByRole('dialog', { name: 'Spegnere il check-in?' });
    if (!acceso && (await conferma.isVisible())) {
      await conferma.getByRole('button', { name: 'Spegni' }).click();
    }
  }
  await expect(interruttore).toHaveAttribute('aria-checked', String(acceso));
}

test('R-30: il check-in arriva solo all’amico scelto e sparisce quando finisce', async ({
  browser,
}) => {
  test.slow();
  const io = await accedi(browser, 'minore_15@example.com');
  await impostaCheckin(io, true);

  await io.goto('/vivi/');
  await io.getByRole('button', { name: 'Fai check-in' }).click();
  const foglio = io.getByRole('dialog', { name: 'Fai check-in' });
  await foglio.getByRole('searchbox', { name: 'Oppure cerca un locale per nome' }).fill('binario');
  await foglio.getByRole('button', { name: /Club Binario 7/ }).click();
  await foglio.getByRole('button', { name: 'Continua' }).click();
  await foglio.getByRole('checkbox', { name: /Minore 16/ }).click();
  await foglio.getByRole('button', { name: 'Continua' }).click();
  await foglio.getByRole('button', { name: 'Fai check-in' }).click();
  await expect(io.getByRole('heading', { name: 'Club Binario 7' })).toBeVisible();

  const amico = await accedi(browser, 'minore_16@example.com');
  await amico.goto('/vivi/');
  await expect(amico.getByText('è a Club Binario 7')).toBeVisible();
  await amico.goto('/notifiche/');
  await expect(amico.getByText('Minore 15 è a Club Binario 7')).toBeVisible();

  const estraneo = await accedi(browser, 'adulto_21@example.com');
  await estraneo.goto('/vivi/');
  await expect(estraneo.getByRole('link', { name: 'Attiva il check-in' })).toBeVisible();
  await expect(estraneo.getByText('Club Binario 7')).toHaveCount(0);

  await io.getByRole('button', { name: 'Sono andato via' }).click();
  await expect(io.getByText('Check-in terminato. Nessuno lo vede più.')).toBeVisible();
  await amico.goto('/vivi/');
  await expect(amico.getByText('Nessun amico ha condiviso dove si trova.')).toBeVisible();
  await amico.goto('/notifiche/');
  await expect(amico.getByText('Check-in terminato', { exact: true })).toBeVisible();

  // Pulizia: le impostazioni tornano quelle del seed (R-30, spento).
  await impostaCheckin(io, false);
});
