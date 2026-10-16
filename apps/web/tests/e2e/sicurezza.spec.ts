import {
  ACCOUNT_DI_PROVA,
  expect,
  impostaTema,
  TEMI,
  test,
  verificaAccessibilita,
} from './supporto';

// Onboarding di sicurezza, nuovi termini, uscita e Content Security Policy (F-10, F-41).

test.describe('onboarding di sicurezza', () => {
  test.use({ account: { ...ACCOUNT_DI_PROVA, onboarding_completato: false } });

  test('chi non l’ha ancora visto ci arriva da qualsiasi area', async ({ page }) => {
    await page.goto('/vivi/');
    await expect(page).toHaveURL(/\/sicurezza\/$/);
  });

  for (const tema of TEMI) {
    test(`tre schermate senza "Salta" e senza violazioni axe (${tema})`, async ({
      page,
      supabase,
    }) => {
      test.slow();
      await impostaTema(page, tema);
      await page.goto('/sicurezza/');
      await expect(page.getByRole('heading', { level: 1, name: 'Chi può trovarti' })).toBeVisible();
      await expect(page.getByRole('img', { name: 'Schermata 1 di 3' })).toBeVisible();
      await expect(page.getByRole('button', { name: /salta/i })).toHaveCount(0);
      await verificaAccessibilita(page);
      await page.getByRole('button', { name: 'Avanti' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'La tua posizione' })).toBeVisible();
      await verificaAccessibilita(page);
      await page.getByRole('button', { name: 'Avanti' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Segnala e blocca' })).toBeVisible();
      await verificaAccessibilita(page);
      supabase.account = { ...ACCOUNT_DI_PROVA, onboarding_completato: true };
      await page.getByRole('button', { name: 'Ho capito, iniziamo' }).click();
      await expect(page).toHaveURL(/\/scopri\/$/);
      expect(supabase.chiamate('profili_privati')).toHaveLength(1);
    });
  }

  test('il testo per chi ha 14–17 anni viene dalla fascia calcolata nel database', async ({
    page,
  }) => {
    await page.goto('/sicurezza/');
    await expect(page.getByText('Ti trovano solo persone della tua età.')).toBeVisible();
    await expect(
      page.getByText('Una persona maggiorenne può aggiungerti solo con il codice che le dai tu'),
    ).toBeVisible();
  });
});

test('l’onboarding si vede una sola volta: chi l’ha completato va in Scopri', async ({ page }) => {
  await page.goto('/sicurezza/');
  await expect(page).toHaveURL(/\/scopri\/$/);
});

test.describe('onboarding per chi è maggiorenne', () => {
  test.use({ account: { ...ACCOUNT_DI_PROVA, minorenne: false, onboarding_completato: false } });

  test('mostra la versione per chi ha 18 anni o più', async ({ page }) => {
    await page.goto('/sicurezza/');
    await expect(page.getByText('Trovi e ti trovano solo persone maggiorenni.')).toBeVisible();
    await expect(page.getByText('Ti trovano solo persone della tua età.')).toHaveCount(0);
  });
});

test.describe('nuova versione dei termini (R-63)', () => {
  test.use({
    account: {
      ...ACCOUNT_DI_PROVA,
      documenti_da_accettare: [
        {
          tipo: 'termini',
          versione: '2026-11',
          in_vigore_dal: '2026-11-01',
          novita: ['Spieghiamo meglio come usiamo la posizione nel ritorno sicuro.'],
        },
      ],
    },
  });

  for (const tema of TEMI) {
    test(`il foglio non si chiude senza scegliere e non ha violazioni axe (${tema})`, async ({
      page,
    }) => {
      await impostaTema(page, tema);
      await page.goto('/scopri/');
      const foglio = page.getByRole('dialog', { name: 'Abbiamo aggiornato termini e informativa' });
      await expect(foglio).toBeVisible();
      await expect(foglio.getByText('01.11.2026')).toBeVisible();
      await expect(foglio.getByText('Spieghiamo meglio come usiamo la posizione')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(foglio).toBeVisible();
      await verificaAccessibilita(page);
    });
  }

  test('serve spuntare la casella; poi il consenso arriva al database', async ({
    page,
    supabase,
  }) => {
    await page.goto('/scopri/');
    const foglio = page.getByRole('dialog', { name: 'Abbiamo aggiornato termini e informativa' });
    await foglio.getByRole('button', { name: 'Accetta e continua' }).click();
    await expect(foglio.getByText('Per continuare spunta tutte e due.')).toBeVisible();
    await foglio.getByLabel('Accetto i nuovi Termini').check();
    supabase.account = ACCOUNT_DI_PROVA;
    await foglio.getByRole('button', { name: 'Accetta e continua' }).click();
    await expect(foglio).toBeHidden();
    expect(supabase.chiamate('consensi')[0]?.corpo).toEqual([
      { utente_id: '00000000-0000-4000-8000-0000000000e2', tipo: 'termini', versione: '2026-11' },
    ]);
  });

  test('"Esci dall’account" porta al Benvenuto', async ({ page }) => {
    await page.goto('/scopri/');
    await page.getByRole('button', { name: 'Esci dall’account' }).click();
    await expect(page).toHaveURL(/\/benvenuto\/$/);
  });
});

test.describe('link aperto senza sessione', () => {
  test.use({ account: null });

  test('un link d’invito si riapre dopo l’accesso', async ({ page, supabase }) => {
    supabase.account = ACCOUNT_DI_PROVA;
    await page.goto('/amici/invito/?c=K7Q4M2XP9H');
    await expect(page).toHaveURL(/\/benvenuto\/$/);
    await page.getByRole('link', { name: 'Ho già un account' }).click();
    await page.getByLabel('Email').fill('giulia.rota@example.com');
    await page.getByLabel('Password', { exact: true }).fill('notte.sul.tram7');
    await page.getByRole('button', { name: 'Accedi' }).click();
    await expect(page).toHaveURL(/\/amici\/invito\/\?c=K7Q4M2XP9H$/);
  });
});

test('dal profilo si esce dall’account', async ({ page, supabase }) => {
  await page.goto('/profilo/');
  await page.getByRole('button', { name: 'Esci dall’account' }).click();
  await expect(page).toHaveURL(/\/benvenuto\/$/);
  expect(supabase.chiamate('logout')).toHaveLength(1);
  await page.goto('/scopri/');
  await expect(page).toHaveURL(/\/benvenuto\/$/);
});

test.describe('termini e informativa', () => {
  test.use({ account: null });

  for (const tema of TEMI) {
    test(`si leggono senza account e senza violazioni axe (${tema})`, async ({ page }) => {
      await impostaTema(page, tema);
      await page.goto('/termini/');
      await expect(
        page.getByRole('heading', { level: 1, name: 'Termini di servizio' }),
      ).toBeVisible();
      await verificaAccessibilita(page);
      await page.goto('/privacy/');
      await expect(
        page.getByRole('heading', { level: 1, name: 'Informativa privacy' }),
      ).toBeVisible();
      await verificaAccessibilita(page);
    });
  }
});

test.describe('Content Security Policy (ARCHITECTURE.md §9)', () => {
  test.use({ account: null });

  test('ogni pagina ha la CSP e nessuno script viene bloccato', async ({ page }) => {
    const violazioni: string[] = [];
    page.on('console', (messaggio) => {
      if (/Content Security Policy/i.test(messaggio.text())) violazioni.push(messaggio.text());
    });
    for (const percorso of ['/benvenuto/', '/registrazione/', '/accesso/', '/privacy/']) {
      await page.goto(percorso);
      const politica = await page
        .locator('meta[http-equiv="Content-Security-Policy"]')
        .getAttribute('content');
      expect(politica).toContain("default-src 'self'");
      expect(politica).toContain("object-src 'none'");
      expect(politica).not.toContain("'unsafe-eval'");
      expect(politica).not.toMatch(/script-src[^;]*'unsafe-inline'/);
      await expect(page.locator('h1')).toBeVisible();
    }
    // La registrazione carica Turnstile: l'unico script esterno ammesso.
    await page.goto('/registrazione/');
    expect(violazioni).toEqual([]);
  });
});
