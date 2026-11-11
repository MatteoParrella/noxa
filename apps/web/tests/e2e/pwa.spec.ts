import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './supporto';

// Qui si prova proprio il service worker: attivo anche su WebKit (playwright.config.ts).
test.use({ serviceWorkers: 'allow' });

test('l’app è installabile: manifest, icone e service worker', async ({ page, request }) => {
  await page.goto('/scopri/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/manifest.webmanifest');

  const manifest = (await (await request.get('/manifest.webmanifest')).json()) as {
    lang: string;
    display: string;
    start_url: string;
    icons: Array<{ src: string; sizes: string; purpose: string }>;
  };
  expect(manifest).toMatchObject({ lang: 'it', display: 'standalone', start_url: '/scopri/' });
  expect(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable')).toBe(true);
  for (const icona of manifest.icons) expect((await request.get(icona.src)).ok()).toBe(true);

  expect((await request.get('/sw.js')).ok()).toBe(true);
  await expect
    .poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration())))
    .toBe(true);
});

const CARTELLA_BUILD = new URL('../../out/', import.meta.url).pathname;

const TIPI: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Server statico della stessa build, solo per questi test: il browser scarica lo script del
 * service worker senza passare da page.route, quindi un "deploy nuovo" si simula cambiando
 * `sw.js` qui, senza toccare il server condiviso dagli altri test.
 */
async function avviaServerConVersione() {
  const stato = { versione: 1 };
  const server: Server = createServer((richiesta, risposta) => {
    void (async () => {
      const percorso = normalize(
        decodeURIComponent(new URL(richiesta.url ?? '/', 'http://x').pathname),
      );
      const candidati = percorso.endsWith('/')
        ? [join(percorso, 'index.html')]
        : [percorso, `${percorso}.html`, join(percorso, 'index.html')];
      for (const candidato of candidati) {
        try {
          let corpo: Buffer | string = await readFile(join(CARTELLA_BUILD, candidato));
          if (candidato === '/sw.js')
            corpo = `${corpo.toString()}\n// versione ${stato.versione}\n`;
          risposta.writeHead(200, {
            'Content-Type': TIPI[extname(candidato)] ?? 'application/octet-stream',
            'Cache-Control': 'no-cache',
          });
          risposta.end(corpo);
          return;
        } catch {
          // Si prova il candidato successivo.
        }
      }
      risposta.writeHead(404).end();
    })();
  });
  await new Promise<void>((pronto) => server.listen(0, '127.0.0.1', pronto));
  const { port } = server.address() as AddressInfo;
  return {
    origine: `http://127.0.0.1:${port}`,
    nuovaVersione: () => {
      stato.versione += 1;
    },
    chiudi: () => new Promise<void>((fatto) => server.close(() => fatto())),
  };
}

async function apriConServiceWorker(page: Page, origine: string) {
  await page.goto(`${origine}/scopri/`);
  // La prima installazione scarica tutto il precache: può richiedere qualche secondo.
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {
      timeout: 30_000,
    })
    .toBe(true);
}

async function cercaAggiornamento(page: Page) {
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())?.update();
  });
}

test.describe('avviso della versione nuova', () => {
  let server: Awaited<ReturnType<typeof avviaServerConVersione>>;
  test.beforeEach(async () => {
    // Ogni test scarica il precache due volte (prima installazione e versione nuova): con
    // molti browser in parallelo supera facilmente il limite normale.
    test.slow();
    server = await avviaServerConVersione();
  });
  test.afterEach(async () => {
    await server.chiudi();
  });

  test('una versione nuova mostra l’avviso e «Ricarica» la attiva', async ({ page }) => {
    await apriConServiceWorker(page, server.origine);
    const avviso = page.getByRole('status').filter({ hasText: 'È disponibile una nuova versione' });
    await expect(avviso).toHaveCount(0);

    server.nuovaVersione();
    await cercaAggiornamento(page);
    await expect(avviso).toBeVisible();
    // Fino alla scelta dell'utente la versione nuova resta in attesa.
    expect(
      await page.evaluate(async () =>
        Boolean((await navigator.serviceWorker.getRegistration())?.waiting),
      ),
    ).toBe(true);

    const ricaricata = page.waitForEvent('load');
    await avviso.getByRole('button', { name: 'Ricarica' }).click();
    await ricaricata;
    await expect(avviso).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const registrazione = await navigator.serviceWorker.getRegistration();
          return Boolean(registrazione?.active && !registrazione.waiting);
        }),
      )
      .toBe(true);
  });

  test('l’avviso si può chiudere e la pagina resta com’è', async ({ page }) => {
    await apriConServiceWorker(page, server.origine);
    server.nuovaVersione();
    await cercaAggiornamento(page);
    const avviso = page.getByRole('status').filter({ hasText: 'È disponibile una nuova versione' });
    await expect(avviso).toBeVisible();
    await avviso.getByRole('button', { name: 'Chiudi' }).click();
    await expect(avviso).toHaveCount(0);
  });
});
