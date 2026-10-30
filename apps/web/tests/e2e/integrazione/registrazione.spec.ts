import { expect, test, type Page } from '@playwright/test';

// Supabase locale reale: Auth con l'hook dell'età, Postgres con il trigger, Mailpit.
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

/** Identificativi unici per ogni esecuzione, così i test si possono ripetere sullo stesso DB. */
function unico(prefisso: string) {
  const codice = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  return {
    email: `${prefisso}.${codice}@example.com`,
    username: `${prefisso}.${codice}`.slice(0, 20),
  };
}

function nascita(anni: number, formato: 'iso' | 'app') {
  const data = new Date();
  data.setFullYear(data.getFullYear() - anni);
  data.setMonth(data.getMonth() - 1);
  const due = (n: number) => String(n).padStart(2, '0');
  const [a, m, g] = [data.getFullYear(), due(data.getMonth() + 1), due(data.getDate())];
  return formato === 'iso' ? `${a}-${m}-${g}` : `${g}.${m}.${a}`;
}

async function registraDallApi(email: string, username: string, dataNascita: string) {
  return fetch(`${SUPABASE}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'notte.sul.tram7',
      data: {
        username,
        nome_visualizzato: 'Prova',
        data_nascita: dataNascita,
        consensi: { termini: '2026-10', privacy: '2026-11' },
      },
    }),
  });
}

/** Link dell'ultima email ricevuta da `email` in Mailpit. */
async function linkDallEmail(email: string): Promise<string> {
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
  return link!;
}

async function contaEmail(email: string): Promise<number> {
  const ricerca = await fetch(
    `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
  );
  return ((await ricerca.json()) as { messages: unknown[] }).messages.length;
}

test.beforeAll(() => {
  expect(ANON, 'serve NEXT_PUBLIC_SUPABASE_ANON_KEY di `supabase status`').not.toBe('');
});

test('R-01: un tredicenne non si registra dall’app', async ({ page }) => {
  await page.goto('/registrazione/');
  await page.getByLabel('Data di nascita').fill(nascita(13, 'app'));
  await page.getByRole('button', { name: 'Avanti' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Ci vediamo più avanti' }),
  ).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveCount(0);
});

test('R-01: un tredicenne non si registra nemmeno chiamando direttamente l’API', async () => {
  const { email, username } = unico('tredici');
  const risposta = await registraDallApi(email, username, nascita(13, 'iso'));
  expect(risposta.status).toBe(400);
  expect(((await risposta.json()) as { msg: string }).msg).toBe('NX001');
  expect(await contaEmail(email)).toBe(0);

  // Nessun account è rimasto: la stessa email e lo stesso username sono ancora liberi.
  const valida = await registraDallApi(email, username, nascita(15, 'iso'));
  expect(valida.status).toBe(200);
  await linkDallEmail(email);
});

test('un’email già registrata non crea un secondo account e non lo rivela', async ({ page }) => {
  await page.goto('/registrazione/');
  await page.getByLabel('Data di nascita').fill(nascita(16, 'app'));
  await page.getByRole('button', { name: 'Avanti' }).click();
  // Utente del seed, già confermato.
  await page.getByLabel('Email').fill('minore_16@example.com');
  await page.getByLabel('Password', { exact: true }).fill('notte.sul.tram7');
  await page.getByRole('button', { name: 'Avanti' }).click();
  await page.getByLabel('Username').fill(unico('doppio').username);
  await page.getByLabel('Nome visualizzato').fill('Doppio');
  await page.getByRole('button', { name: 'Avanti' }).click();
  await page.getByLabel(/Accetto i/).check();
  await page.getByLabel(/Ho letto l/).check();
  await page.getByRole('button', { name: 'Crea l’account' }).click();
  await expect(page).toHaveURL(/\/registrazione\/verifica\/$/);
  // Il vecchio account funziona come prima: la password non è cambiata.
  await accedi(page, 'minore_16@example.com', 'password-di-prova');
  await expect(page).toHaveURL(/\/scopri\/$/);
});

test('registrazione, verifica dell’email, onboarding, uscita e nuovo accesso', async ({ page }) => {
  test.slow();
  const { email, username } = unico('giulia');
  await page.goto('/scopri/');
  await expect(page).toHaveURL(/\/benvenuto\/$/);
  await page.getByRole('link', { name: 'Crea un account' }).click();
  await page.getByLabel('Data di nascita').fill(nascita(16, 'app'));
  await page.getByRole('button', { name: 'Avanti' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('notte.sul.tram7');
  await page.getByRole('button', { name: 'Avanti' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Nome visualizzato').fill('Giulia');
  await page.getByRole('button', { name: 'Avanti' }).click();
  await page.getByLabel(/Accetto i/).check();
  await page.getByLabel(/Ho letto l/).check();
  await page.getByRole('button', { name: 'Crea l’account' }).click();
  await expect(page).toHaveURL(/\/registrazione\/verifica\/$/);

  await page.goto(await linkDallEmail(email));
  await expect(page).toHaveURL(/\/sicurezza\/$/);
  // La fascia arriva dal database: 16 anni, testo per chi ha 14–17 anni.
  await expect(page.getByText('Ti trovano solo persone della tua età.')).toBeVisible();

  // R-05: la data di nascita non è nei metadati dell'utente né nel token.
  const sessione = await page.evaluate(() => window.localStorage.getItem('noxa-sessione'));
  expect(sessione).not.toBeNull();
  expect(sessione).not.toContain('data_nascita');
  const { access_token } = JSON.parse(sessione!) as { access_token: string };
  const contenuto = Buffer.from(access_token.split('.')[1]!, 'base64url').toString();
  expect(contenuto).not.toContain('data_nascita');

  await page.getByRole('button', { name: 'Avanti' }).click();
  await page.getByRole('button', { name: 'Avanti' }).click();
  await page.getByRole('button', { name: 'Ho capito, iniziamo' }).click();
  await expect(page).toHaveURL(/\/scopri\/$/);

  await page.goto('/profilo/');
  await page.getByRole('button', { name: 'Esci dall’account' }).click();
  await expect(page).toHaveURL(/\/benvenuto\/$/);

  await accedi(page, email, 'password.sbagliata');
  await expect(page.getByText('Email o password non corretti.')).toBeVisible();
  await accedi(page, email, 'notte.sul.tram7');
  // L'onboarding è già fatto: si entra direttamente.
  await expect(page).toHaveURL(/\/scopri\/$/);
});

async function accedi(pagina: Page, email: string, password: string) {
  await pagina.goto('/accesso/');
  await pagina.getByLabel('Email').fill(email);
  await pagina.getByLabel('Password', { exact: true }).fill(password);
  await pagina.getByRole('button', { name: 'Accedi' }).click();
}
