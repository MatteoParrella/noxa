import { expect, test, type Browser, type Page } from '@playwright/test';

// Supabase locale reale con il seed: minore_16 e adulto_20 non si conoscono.

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

test('R-10 e R-12: un adulto non trova un minorenne, ma diventano amici con il codice', async ({
  browser,
}) => {
  test.slow();
  const adulto = await accedi(browser, 'adulto_20@example.com');
  await adulto.goto('/amici/cerca/');
  await adulto.getByRole('searchbox', { name: 'Username' }).fill('minore');
  await expect(adulto.getByText('Nessuno con questo username nella tua fascia')).toBeVisible();

  const minore = await accedi(browser, 'minore_16@example.com');
  await minore.goto('/amici/codice/');
  const codice = (await minore.locator('.codice').textContent())!.replace(/-/g, '');

  await adulto.goto(`/amici/invito/?c=${codice}`);
  await expect(adulto.getByText('@minore_16')).toBeVisible();
  await expect(adulto.getByText('Persona maggiorenne')).toHaveCount(0);
  await adulto.getByRole('button', { name: 'Invia richiesta' }).click();
  await expect(adulto.getByText('Richiesta inviata.')).toBeVisible();

  await minore.goto('/amici/');
  await minore.getByRole('link', { name: 'Vedi il profilo' }).click();
  // R-12: il minorenne vede l'avviso prima di accettare la persona maggiorenne.
  await expect(minore.getByText('Stai aggiungendo una persona maggiorenne')).toBeVisible();
  await minore.getByRole('button', { name: 'Accetta' }).click();
  await expect(minore.getByText('Amici', { exact: true }).last()).toBeVisible();

  await adulto.goto('/amici/');
  await expect(adulto.getByText('@minore_16')).toBeVisible();

  // R-17: il blocco fa sparire la persona in entrambe le direzioni.
  await minore.goto('/amici/');
  await minore.getByRole('button', { name: 'Altre azioni per @adulto_20' }).click();
  await minore.getByRole('menuitem', { name: 'Blocca' }).click();
  await minore.getByRole('dialog').getByRole('button', { name: 'Blocca' }).click();
  await adulto.goto('/amici/');
  await expect(adulto.getByText('@minore_16')).toHaveCount(0);

  // Pulizia: i test pgTAP partono dalle relazioni del seed (nessun blocco).
  await minore.goto('/profilo/bloccati/');
  await minore.getByRole('button', { name: /Sblocca/ }).first().click();
  await minore.getByRole('dialog').getByRole('button', { name: 'Sblocca' }).click();
  await expect(minore.getByText('@adulto_20')).toHaveCount(0);
});
