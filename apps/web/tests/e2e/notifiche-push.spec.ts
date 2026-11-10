import type { Page } from '@playwright/test';
import { expect, impostaTema, TEMI, test, verificaAccessibilita } from './supporto';

// Notifiche sul telefono (F-22, design/F-22-notifiche): prima il foglio di Noxa, il permesso
// del sistema solo dopo "Attiva"; permesso negato, iPhone senza installazione, dispositivi.
// Il browser dei test non può iscriversi a un vero servizio push: permesso e iscrizione sono
// simulati, la registrazione passa dalla RPC simulata.

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/prova-e2e';

async function simulaPush(pagina: Page, esito: 'granted' | 'denied' | 'default' = 'granted') {
  await pagina.addInitScript(
    ({ esito, endpoint }) => {
      const finestra = window as unknown as { __richiestePermesso: number };
      finestra.__richiestePermesso = 0;
      let permesso: string = esito === 'denied' ? 'denied' : 'default';
      Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: {
          get permission() {
            return permesso;
          },
          requestPermission: async () => {
            finestra.__richiestePermesso++;
            permesso = esito;
            return esito;
          },
        },
      });
      let iscritta: unknown = null;
      const iscrizione = {
        endpoint,
        toJSON: () => ({ endpoint, keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } }),
        unsubscribe: async () => {
          iscritta = null;
          return true;
        },
      };
      const registrazione = {
        pushManager: {
          getSubscription: async () => iscritta,
          subscribe: async () => {
            iscritta = iscrizione;
            return iscrizione;
          },
        },
      };
      // Su iPhone il Web Push esiste solo con Noxa sulla schermata Home: si simula l'app
      // installata (Safari la segnala con navigator.standalone). Negli altri browser non conta.
      Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
      // Il WebKit di Playwright su Linux non ha PushManager (Safari sì, da iOS 16.4).
      if (!('PushManager' in window)) {
        Object.defineProperty(window, 'PushManager', { configurable: true, value: class {} });
      }
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
          register: async () => registrazione,
          getRegistration: async () => registrazione,
          ready: Promise.resolve(registrazione),
          addEventListener: () => undefined,
        },
      });
    },
    { esito, endpoint: ENDPOINT },
  );
}

const richiestePermesso = (pagina: Page) =>
  pagina.evaluate(() => (window as unknown as { __richiestePermesso: number }).__richiestePermesso);

for (const tema of TEMI) {
  test(`notifiche sul telefono senza violazioni axe (${tema})`, async ({ page }) => {
    await simulaPush(page);
    await impostaTema(page, tema);
    await page.goto('/profilo/privacy/');
    await page.getByRole('switch', { name: /Notifiche sul telefono/ }).click();
    await expect(
      page.getByRole('dialog', { name: 'Ricevi le notifiche sul telefono' }),
    ).toBeVisible();
    await verificaAccessibilita(page, 'dialog[open]');
  });
}

test('prima il foglio di Noxa: «Non ora» non chiede il permesso al sistema', async ({ page }) => {
  await simulaPush(page);
  await page.goto('/profilo/privacy/');
  const interruttore = page.getByRole('switch', { name: /Notifiche sul telefono/ });
  await expect(interruttore).toHaveAttribute('aria-checked', 'false');
  await interruttore.click();
  const foglio = page.getByRole('dialog', { name: 'Ricevi le notifiche sul telefono' });
  await expect(
    foglio.getByText('Nomi e testi di altre persone sulla schermata di blocco'),
  ).toBeVisible();
  // "Attiva" e "Non ora" hanno lo stesso peso (R-43).
  const attiva = foglio.getByRole('button', { name: 'Attiva' });
  const nonOra = foglio.getByRole('button', { name: 'Non ora' });
  expect(await attiva.getAttribute('class')).toBe(await nonOra.getAttribute('class'));
  await nonOra.click();
  await expect(foglio).toBeHidden();
  expect(await richiestePermesso(page)).toBe(0);
});

test('attivate: permesso dopo «Attiva» e dispositivo registrato con un’etichetta generica', async ({
  page,
  supabase,
}) => {
  await simulaPush(page);
  await page.goto('/profilo/privacy/');
  await page.getByRole('switch', { name: /Notifiche sul telefono/ }).click();
  const foglio = page.getByRole('dialog', { name: 'Ricevi le notifiche sul telefono' });
  supabase.dispositivi = [
    {
      id: '00000000-0000-4000-8000-00000000e901',
      token: ENDPOINT,
      descrizione: 'Android · Chrome',
      ultimo_uso_il: new Date().toISOString(),
    },
  ];
  await foglio.getByRole('button', { name: 'Attiva' }).click();
  await expect(foglio.getByText('Notifiche attive su questo dispositivo')).toBeVisible();
  await expect(foglio.getByText('Un amico ha fatto check-in')).toBeVisible();
  expect(await richiestePermesso(page)).toBe(1);
  const registrazione = supabase.chiamate('registra_dispositivo_push').at(-1)?.corpo as Record<
    string,
    string
  >;
  expect(registrazione).toMatchObject({ piattaforma: 'web', token: ENDPOINT });
  // Solo sistema e browser, mai modello né versione (R-66).
  expect(registrazione.descrizione).toMatch(
    /^(Android · Chrome|Browser · (Chrome|Firefox) su computer|Telefono · Noxa dalla Home)$/,
  );
  await foglio.getByRole('button', { name: 'Fatto' }).click();
  await expect(page.getByRole('switch', { name: /Notifiche sul telefono/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByText('Questo dispositivo', { exact: true })).toBeVisible();
});

test('permesso negato dal sistema: l’interruttore resta spento e si spiega dove cambiarlo', async ({
  page,
}) => {
  await simulaPush(page, 'denied');
  await page.goto('/profilo/privacy/');
  const interruttore = page.getByRole('switch', { name: /Notifiche sul telefono/ });
  await expect(interruttore).toBeDisabled();
  await expect(page.getByText('Le notifiche sono bloccate dal browser')).toBeVisible();
  await expect(page.getByText('Impostazioni sito')).toBeVisible();
});

test('togliere un altro dispositivo', async ({ page, supabase }) => {
  await simulaPush(page);
  supabase.dispositivi = [
    {
      id: '00000000-0000-4000-8000-00000000e902',
      token: 'https://updates.push.services.mozilla.com/wpush/v2/altro',
      descrizione: 'Browser · Firefox su computer',
      ultimo_uso_il: '2026-11-02T20:00:00Z',
    },
  ];
  await page.goto('/profilo/privacy/');
  await expect(page.getByText('ultimo uso 02.11', { exact: false })).toBeVisible();
  supabase.dispositivi = [];
  await page.getByRole('button', { name: 'Togli Browser · Firefox su computer' }).click();
  await expect(page.getByText('Nessun dispositivo.', { exact: false })).toBeVisible();
  expect(supabase.chiamate('dispositivi_push_elimina').at(-1)?.url).toContain(
    'id=eq.00000000-0000-4000-8000-00000000e902',
  );
});

test('riga discreta in fondo all’elenco, nascosta per sempre con «Non mostrare più»', async ({
  page,
}) => {
  await simulaPush(page);
  await page.goto('/notifiche/');
  await expect(page.getByText('Vuoi riceverle anche sul telefono?')).toBeVisible();
  await page.getByRole('button', { name: 'Non mostrare più' }).click();
  await expect(page.getByText('Vuoi riceverle anche sul telefono?')).toBeHidden();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Notifiche', level: 1 })).toBeVisible();
  await expect(page.getByText('Vuoi riceverle anche sul telefono?')).toBeHidden();
});

test('una notifica che non c’è più apre l’elenco con «Non è più disponibile»', async ({ page }) => {
  await page.goto('/notifiche/?apri=00000000-0000-4000-8000-00000000e899');
  await expect(page.getByText('Non è più disponibile.')).toBeVisible();
});

test.describe('iPhone da Safari', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });

  test('al posto dell’interruttore i due passi per aggiungere Noxa alla Home', async ({ page }) => {
    await page.goto('/profilo/privacy/');
    await expect(page.getByText('Su iPhone serve Noxa sulla schermata Home')).toBeVisible();
    const passi = page.getByRole('listitem').filter({ hasText: 'Aggiungi alla schermata Home' });
    await expect(passi).toBeVisible();
    await expect(page.getByRole('switch', { name: /Notifiche sul telefono/ })).toHaveCount(0);
  });
});
