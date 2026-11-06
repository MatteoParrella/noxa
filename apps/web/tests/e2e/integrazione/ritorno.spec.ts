import { expect, test, type Browser, type Page } from '@playwright/test';

// Ritorno sicuro con Supabase locale reale e il seed (F-21, R-31): minore_15 e minore_16 sono
// amici, adulto_21 non conosce nessuno dei due. La posizione è quella simulata dal browser.

async function accedi(browser: Browser, email: string, conPosizione = false): Promise<Page> {
  const contesto = await browser.newContext({
    serviceWorkers: 'block',
    ...(conPosizione
      ? {
          permissions: ['geolocation'],
          geolocation: { latitude: 45.5845, longitude: 9.2744, accuracy: 30 },
        }
      : {}),
  });
  const pagina = await contesto.newPage();
  await pagina.goto('/accesso/');
  await pagina.getByLabel('Email').fill(email);
  await pagina.getByLabel('Password', { exact: true }).fill('password-di-prova');
  await pagina.getByRole('button', { name: 'Accedi' }).click();
  await expect(pagina).toHaveURL(/\/scopri\/$/);
  return pagina;
}

test('R-31: il ritorno arriva solo all’amico scelto, con la posizione, e finisce con "Sono arrivato"', async ({
  browser,
}) => {
  test.slow();
  const io = await accedi(browser, 'minore_15@example.com', true);
  await io.goto('/vivi/');
  // Una corsa interrotta può aver lasciato un ritorno attivo: si conclude prima di iniziare.
  const rimasto = io.getByRole('article').getByRole('button', { name: 'Sono arrivato' });
  const invito = io.getByRole('heading', { name: 'Torni a casa?' });
  await expect(invito.or(rimasto)).toBeVisible();
  if (await rimasto.isVisible()) {
    await rimasto.click();
    await expect(io.getByRole('heading', { name: 'Torni a casa?' })).toBeVisible();
  }
  await io.getByRole('button', { name: 'Avvia il ritorno sicuro' }).click();
  const foglio = io.getByRole('dialog', { name: 'Avvia il ritorno sicuro' });
  await foglio.getByRole('radio', { name: '30 min' }).click();
  await foglio.getByRole('button', { name: 'Continua' }).click();
  await foglio.getByRole('checkbox', { name: /Minore 16/ }).click();
  await foglio.getByRole('button', { name: 'Continua' }).click();
  await foglio.getByRole('button', { name: 'Continua' }).click();
  await foglio.getByRole('button', { name: 'Avvia', exact: true }).click();
  await expect(io.getByText('Ritorno avviato: lo vede 1 amico.')).toBeVisible();
  await expect(io.getByText(/Posizione condivisa · aggiornata/)).toBeVisible();

  const amico = await accedi(browser, 'minore_16@example.com');
  await amico.goto('/vivi/');
  await amico
    .getByRole('link', { name: 'Apri il ritorno di Minore 15' })
    .filter({ hasText: 'In viaggio' })
    .click();
  await expect(amico.getByText('In viaggio').first()).toBeVisible();
  await expect(amico.getByRole('region', { name: /ultima posizione di Minore 15/ })).toBeVisible();
  await amico.goto('/notifiche/');
  await expect(amico.getByText('Minore 15 ha avviato il ritorno sicuro').first()).toBeVisible();

  const estraneo = await accedi(browser, 'adulto_21@example.com');
  await estraneo.goto('/vivi/');
  await expect(estraneo.getByRole('heading', { name: 'Torni a casa?' })).toBeVisible();
  await expect(estraneo.getByText('Minore 15')).toHaveCount(0);

  await io.goto('/vivi/');
  await io.getByRole('button', { name: 'Sono arrivato' }).first().click();
  await expect(io.getByText('Gli amici sanno che sei a casa.')).toBeVisible();
  await expect(io.getByRole('heading', { name: 'Torni a casa?' })).toBeVisible();

  await amico.goto('/vivi/');
  await expect(amico.getByText('Arrivato').first()).toBeVisible();
  await amico.goto('/notifiche/');
  await expect(amico.getByText('Minore 15 ha confermato il rientro').first()).toBeVisible();
});
