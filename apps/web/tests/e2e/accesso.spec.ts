import type { Page } from '@playwright/test';
import {
  ACCOUNT_DI_PROVA,
  erroreAuth,
  expect,
  impostaTema,
  TEMI,
  test,
  verificaAccessibilita,
} from './supporto';

// Verifica dell'email, accesso e recupero della password (F-10, design/F-10-accesso).
test.use({ account: null });

/** Registrazione appena inviata da questo dispositivo, come la salva l'app. */
async function verificaInAttesa(pagina: Page, inviataIl: number) {
  await pagina.addInitScript(
    (valore) => {
      window.localStorage.setItem('noxa-verifica-email', valore);
    },
    JSON.stringify({ email: 'giulia.rota@example.com', inviataIl }),
  );
}

test.describe('verifica dell’email', () => {
  for (const tema of TEMI) {
    test(`"Controlla la posta" senza violazioni axe (${tema})`, async ({ page }) => {
      await impostaTema(page, tema);
      await verificaInAttesa(page, Date.now());
      await page.goto('/registrazione/verifica/');
      await expect(
        page.getByRole('heading', { level: 1, name: 'Controlla la posta' }),
      ).toBeVisible();
      await verificaAccessibilita(page);
    });
  }

  test('"Reinvia l’email" si accende dopo 60 secondi e conferma l’invio', async ({
    page,
    supabase,
  }) => {
    await page.clock.install();
    await verificaInAttesa(page, Date.now());
    await page.goto('/registrazione/verifica/');
    const reinvia = page.getByRole('button', { name: 'Reinvia l’email' });
    await expect(reinvia).toBeDisabled();
    await expect(page.getByText(/Puoi reinviarla tra/)).toContainText(/[01]:\d\d/);
    await page.clock.fastForward('01:01');
    await expect(reinvia).toBeEnabled();
    await reinvia.click();
    await expect(page.getByText('Email inviata di nuovo')).toBeVisible();
    expect(supabase.chiamate('resend')).toHaveLength(1);
    await expect(reinvia).toBeDisabled();
  });

  test('se l’email non parte lo dice e lascia riprovare', async ({ page, supabase }) => {
    supabase.rispondi('resend', 'rete');
    await verificaInAttesa(page, Date.now() - 120_000);
    await page.goto('/registrazione/verifica/');
    await page.getByRole('button', { name: 'Reinvia l’email' }).click();
    await expect(page.getByText('L’email non è partita')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reinvia l’email' })).toBeEnabled();
  });

  test('il link dell’email apre l’onboarding di sicurezza', async ({ page, supabase }) => {
    supabase.account = { ...ACCOUNT_DI_PROVA, onboarding_completato: false };
    await page.goto('/accesso/conferma/?token_hash=abc123&type=email');
    await expect(page).toHaveURL(/\/sicurezza\/$/);
    expect(supabase.chiamate('verify')[0]?.corpo).toMatchObject({
      token_hash: 'abc123',
      type: 'email',
    });
  });

  test('un link scaduto chiede un nuovo link, anche da un altro dispositivo', async ({
    page,
    supabase,
  }) => {
    supabase.rispondi(
      'verify',
      erroreAuth(403, 'otp_expired', 'Email link is invalid or has expired'),
    );
    await page.goto('/accesso/conferma/?token_hash=scaduto&type=email');
    await expect(page.getByRole('heading', { level: 1, name: 'Il link è scaduto' })).toBeVisible();
    await verificaAccessibilita(page);
    await page.getByLabel('Email').fill('giulia.rota@example.com');
    await page.getByRole('button', { name: 'Mandami un nuovo link' }).click();
    await expect(page).toHaveURL(/\/registrazione\/verifica\/$/);
    expect(supabase.chiamate('resend')[0]?.corpo).toMatchObject({
      email: 'giulia.rota@example.com',
      type: 'signup',
    });
  });
});

test.describe('accesso', () => {
  for (const tema of TEMI) {
    test(`accesso e recupero senza violazioni axe (${tema})`, async ({ page }) => {
      await impostaTema(page, tema);
      await page.goto('/accesso/');
      await expect(page.getByRole('heading', { level: 1, name: 'Accedi' })).toBeVisible();
      await verificaAccessibilita(page);
      await page.getByRole('button', { name: 'Password dimenticata?' }).click();
      await expect(
        page.getByRole('heading', { level: 1, name: 'Ti mandiamo un link' }),
      ).toBeVisible();
      await verificaAccessibilita(page);
    });
  }

  async function prova(pagina: Page) {
    await pagina.goto('/accesso/');
    await pagina.getByLabel('Email').fill('giulia.rota@example.com');
    await pagina.getByLabel('Password', { exact: true }).fill('notte.sul.tram7');
    await expect(pagina.getByText('Verifica completata')).toBeAttached();
    await pagina.getByRole('button', { name: 'Accedi' }).click();
  }

  test('con le credenziali giuste si entra in Scopri', async ({ page, supabase }) => {
    supabase.account = ACCOUNT_DI_PROVA;
    await prova(page);
    await expect(page).toHaveURL(/\/scopri\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Scopri' })).toBeVisible();
  });

  test('l’errore non dice se è sbagliata l’email o la password', async ({ page, supabase }) => {
    supabase.rispondi('token', erroreAuth(400, 'invalid_credentials', 'Invalid login credentials'));
    await prova(page);
    await expect(
      page.getByText('Email o password non corretti. Controlla e riprova.'),
    ).toBeVisible();
    await verificaAccessibilita(page);
  });

  test('email non verificata: avviso con il reinvio del link', async ({ page, supabase }) => {
    supabase.rispondi('token', erroreAuth(400, 'email_not_confirmed', 'Email not confirmed'));
    await prova(page);
    await expect(page.getByText('Manca la verifica dell’email')).toBeVisible();
    await page.getByRole('button', { name: 'Reinvia il link' }).click();
    await expect(page.getByText('Link inviato di nuovo.')).toBeVisible();
    expect(supabase.chiamate('resend')).toHaveLength(1);
  });

  test('troppi tentativi: "Accedi" si spegne e resta il recupero', async ({ page, supabase }) => {
    supabase.rispondi('token', erroreAuth(429, 'over_request_rate_limit', 'Too many requests'));
    await prova(page);
    await expect(page.getByText('Troppi tentativi')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accedi' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Password dimenticata?' })).toBeEnabled();
  });
});

test.describe('recupero della password', () => {
  test('la risposta è la stessa che l’account esista o no', async ({ page, supabase }) => {
    await page.goto('/accesso/password/');
    await page.getByLabel('Email').fill('chiunque@example.com');
    await page.getByRole('button', { name: 'Invia il link' }).click();
    await expect(
      page.getByText('Se c’è un account con questa email, ti abbiamo mandato un link.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Torna all’accesso' })).toBeVisible();
    expect(supabase.chiamate('recover')).toHaveLength(1);
  });

  test('dal link si sceglie la nuova password e si esce dagli altri dispositivi', async ({
    page,
    supabase,
  }) => {
    supabase.account = ACCOUNT_DI_PROVA;
    await page.goto('/accesso/nuova-password/?token_hash=rec123&type=recovery');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Scegli una nuova password' }),
    ).toBeVisible();
    await verificaAccessibilita(page);
    await page.getByLabel('Nuova password', { exact: true }).fill('una.nuova.notte');
    await page.getByRole('button', { name: 'Salva e accedi' }).click();
    await expect(page).toHaveURL(/\/scopri\/$/);
    expect(supabase.chiamate('verify')[0]?.corpo).toMatchObject({ type: 'recovery' });
    expect(supabase.chiamate('aggiorna_utente')[0]?.corpo).toMatchObject({
      password: 'una.nuova.notte',
    });
    expect(supabase.chiamate('logout')[0]?.url).toContain('scope=others');
  });

  test('la stessa password di prima viene rifiutata', async ({ page, supabase }) => {
    supabase.rispondi(
      'aggiorna_utente',
      erroreAuth(422, 'same_password', 'New password should be different from the old password.'),
    );
    await page.goto('/accesso/nuova-password/?token_hash=rec123&type=recovery');
    await page.getByLabel('Nuova password', { exact: true }).fill('notte.sul.tram7');
    await page.getByRole('button', { name: 'Salva e accedi' }).click();
    await expect(page.getByText('È la stessa password di prima')).toBeVisible();
  });
});
