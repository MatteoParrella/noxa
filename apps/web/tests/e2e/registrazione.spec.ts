import type { Page } from '@playwright/test';
import {
  erroreAuth,
  expect,
  impostaTema,
  TEMI,
  test,
  verificaAccessibilita,
  type SupabaseSimulato,
} from './supporto';

// Registrazione e Benvenuto senza account (F-10, design/F-10-accesso).
test.use({ account: null });

/** Data di nascita gg.mm.aaaa di chi ha `anni` anni compiuti da un mese. */
function nascita(anni: number): string {
  const data = new Date();
  data.setFullYear(data.getFullYear() - anni);
  data.setMonth(data.getMonth() - 1);
  const due = (n: number) => String(n).padStart(2, '0');
  return `${due(data.getDate())}.${due(data.getMonth() + 1)}.${data.getFullYear()}`;
}

async function compilaFinoAlConsenso(pagina: Page, username = 'giulia.rota') {
  await pagina.goto('/registrazione/');
  await pagina.getByLabel('Data di nascita').fill(nascita(16));
  await pagina.getByRole('button', { name: 'Avanti' }).click();
  await pagina.getByLabel('Email').fill('giulia.rota@example.com');
  await pagina.getByLabel('Password', { exact: true }).fill('notte.sul.tram7');
  await pagina.getByRole('button', { name: 'Avanti' }).click();
  await pagina.getByLabel('Username').fill(username);
  await pagina.getByLabel('Nome visualizzato').fill('Giulia');
  await pagina.getByRole('button', { name: 'Avanti' }).click();
  await expect(
    pagina.getByRole('heading', { level: 1, name: 'I tuoi dati, in breve' }),
  ).toBeVisible();
}

async function accettaEInvia(pagina: Page) {
  await pagina.getByLabel(/Accetto i/).check();
  await pagina.getByLabel(/Ho letto l/).check();
  await expect(pagina.getByText('Verifica completata')).toBeVisible();
  await pagina.getByRole('button', { name: 'Crea l’account' }).click();
}

function datiInviati(supabase: SupabaseSimulato) {
  const [chiamata] = supabase.chiamate('signup');
  return chiamata?.corpo as {
    email: string;
    data: Record<string, unknown>;
    gotrue_meta_security?: { captcha_token?: string };
  };
}

test('R-07: senza account le aree portano al Benvenuto', async ({ page }) => {
  await page.goto('/scopri/');
  await expect(page).toHaveURL(/\/benvenuto\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'noxa' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Crea un account' })).toBeVisible();
});

for (const tema of TEMI) {
  test(`Benvenuto, passi della registrazione ed età non sufficiente senza violazioni axe (${tema})`, async ({
    page,
  }) => {
    // Cinque analisi axe in un solo percorso.
    test.slow();
    await impostaTema(page, tema);
    await page.goto('/benvenuto/');
    await verificaAccessibilita(page);
    await page.getByRole('link', { name: 'Crea un account' }).click();
    await expect(page.getByRole('img', { name: 'Passo 1 di 4' })).toBeVisible();
    await verificaAccessibilita(page);
    await page.getByLabel('Data di nascita').fill(nascita(16));
    await page.getByRole('button', { name: 'Avanti' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Email e password' })).toBeVisible();
    await page.getByRole('button', { name: 'Avanti' }).click();
    await expect(page.getByText('Scrivi un’email valida')).toBeVisible();
    await verificaAccessibilita(page);
    await page.getByLabel('Email').fill('giulia.rota@example.com');
    await page.getByLabel('Password', { exact: true }).fill('notte.sul.tram7');
    await page.getByRole('button', { name: 'Avanti' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Username e nome' })).toBeVisible();
    await verificaAccessibilita(page);
    await page.getByLabel('Username').fill('giulia.rota');
    await page.getByLabel('Nome visualizzato').fill('Giulia');
    await page.getByRole('button', { name: 'Avanti' }).click();
    await page.getByRole('button', { name: 'Crea l’account' }).click();
    await expect(page.getByText('Spunta tutte e due le caselle')).toBeVisible();
    await verificaAccessibilita(page);
  });

  test(`età non sufficiente senza violazioni axe (${tema})`, async ({ page }) => {
    await impostaTema(page, tema);
    await page.goto('/registrazione/');
    await page.getByLabel('Data di nascita').fill(nascita(13));
    await page.getByRole('button', { name: 'Avanti' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Ci vediamo più avanti' }),
    ).toBeVisible();
    await verificaAccessibilita(page);
  });
}

test('R-01: chi ha 13 anni non va avanti, non vede modi per cambiare la data e nulla parte', async ({
  page,
  supabase,
}) => {
  await page.goto('/registrazione/');
  await page.getByLabel('Data di nascita').fill(nascita(13));
  await page.getByRole('button', { name: 'Avanti' }).click();
  await expect(page.getByText('Noxa è per chi ha almeno 14 anni.')).toBeVisible();
  await expect(
    page.getByText('Non abbiamo salvato niente di quello che hai scritto.'),
  ).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(1);
  await page.getByRole('button', { name: 'Ho capito' }).click();
  await expect(page).toHaveURL(/\/benvenuto\/$/);
  expect(supabase.chiamate('signup')).toHaveLength(0);
});

test('la data si scrive con i punti automatici e gli errori spiegano come correggerla', async ({
  page,
}) => {
  await page.goto('/registrazione/');
  const campo = page.getByLabel('Data di nascita');
  await campo.fill('31022009');
  await expect(campo).toHaveValue('31.02.2009');
  await page.getByRole('button', { name: 'Avanti' }).click();
  await expect(
    page.getByText('Questa data non esiste: nel 2009 febbraio ha 28 giorni. Controlla il giorno.'),
  ).toBeVisible();
  await expect(campo).toHaveAttribute('aria-invalid', 'true');
  await campo.fill('01.01.2099');
  await page.getByRole('button', { name: 'Avanti' }).click();
  await expect(page.getByText('Questa data è nel futuro')).toBeVisible();
});

test('il calendario si usa da tastiera e scrive la data nel campo', async ({ page }) => {
  await page.goto('/registrazione/');
  await page.getByLabel('Data di nascita').fill('14.03.2009');
  await page.getByRole('button', { name: 'Apri il calendario' }).click();
  const foglio = page.getByRole('dialog', { name: 'Data di nascita' });
  await expect(foglio).toBeVisible();
  await expect(foglio.getByRole('button', { name: '14 marzo 2009' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await foglio.getByRole('button', { name: '14 marzo 2009' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(foglio.getByRole('button', { name: '15 marzo 2009' })).toBeFocused();
  await page.keyboard.press('Enter');
  await foglio.getByRole('button', { name: 'Conferma' }).click();
  await expect(page.getByLabel('Data di nascita')).toHaveValue('15.03.2009');
});

test('registrazione completa: i dati arrivano al database e si passa a "Controlla la posta"', async ({
  page,
  supabase,
}) => {
  await compilaFinoAlConsenso(page);
  await accettaEInvia(page);
  await expect(page).toHaveURL(/\/registrazione\/verifica\/$/);
  await expect(page.getByText('g•••@example.com')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reinvia l’email' })).toBeDisabled();
  await expect(page.getByText(/Puoi reinviarla tra/)).toBeVisible();

  const dati = datiInviati(supabase);
  expect(dati.email).toBe('giulia.rota@example.com');
  // La data viaggia in formato ISO e l'età la calcola il database (R-04).
  expect(dati.data).toMatchObject({
    username: 'giulia.rota',
    nome_visualizzato: 'Giulia',
    consensi: { termini: '2026-10', privacy: '2026-11' },
  });
  expect(dati.data['data_nascita']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(Object.keys(dati.data)).not.toContain('eta');
  expect(dati.gotrue_meta_security?.captcha_token).toBe('token-turnstile-di-prova');
});

test('un’email già registrata riceve la stessa risposta di una nuova', async ({
  page,
  supabase,
}) => {
  supabase.rispondi('signup', erroreAuth(422, 'user_already_exists', 'User already registered'));
  await compilaFinoAlConsenso(page);
  await accettaEInvia(page);
  await expect(page).toHaveURL(/\/registrazione\/verifica\/$/);
  await expect(page.getByText('g•••@example.com')).toBeVisible();
});

test('username già in uso: si torna al passo 3 con una proposta', async ({ page, supabase }) => {
  supabase.rispondi('signup', erroreAuth(400, 'unknown', 'NX003'));
  await compilaFinoAlConsenso(page);
  await accettaEInvia(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Username e nome' })).toBeVisible();
  await expect(page.getByText('Già in uso, prova giulia.rota2')).toBeVisible();
  await page.getByRole('button', { name: 'Usa giulia.rota2' }).click();
  await expect(page.getByLabel('Username')).toHaveValue('giulia.rota2');
});

test('R-01: se il database rifiuta l’età si mostra la schermata dell’età', async ({
  page,
  supabase,
}) => {
  supabase.rispondi('signup', erroreAuth(400, 'unknown', 'NX001'));
  await compilaFinoAlConsenso(page);
  await accettaEInvia(page);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Ci vediamo più avanti' }),
  ).toBeVisible();
});

test('password comparsa in una violazione: si torna al passo 2 con la spiegazione', async ({
  page,
  supabase,
}) => {
  supabase.rispondi(
    'signup',
    erroreAuth(422, 'weak_password', 'Password is known to be weak', {
      weak_password: { reasons: ['pwned'] },
    }),
  );
  await compilaFinoAlConsenso(page);
  await accettaEInvia(page);
  await expect(
    page.getByText(/Questa password è comparsa in una violazione di dati/),
  ).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
});

test('errore di rete all’invio: avviso e pulsante "Riprova"', async ({ page, supabase }) => {
  supabase.rispondi('signup', 'rete');
  await compilaFinoAlConsenso(page);
  await accettaEInvia(page);
  await expect(page.getByText('Non riusciamo a raggiungere Noxa')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Riprova' })).toBeVisible();
});

test('offline: il passo dei consensi spiega perché il pulsante è spento', async ({
  page,
  context,
}) => {
  await compilaFinoAlConsenso(page);
  await context.setOffline(true);
  await expect(page.getByText('Sei offline. Quello che hai scritto resta qui.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crea l’account' })).toBeDisabled();
  await expect(page.getByText('Serve la connessione per creare l’account.')).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByRole('button', { name: 'Crea l’account' })).toBeEnabled();
});

test('"Indietro" riporta al passo precedente senza perdere quello che si è scritto', async ({
  page,
}) => {
  await compilaFinoAlConsenso(page);
  await page.getByRole('button', { name: 'Indietro' }).click();
  await expect(page.getByLabel('Username')).toHaveValue('giulia.rota');
  await page.getByRole('button', { name: 'Indietro' }).click();
  await expect(page.getByLabel('Email')).toHaveValue('giulia.rota@example.com');
});
