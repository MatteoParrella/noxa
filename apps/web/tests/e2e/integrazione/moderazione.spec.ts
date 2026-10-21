import { createHmac } from 'node:crypto';
import { expect, test, type Browser, type Page } from '@playwright/test';

// Area di moderazione con Supabase locale reale: due fattori veri (TOTP) e RPC protette da
// private.e_moderatore() (R-06). Il seed ha i candidati locali e le fonti di esempio; come gli
// altri test di integrazione parte da un database appena ripristinato (`supabase db reset`).

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

/** Codice TOTP (RFC 6238: SHA-1, 6 cifre, 30 secondi) dal codice segreto in base32. */
function codiceTotp(segreto: string, adesso = Date.now()): string {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bit = '';
  for (const carattere of segreto.replace(/=+$/, '').toUpperCase()) {
    bit += alfabeto.indexOf(carattere).toString(2).padStart(5, '0');
  }
  const chiave = Buffer.from((bit.match(/.{8}/g) ?? []).map((byte) => Number.parseInt(byte, 2)));
  const contatore = Buffer.alloc(8);
  contatore.writeBigUInt64BE(BigInt(Math.floor(adesso / 30_000)));
  const hmac = createHmac('sha1', chiave).update(contatore).digest();
  const scostamento = (hmac[hmac.length - 1] ?? 0) & 0xf;
  const numero = (hmac.readUInt32BE(scostamento) & 0x7fffffff) % 1_000_000;
  return String(numero).padStart(6, '0');
}

test('R-06: un utente senza ruolo non entra nell’area', async ({ browser }) => {
  const adulto = await accedi(browser, 'adulto_21');
  await adulto.goto('/moderazione/locali/');
  await expect(
    adulto.getByRole('heading', { name: 'Quest’area è riservata al team di moderazione' }),
  ).toBeVisible();
});

test('R-06: il moderatore attiva i due fattori e lavora con le RPC protette', async ({
  browser,
}) => {
  test.slow();
  const moderatore = await accedi(browser, 'moderatore');
  await moderatore.goto('/moderazione/locali/');
  await expect(moderatore.getByRole('heading', { name: 'Attiva i due fattori' })).toBeVisible();
  const segreto = (await moderatore.locator('.segreto span').first().textContent())?.trim() ?? '';
  expect(segreto).toMatch(/^[A-Z2-7]+=*$/);
  await moderatore.getByRole('textbox', { name: 'Cifra 1 di 6' }).fill(codiceTotp(segreto));

  // Dati veri dal database, letti con la sessione aal2.
  await expect(moderatore.getByRole('link', { name: 'Club Binario 7' })).toBeVisible();
  await moderatore.goto('/moderazione/locali/?vista=candidati');
  await expect(moderatore.getByText('Corte delle Rose')).toBeVisible();
  await moderatore
    .getByRole('row', { name: /Corte delle Rose/ })
    .getByRole('button', { name: 'Scarta…' })
    .click();
  const dialogo = moderatore.getByRole('dialog');
  await dialogo
    .getByRole('textbox', { name: 'Motivazione (obbligatoria)' })
    .fill('Il locale ha chiuso.');
  await dialogo.getByRole('button', { name: 'Scarta' }).click();
  await expect(moderatore.getByText('Candidato scartato.')).toBeVisible();
  await expect(moderatore.getByText('Corte delle Rose')).toHaveCount(0);

  await moderatore.goto('/moderazione/duplicati/');
  await expect(
    moderatore.getByRole('heading', { name: 'NOTTE FERROVIA – techno all night' }),
  ).toBeVisible();
});
