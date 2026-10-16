import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Page, type Request } from '@playwright/test';

export { expect };

export const TEMI = ['scuro', 'chiaro'] as const;
export type TemaProva = (typeof TEMI)[number];

/** Origine fittizia del bucket `mappe` nei test: le richieste sono servite dalle fixture. */
export const ORIGINE_MAPPE = 'http://mappe.noxa.test';

/** Origine fittizia di Supabase nella build dei test (playwright.config.ts). */
export const ORIGINE_SUPABASE = 'http://supabase.noxa.test';

/** Imposta il tema prima che la pagina si carichi, come farebbe la scelta dell'utente. */
export async function impostaTema(pagina: Page, tema: TemaProva) {
  await pagina.addInitScript((valore) => {
    window.localStorage.setItem('noxa-tema', valore);
  }, tema);
}

/** Aspetta la fine delle animazioni di ingresso (ADR-0019), così axe misura lo stato finale. */
export async function attendiAnimazioni(pagina: Page) {
  await pagina.waitForFunction(() =>
    document.getAnimations().every((animazione) => animazione.playState !== 'running'),
  );
}

/** Nessuna violazione WCAG 2.2 AA (DESIGN.md §4). */
export async function verificaAccessibilita(pagina: Page) {
  await attendiAnimazioni(pagina);
  const risultato = await new AxeBuilder({ page: pagina })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .exclude('.maplibregl-canvas')
    .analyze();
  expect(risultato.violations).toEqual([]);
}

// ---------------------------------------------------------------------------------------------
// Supabase simulato
// ---------------------------------------------------------------------------------------------

export const UTENTE_DI_PROVA = '00000000-0000-4000-8000-0000000000e2';

export type AccountSimulato = {
  username: string;
  nome_visualizzato: string;
  stato_account: 'attivo' | 'sospeso';
  minorenne: boolean;
  onboarding_completato: boolean;
  documenti_da_accettare: Array<{
    tipo: 'termini' | 'privacy';
    versione: string;
    in_vigore_dal: string;
    novita: string[];
  }>;
};

export const ACCOUNT_DI_PROVA: AccountSimulato = {
  username: 'giulia.rota',
  nome_visualizzato: 'Giulia',
  stato_account: 'attivo',
  minorenne: true,
  onboarding_completato: true,
  documenti_da_accettare: [],
};

/** Endpoint di Supabase simulati, con la risposta da dare a ciascuno. */
export type Endpoint =
  | 'signup'
  | 'resend'
  | 'verify'
  | 'token'
  | 'recover'
  | 'aggiorna_utente'
  | 'logout'
  | 'mio_account'
  | 'profili_privati'
  | 'consensi';

type Risposta = { stato: number; corpo?: unknown } | 'rete';

function base64url(valore: unknown): string {
  return Buffer.from(JSON.stringify(valore)).toString('base64url');
}

/** Token con la forma di un JWT: l'app non ne verifica la firma, lo fa Supabase. */
function tokenDiProva(): string {
  const scadenza = Math.floor(Date.now() / 1000) + 3600 * 24;
  return [
    base64url({ alg: 'HS256', typ: 'JWT' }),
    base64url({
      sub: UTENTE_DI_PROVA,
      role: 'authenticated',
      aud: 'authenticated',
      exp: scadenza,
      aal: 'aal1',
    }),
    'firma-di-prova',
  ].join('.');
}

function utente(email = 'giulia.rota@example.com') {
  return {
    id: UTENTE_DI_PROVA,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: '2026-10-16T08:00:00Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    created_at: '2026-10-16T08:00:00Z',
    updated_at: '2026-10-16T08:00:00Z',
  };
}

function sessione() {
  return {
    access_token: tokenDiProva(),
    token_type: 'bearer',
    expires_in: 3600 * 24,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
    refresh_token: 'rinnovo-di-prova',
    user: utente(),
  };
}

/** Errore di Supabase Auth come lo restituisce l'API. */
export function erroreAuth(
  stato: number,
  codice: string,
  messaggio = codice,
  extra = {},
): Risposta {
  return { stato, corpo: { code: stato, error_code: codice, msg: messaggio, ...extra } };
}

export class SupabaseSimulato {
  readonly richieste: Array<{ endpoint: Endpoint; corpo: unknown; url: string }> = [];
  private readonly risposte = new Map<Endpoint, Risposta>();
  account: AccountSimulato | null;

  constructor(account: AccountSimulato | null) {
    this.account = account;
  }

  rispondi(endpoint: Endpoint, risposta: Risposta) {
    this.risposte.set(endpoint, risposta);
  }

  chiamate(endpoint: Endpoint) {
    return this.richieste.filter((richiesta) => richiesta.endpoint === endpoint);
  }

  private predefinita(endpoint: Endpoint): Risposta {
    switch (endpoint) {
      case 'signup':
        return { stato: 200, corpo: { ...utente(), email_confirmed_at: null } };
      case 'verify':
      case 'token':
        return { stato: 200, corpo: sessione() };
      case 'aggiorna_utente':
        return { stato: 200, corpo: utente() };
      case 'mio_account':
        return { stato: 200, corpo: this.account };
      case 'logout':
      case 'profili_privati':
        return { stato: 204 };
      case 'consensi':
        return { stato: 201 };
      default:
        return { stato: 200, corpo: {} };
    }
  }

  private static endpoint(richiesta: Request): Endpoint | null {
    const url = new URL(richiesta.url());
    const percorso = url.pathname;
    if (percorso === '/auth/v1/signup') return 'signup';
    if (percorso === '/auth/v1/resend') return 'resend';
    if (percorso === '/auth/v1/verify') return 'verify';
    if (percorso === '/auth/v1/token') return 'token';
    if (percorso === '/auth/v1/recover') return 'recover';
    if (percorso === '/auth/v1/user') return 'aggiorna_utente';
    if (percorso === '/auth/v1/logout') return 'logout';
    if (percorso === '/rest/v1/rpc/mio_account') return 'mio_account';
    if (percorso === '/rest/v1/profili_privati') return 'profili_privati';
    if (percorso === '/rest/v1/consensi') return 'consensi';
    return null;
  }

  async collega(pagina: Page) {
    await pagina.route(`${ORIGINE_SUPABASE}/**`, async (route) => {
      const richiesta = route.request();
      const intestazioni = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      };
      if (richiesta.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: intestazioni });
        return;
      }
      const endpoint = SupabaseSimulato.endpoint(richiesta);
      if (!endpoint) {
        await route.fulfill({
          status: 404,
          headers: intestazioni,
          json: { message: 'non simulato' },
        });
        return;
      }
      let corpo: unknown = null;
      try {
        corpo = richiesta.postDataJSON();
      } catch {
        corpo = richiesta.postData();
      }
      this.richieste.push({ endpoint, corpo, url: richiesta.url() });
      const risposta = this.risposte.get(endpoint) ?? this.predefinita(endpoint);
      if (risposta === 'rete') {
        await route.abort('internetdisconnected');
        return;
      }
      if (risposta.corpo === undefined) {
        await route.fulfill({ status: risposta.stato, headers: intestazioni });
        return;
      }
      await route.fulfill({ status: risposta.stato, headers: intestazioni, json: risposta.corpo });
    });
  }
}

/**
 * Sessione salvata sul dispositivo, come dopo un accesso. Si imposta solo al primo
 * caricamento della scheda, così un'uscita dall'account resta tale anche dopo una navigazione.
 */
export async function impostaSessione(pagina: Page) {
  await pagina.addInitScript((valore) => {
    if (window.sessionStorage.getItem('noxa-sessione-di-prova')) return;
    window.sessionStorage.setItem('noxa-sessione-di-prova', '1');
    window.localStorage.setItem('noxa-sessione', valore);
  }, JSON.stringify(sessione()));
}

/** Cloudflare Turnstile finto: rende un riquadro e consegna subito un token. */
export async function simulaTurnstile(pagina: Page) {
  await pagina.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.turnstile = {
        render(el, o) { const s = document.createElement('p'); s.textContent = 'Verifica completata'; el.append(s); setTimeout(() => o.callback('token-turnstile-di-prova'), 50); return 'w1'; },
        reset() {}, remove() {}
      };`,
    }),
  );
}

type Opzioni = {
  /** Account con cui si apre l'app; null = nessuna sessione sul dispositivo. */
  account: AccountSimulato | null;
};

/**
 * Test con Supabase e Turnstile simulati. Per default l'utente ha già un account completo,
 * così i test delle aree non passano dal Benvenuto (R-07).
 */
export const test = base.extend<Opzioni & { supabase: SupabaseSimulato }>({
  account: [ACCOUNT_DI_PROVA, { option: true }],
  supabase: [
    async ({ page, account }, usa) => {
      const simulato = new SupabaseSimulato(account);
      await simulato.collega(page);
      await simulaTurnstile(page);
      if (account) await impostaSessione(page);
      await usa(simulato);
    },
    { auto: true },
  ],
});
