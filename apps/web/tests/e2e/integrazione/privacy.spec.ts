import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

// Supabase locale reale con l'Edge Function elimina-account servita (`supabase start` o
// `supabase functions serve`): diario (F-30, R-40), esportazione (R-64, una all'ora) ed
// eliminazione dell'account. Ogni esecuzione usa un account nuovo, perché il limite
// dell'esportazione dura un'ora e l'account alla fine non esiste più.
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
const PASSWORD = 'notte.sul.tram7';
const BASE = 'http://127.0.0.1:4173';

function unico(prefisso: string) {
  const codice = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  return {
    email: `${prefisso}.${codice}@example.com`,
    username: `${prefisso}.${codice}`.slice(0, 20),
  };
}

function nascitaIso(anni: number) {
  const data = new Date();
  data.setFullYear(data.getFullYear() - anni);
  data.setMonth(data.getMonth() - 1);
  return data.toISOString().slice(0, 10);
}

/** Account confermato di 16 anni con l'onboarding fatto, con la sessione nella pagina. */
async function nuovoAccount(page: Page, prefisso: string) {
  const { email, username } = unico(prefisso);
  // Il link dell'email torna all'app dei test, come con la registrazione dall'app.
  const ritorno = encodeURIComponent(`${BASE}/accesso/conferma/`);
  const risposta = await fetch(`${SUPABASE}/auth/v1/signup?redirect_to=${ritorno}`, {
    method: 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      data: {
        username,
        nome_visualizzato: 'Prova Diario',
        data_nascita: nascitaIso(16),
        consensi: { termini: '2026-10', privacy: '2026-11' },
      },
    }),
  });
  expect(risposta.ok).toBe(true);
  let link: string | undefined;
  await expect
    .poll(async () => {
      const ricerca = await fetch(
        `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
      );
      const { messages } = (await ricerca.json()) as { messages: Array<{ ID: string }> };
      const ultimo = messages[0];
      if (!ultimo) return false;
      const messaggio = (await (await fetch(`${MAILPIT}/api/v1/message/${ultimo.ID}`)).json()) as {
        HTML: string;
      };
      link = /href="([^"]+)"/.exec(messaggio.HTML)?.[1]?.replace(/&amp;/g, '&');
      return Boolean(link);
    })
    .toBe(true);
  await page.goto(link!);
  await expect(page).toHaveURL(/\/sicurezza\/$/);
  await page.getByRole('button', { name: 'Avanti' }).click();
  await page.getByRole('button', { name: 'Avanti' }).click();
  await page.getByRole('button', { name: 'Ho capito, iniziamo' }).click();
  await expect(page).toHaveURL(/\/scopri\/$/);
  return { email };
}

async function accedi(page: Page, email: string, password: string) {
  await page.goto('/accesso/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Accedi' }).click();
}

test.beforeAll(() => {
  expect(ANON, 'serve NEXT_PUBLIC_SUPABASE_ANON_KEY di `supabase status`').not.toBe('');
});

test('diario privato, esportazione una volta all’ora ed eliminazione dell’account', async ({
  page,
}) => {
  test.slow();
  const { email } = await nuovoAccount(page, 'diario');
  const nota = `Nota ${Date.now().toString(36)}`;

  // Una serata con un locale scritto a mano, una spesa e una nota. R-40: per chi ha 16 anni
  // il database non offre la categoria alcolici.
  await page.goto('/ricorda/modifica/');
  await page.getByRole('button', { name: 'Il locale non c’è? Scrivi il nome del locale' }).click();
  await page.getByLabel('Nome del locale').fill('Festa in cascina');
  const spese = page.getByRole('group', { name: 'Aggiungi una spesa' });
  await expect(spese.getByRole('button', { name: 'Ingresso' })).toBeVisible();
  await expect(spese.getByRole('button', { name: 'Alcolici' })).toHaveCount(0);
  await spese.getByRole('button', { name: 'Ingresso' }).click();
  await page.getByLabel('Importo per Ingresso, in euro').fill('12,50');
  await page.getByLabel('Note').fill(nota);
  await page
    .getByLabel('Data')
    .fill(new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10));
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Serata salvata nel diario')).toBeVisible();
  await page.getByRole('link', { name: 'Torna al diario' }).click();
  await expect(page.getByRole('link', { name: /Festa in cascina/ })).toBeVisible();

  // R-64: il file contiene il diario; una seconda richiesta nella stessa ora è rifiutata.
  await page.goto('/profilo/privacy/scarica/');
  await page.getByRole('button', { name: 'Prepara il file' }).click();
  const link = page.getByRole('link', { name: /Scarica/ });
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
  const dati = JSON.parse(await readFile(await download.path(), 'utf8')) as {
    formato: string;
    account: { email: string };
    diario: Array<{ locale: string; note: string; spese: Array<{ categoria: string }> }>;
  };
  expect(dati.formato).toBe('noxa-esportazione-1');
  expect(dati.account.email).toBe(email);
  expect(dati.diario).toEqual([
    expect.objectContaining({
      locale: 'Festa in cascina',
      note: nota,
      spese: [{ categoria: 'ingresso', importo_euro: 12.5 }],
    }),
  ]);
  await page.reload();
  await page.getByRole('button', { name: 'Prepara il file' }).click();
  await expect(page.getByText(/^Puoi richiederlo di nuovo alle \d{2}:\d{2}\.$/)).toBeVisible();

  // Eliminazione: la password sbagliata non cancella niente, quella giusta sì.
  await page.goto('/profilo/privacy/elimina/');
  await page.getByRole('button', { name: 'Continua' }).click();
  const password = page.getByRole('textbox', { name: 'Password' });
  await password.fill('password.sbagliata');
  await page.getByRole('button', { name: 'Elimina definitivamente' }).click();
  await expect(page.getByText('La password non è giusta.', { exact: false })).toBeVisible();
  await password.fill(PASSWORD);
  await page.getByRole('button', { name: /Elimina definitivamente|Riprova a eliminare/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Il tuo account è stato eliminato' }),
  ).toBeVisible();

  // Niente resta sul dispositivo, poi l'accesso fallisce come per una password sbagliata.
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('noxa-sessione')))
    .toBeNull();
  await accedi(page, email, PASSWORD);
  await expect(page.getByText('Email o password non corretti.')).toBeVisible();
});

test('R-40: un maggiorenne vede la categoria alcolici, il diario degli altri resta privato', async ({
  page,
}) => {
  await accedi(page, 'adulto_20@example.com', 'password-di-prova');
  await expect(page).toHaveURL(/\/scopri\/$/);
  await page.goto('/ricorda/modifica/');
  const spese = page.getByRole('group', { name: 'Aggiungi una spesa' });
  await expect(spese.getByRole('button', { name: 'Alcolici' })).toBeVisible();
  await page.goto('/ricorda/');
  await expect(page.getByRole('link', { name: /Festa in cascina/ })).toHaveCount(0);
});
