import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Page, type Request } from '@playwright/test';

export { expect };

export const TEMI = ['scuro', 'chiaro'] as const;
export type TemaProva = (typeof TEMI)[number];

/** Origine fittizia del bucket `mappe` nei test: le richieste sono servite dalle fixture. */
export const ORIGINE_MAPPE = 'http://mappe.noxa.test';

/** Origine fittizia di Supabase nella build dei test (playwright.config.ts). */
export const ORIGINE_SUPABASE = 'http://supabase.noxa.test';

const FIXTURE = new URL('./fixture/', import.meta.url);

/**
 * Bucket `mappe` simulato: PMTiles con le richieste a intervalli (Range) e glifi dalla
 * fixture, così la mappa si carica senza rete (ADR-0016).
 */
export async function simulaMappe(pagina: Page) {
  const pmtiles = await readFile(new URL('fixture-e2e.pmtiles', FIXTURE));
  const glifo = await readFile(new URL('glifo-0-255.pbf', FIXTURE));
  await pagina.route(`${ORIGINE_MAPPE}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('.pmtiles')) {
      const intervallo = /bytes=(\d+)-(\d+)/.exec(route.request().headers()['range'] ?? '');
      const inizio = Number(intervallo?.[1] ?? 0);
      const fine = Math.min(Number(intervallo?.[2] ?? pmtiles.length - 1), pmtiles.length - 1);
      await route.fulfill({
        status: 206,
        headers: {
          'Content-Range': `bytes ${inizio}-${fine}/${pmtiles.length}`,
          'Content-Type': 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'Content-Range, ETag',
        },
        body: pmtiles.subarray(inizio, fine + 1),
      });
      return;
    }
    if (url.pathname.includes('/assets/fonts/')) {
      await route.fulfill({
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: glifo,
      });
      return;
    }
    await route.fulfill({ status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
}

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
  | 'consensi'
  | 'amicizie_leggi'
  | 'amicizie_crea'
  | 'amicizie_aggiorna'
  | 'amicizie_elimina'
  | 'cerca_utenti'
  | 'crea_codice_invito'
  | 'anteprima_codice_invito'
  | 'usa_codice_invito'
  | 'avviso_richiesta'
  | 'miei_bloccati'
  | 'mie_segnalazioni'
  | 'blocchi_crea'
  | 'blocchi_elimina'
  | 'segnalazioni_crea'
  | 'profili_leggi'
  | 'profili_aggiorna'
  | 'codici_invito_leggi'
  | 'cerca_eventi'
  | 'dettaglio_evento'
  | 'generi_musicali'
  | 'profili_privati_leggi'
  | 'partecipazioni_crea'
  | 'partecipazioni_aggiorna'
  | 'partecipazioni_elimina'
  | 'firma_immagini';

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

/** Persone di prova delle schermate degli amici. */
export const PERSONE = {
  marco: {
    id: '00000000-0000-4000-8000-0000000000f1',
    username: 'marco.brivio',
    nome_visualizzato: 'Marco',
  },
  davide: {
    id: '00000000-0000-4000-8000-0000000000f2',
    username: 'davide.sala',
    nome_visualizzato: 'Davide',
  },
  marta: {
    id: '00000000-0000-4000-8000-0000000000f3',
    username: 'marta.re',
    nome_visualizzato: 'Marta',
  },
  sara: {
    id: '00000000-0000-4000-8000-0000000000f4',
    username: 'sara.colombo',
    nome_visualizzato: 'Sara',
  },
};
type PersonaProva = (typeof PERSONE)[keyof typeof PERSONE];
const IO = { id: UTENTE_DI_PROVA, username: 'giulia.rota', nome_visualizzato: 'Giulia' };

/** Riga di `amicizie` con i profili incorporati, come la restituisce PostgREST. */
export function amicizia(
  id: string,
  altro: PersonaProva,
  stato: 'in_attesa' | 'accettata',
  verso: 'inviata' | 'ricevuta',
  canale: 'ricerca' | 'codice_invito' = 'ricerca',
) {
  const [richiedente, destinatario] = verso === 'inviata' ? [IO, altro] : [altro, IO];
  return {
    id,
    stato,
    canale,
    creata_il: '2026-10-16T10:00:00Z',
    richiedente_id: richiedente.id,
    destinatario_id: destinatario.id,
    richiedente,
    destinatario,
  };
}

/** Amici, una richiesta ricevuta da codice e una inviata. */
export const AMICIZIE_DI_PROVA = [
  amicizia('00000000-0000-4000-8000-00000000a001', PERSONE.marco, 'accettata', 'inviata'),
  amicizia(
    '00000000-0000-4000-8000-00000000a002',
    PERSONE.davide,
    'in_attesa',
    'ricevuta',
    'codice_invito',
  ),
  amicizia('00000000-0000-4000-8000-00000000a003', PERSONE.marta, 'in_attesa', 'inviata'),
];

// ---------------------------------------------------------------------------------------------
// Catalogo degli eventi (Scopri, iterazione 4)
// ---------------------------------------------------------------------------------------------

/** Serata in corso a Milano (AAAA-MM-GG): fino alle 06:00 vale ancora quella di ieri. */
export function serataDiProva(spostamento = 0): string {
  const istante = new Date(Date.now() - 6 * 3600_000 + spostamento * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(istante);
}

/** Istante a Milano nella serata `giorno` (le ore dopo mezzanotte vanno al giorno dopo). */
function alle(giorno: string, ora: string, giornoDopo = false): string {
  const [anno, mese, data] = giorno.split('-').map(Number) as [number, number, number];
  const [hh, mm] = ora.split(':').map(Number) as [number, number];
  const comeUtc = Date.UTC(anno, mese - 1, data + (giornoDopo ? 1 : 0), hh, mm);
  // Differenza tra Milano e UTC in quel momento (ora legale o solare).
  const aMilano = new Date(new Date(comeUtc).toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
  const aUtc = new Date(new Date(comeUtc).toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(comeUtc - (aMilano.getTime() - aUtc.getTime())).toISOString();
}

export const LOCALI_DI_PROVA = {
  binario: {
    id: '00000000-0000-4000-8000-00000000c001',
    nome: 'Club Binario 7',
    comune: 'Monza',
    lat: 45.5845,
    lon: 9.2744,
  },
  lambro: {
    id: '00000000-0000-4000-8000-00000000c002',
    nome: 'Officina Lambro',
    comune: 'Monza',
    lat: 45.578,
    lon: 9.28,
  },
  ventuno: {
    id: '00000000-0000-4000-8000-00000000c004',
    nome: 'Sala Ventuno',
    comune: 'Desio',
    lat: 45.618,
    lon: 9.207,
  },
};

type LocaleProva = (typeof LOCALI_DI_PROVA)[keyof typeof LOCALI_DI_PROVA];

export function eventoDiProva(dati: {
  id: string;
  titolo: string;
  locale: LocaleProva;
  giorno?: string;
  inizio: string;
  fine?: string;
  eta?: number;
  dichiarata?: boolean;
  generi?: string[];
  prezzo?: number | null;
  stato?: 'pubblicato' | 'annullato';
  copertina?: { tipo: 'locale' | 'flyer'; path: string; attribuzione?: string };
  amici?: Array<{ id: string; nome_visualizzato: string; stato: 'partecipo' | 'interessato' }>;
  mia?: 'interessato' | 'partecipo' | null;
  distanza?: number | null;
}) {
  const giorno = dati.giorno ?? serataDiProva();
  const fine = dati.fine ?? '04:00';
  return {
    id: dati.id,
    titolo: dati.titolo,
    inizio: alle(giorno, dati.inizio),
    fine: alle(giorno, fine, fine < dati.inizio),
    data_serata: giorno,
    eta_minima: dati.eta ?? 18,
    eta_minima_dichiarata: dati.dichiarata ?? true,
    stato: dati.stato ?? 'pubblicato',
    prezzo_min_centesimi: dati.prezzo === undefined ? 1500 : dati.prezzo,
    generi_evento: dati.generi ?? ['techno'],
    locale_id: dati.locale.id,
    locale_nome: dati.locale.nome,
    locale_comune: dati.locale.comune,
    locale_lat: dati.locale.lat,
    locale_lon: dati.locale.lon,
    distanza_m: dati.distanza ?? null,
    copertina_tipo: dati.copertina?.tipo ?? 'tipografica',
    copertina_path: dati.copertina?.path ?? null,
    copertina_attribuzione: dati.copertina?.attribuzione ?? null,
    amici_partecipano: (dati.amici ?? []).filter((a) => a.stato === 'partecipo').length,
    amici_interessati: (dati.amici ?? []).filter((a) => a.stato === 'interessato').length,
    amici: dati.amici ?? [],
    mia_partecipazione: dati.mia ?? null,
  };
}

export const EVENTI_DI_PROVA = [
  eventoDiProva({
    id: '00000000-0000-4000-8000-00000000e001',
    titolo: 'Notte Ferrovia',
    locale: LOCALI_DI_PROVA.binario,
    inizio: '23:00',
    fine: '05:00',
    generi: ['techno', 'house'],
    copertina: {
      tipo: 'locale',
      path: '00000000-0000-4000-8000-00000000c001.webp',
      attribuzione: 'Laura Bassi, CC BY 4.0',
    },
    amici: [
      {
        id: '00000000-0000-4000-8000-0000000000f1',
        nome_visualizzato: 'Marco',
        stato: 'partecipo',
      },
      { id: '00000000-0000-4000-8000-0000000000f4', nome_visualizzato: 'Sara', stato: 'partecipo' },
    ],
  }),
  eventoDiProva({
    id: '00000000-0000-4000-8000-00000000e002',
    titolo: 'Open Decks',
    locale: LOCALI_DI_PROVA.lambro,
    inizio: '21:30',
    fine: '00:30',
    eta: 14,
    generi: ['house'],
    prezzo: 0,
  }),
  eventoDiProva({
    id: '00000000-0000-4000-8000-00000000e003',
    titolo: 'Bassi Lunghi',
    locale: LOCALI_DI_PROVA.lambro,
    inizio: '22:30',
    dichiarata: false,
    generi: ['hip_hop', 'reggaeton'],
    prezzo: null,
  }),
  eventoDiProva({
    id: '00000000-0000-4000-8000-00000000e005',
    titolo: 'Reggaeton Night',
    locale: LOCALI_DI_PROVA.ventuno,
    giorno: serataDiProva(1),
    inizio: '23:00',
    generi: ['reggaeton', 'commerciale'],
  }),
];

export const DETTAGLIO_DI_PROVA = {
  ...EVENTI_DI_PROVA[0]!,
  descrizione: 'Techno e house fino all’alba nella sala grande.',
  artisti: ['Nera Vale', 'Corrado B.', 'Otto Fili'],
  url_biglietti: 'https://binario7.example/biglietti',
  locale_indirizzo: 'Via dei Cantieri 12',
  fonte_tipo: 'sito_locale',
  fonte_url: 'https://binario7.example/eventi/notte-ferrovia',
  amici: [
    {
      id: '00000000-0000-4000-8000-0000000000f1',
      username: 'marco.brivio',
      nome_visualizzato: 'Marco',
      stato: 'partecipo',
    },
    {
      id: '00000000-0000-4000-8000-0000000000f4',
      username: 'sara.colombo',
      nome_visualizzato: 'Sara',
      stato: 'partecipo',
    },
  ],
  mia_visibilita: null,
} as Record<string, unknown>;

export const GENERI_DI_PROVA = [
  { codice: 'altro', nome: 'altro' },
  { codice: 'commerciale', nome: 'commerciale' },
  { codice: 'hip_hop', nome: 'hip hop' },
  { codice: 'house', nome: 'house' },
  { codice: 'indie', nome: 'indie' },
  { codice: 'live', nome: 'live' },
  { codice: 'reggaeton', nome: 'reggaeton' },
  { codice: 'techno', nome: 'techno' },
];

/** Immagine PNG di 1×1 pixel servita al posto delle foto firmate. */
export const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

export class SupabaseSimulato {
  readonly richieste: Array<{ endpoint: Endpoint; corpo: unknown; url: string }> = [];
  private readonly risposte = new Map<Endpoint, Risposta>();
  account: AccountSimulato | null;
  amicizie: unknown[] = AMICIZIE_DI_PROVA;
  /** Partecipazione salvata all'evento del dettaglio, aggiornata dalle chiamate simulate. */
  partecipazione: { stato: string; visibile: boolean } | null = null;
  /** Profili visibili per `profili_leggi` (la RLS reale decide chi si vede). */
  profiliVisibili: PersonaProva[] = Object.values(PERSONE);

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
      case 'amicizie_crea':
      case 'blocchi_crea':
      case 'segnalazioni_crea':
        return { stato: 201 };
      case 'amicizie_leggi':
        return { stato: 200, corpo: this.amicizie };
      case 'amicizie_aggiorna':
      case 'amicizie_elimina':
      case 'blocchi_elimina':
      case 'profili_aggiorna':
        return { stato: 204 };
      case 'cerca_utenti':
        return {
          stato: 200,
          corpo: [
            { ...PERSONE.marco, relazione: 'amici' },
            { ...PERSONE.marta, relazione: 'inviata' },
            { ...PERSONE.sara, relazione: 'nessuna' },
          ],
        };
      case 'crea_codice_invito':
        return {
          stato: 200,
          corpo: [
            { codice: 'K7Q4M2XP9H', scade_il: new Date(Date.now() + 14 * 60_000).toISOString() },
          ],
        };
      case 'codici_invito_leggi':
        return { stato: 200, corpo: { usato_il: null } };
      case 'anteprima_codice_invito':
        return {
          stato: 200,
          corpo: [
            {
              stato: 'valido',
              titolare_id: PERSONE.sara.id,
              username: PERSONE.sara.username,
              nome_visualizzato: PERSONE.sara.nome_visualizzato,
              avviso_fasce: false,
            },
          ],
        };
      case 'usa_codice_invito':
        return { stato: 200, corpo: '00000000-0000-4000-8000-00000000a009' };
      case 'avviso_richiesta':
        return { stato: 200, corpo: false };
      case 'miei_bloccati':
        return {
          stato: 200,
          corpo: [{ ...PERSONE.sara, bloccato_il: '2026-10-15T20:00:00Z' }],
        };
      case 'mie_segnalazioni':
        return {
          stato: 200,
          corpo: [
            {
              id: '00000000-0000-4000-8000-00000000b001',
              tipo_oggetto: 'profilo',
              descrizione: '@nome.utente',
              motivo: 'molestie',
              stato: 'in_lavorazione',
              creata_il: '2026-10-14T20:00:00Z',
              chiusa_il: null,
              decisione: null,
              decisa_il: null,
            },
            {
              id: '00000000-0000-4000-8000-00000000b002',
              tipo_oggetto: 'profilo',
              descrizione: '@utente.anonimo',
              motivo: 'spam',
              stato: 'chiusa',
              creata_il: '2026-10-02T20:00:00Z',
              chiusa_il: '2026-10-05T09:00:00Z',
              decisione: 'Abbiamo controllato: il profilo non viola i Termini.',
              decisa_il: '2026-10-05T09:00:00Z',
            },
          ],
        };
      case 'cerca_eventi':
        return { stato: 200, corpo: EVENTI_DI_PROVA };
      case 'dettaglio_evento':
        return {
          stato: 200,
          corpo: [
            {
              ...DETTAGLIO_DI_PROVA,
              mia_partecipazione: this.partecipazione?.stato ?? null,
              mia_visibilita: this.partecipazione?.visibile ?? null,
            },
          ],
        };
      case 'generi_musicali':
        return { stato: 200, corpo: GENERI_DI_PROVA };
      case 'profili_privati_leggi':
        return { stato: 200, corpo: { partecipazioni_visibili: true } };
      case 'partecipazioni_crea':
        return { stato: 201 };
      case 'partecipazioni_aggiorna':
      case 'partecipazioni_elimina':
        return { stato: 204 };
      case 'firma_immagini':
        return { stato: 200, corpo: [] };
      default:
        return { stato: 200, corpo: {} };
    }
  }

  /** Come il database: la partecipazione salvata torna nel dettaglio successivo. */
  private ricordaPartecipazione(endpoint: Endpoint, corpo: unknown) {
    const dati = (corpo ?? {}) as { stato?: string; visibile_agli_amici?: boolean };
    if (endpoint === 'partecipazioni_elimina') this.partecipazione = null;
    if (endpoint === 'partecipazioni_crea' || endpoint === 'partecipazioni_aggiorna') {
      this.partecipazione = {
        stato: dati.stato ?? this.partecipazione?.stato ?? 'interessato',
        visibile: dati.visibile_agli_amici ?? this.partecipazione?.visibile ?? true,
      };
    }
  }

  /** GET su amicizie, con il filtro `or=(richiedente_id.eq.X,destinatario_id.eq.X)` del profilo. */
  private amicizieFiltrate(richiesta: Request): Risposta {
    const filtro = new URL(richiesta.url()).searchParams.get('or');
    const id = filtro ? /eq\.([0-9a-f-]{36})/.exec(filtro)?.[1] : undefined;
    const righe = (
      this.amicizie as Array<{ richiedente_id: string; destinatario_id: string }>
    ).filter((riga) => !id || riga.richiedente_id === id || riga.destinatario_id === id);
    return { stato: 200, corpo: righe };
  }

  /** GET su profili con `id=eq.…`: un oggetto se visibile, come `maybeSingle()` lo chiede. */
  private profilo(richiesta: Request): Risposta {
    const filtro = new URL(richiesta.url()).searchParams.get('id') ?? '';
    const id = filtro.replace(/^eq\./, '');
    const trovato = this.profiliVisibili.find((persona) => persona.id === id);
    const singolo = (richiesta.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    if (singolo) {
      return trovato
        ? { stato: 200, corpo: trovato }
        : {
            stato: 406,
            corpo: {
              code: 'PGRST116',
              message: 'JSON object requested, multiple (or no) rows returned',
              details: 'The result contains 0 rows',
              hint: null,
            },
          };
    }
    return { stato: 200, corpo: trovato ? [trovato] : [] };
  }

  private static endpoint(richiesta: Request): Endpoint | null {
    const url = new URL(richiesta.url());
    const percorso = url.pathname;
    const metodo = richiesta.method();
    const tabelle: Record<string, Partial<Record<string, Endpoint>>> = {
      '/rest/v1/amicizie': {
        GET: 'amicizie_leggi',
        POST: 'amicizie_crea',
        PATCH: 'amicizie_aggiorna',
        DELETE: 'amicizie_elimina',
      },
      '/rest/v1/blocchi': { POST: 'blocchi_crea', DELETE: 'blocchi_elimina' },
      '/rest/v1/segnalazioni': { POST: 'segnalazioni_crea' },
      '/rest/v1/profili': { GET: 'profili_leggi', PATCH: 'profili_aggiorna' },
      '/rest/v1/codici_invito': { GET: 'codici_invito_leggi' },
      '/rest/v1/generi_musicali': { GET: 'generi_musicali' },
      '/rest/v1/profili_privati': { GET: 'profili_privati_leggi' },
      '/rest/v1/partecipazioni_evento': {
        POST: 'partecipazioni_crea',
        PATCH: 'partecipazioni_aggiorna',
        DELETE: 'partecipazioni_elimina',
      },
    };
    const daTabella = tabelle[percorso]?.[metodo];
    if (daTabella) return daTabella;
    const rpc = /^\/rest\/v1\/rpc\/(\w+)$/.exec(percorso)?.[1];
    const rpcSimulate: readonly string[] = [
      'cerca_utenti',
      'crea_codice_invito',
      'anteprima_codice_invito',
      'usa_codice_invito',
      'avviso_richiesta',
      'miei_bloccati',
      'mie_segnalazioni',
      'cerca_eventi',
      'dettaglio_evento',
    ];
    if (rpc && rpcSimulate.includes(rpc)) return rpc as Endpoint;
    if (percorso.startsWith('/storage/v1/object/sign/') && metodo === 'POST')
      return 'firma_immagini';
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
      if (!this.risposte.has(endpoint)) this.ricordaPartecipazione(endpoint, corpo);
      const risposta =
        this.risposte.get(endpoint) ??
        (endpoint === 'profili_leggi'
          ? this.profilo(richiesta)
          : endpoint === 'amicizie_leggi'
            ? this.amicizieFiltrate(richiesta)
            : this.predefinita(endpoint));
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

/**
 * Cloudflare Turnstile finto: consegna il token e poi scrive "Verifica completata", così i
 * test che aspettano il testo hanno già il token (in CI la macchina è più lenta).
 */
export async function simulaTurnstile(pagina: Page) {
  await pagina.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.turnstile = {
        render(el, o) { setTimeout(() => { o.callback('token-turnstile-di-prova'); const s = document.createElement('p'); s.textContent = 'Verifica completata'; el.append(s); }, 50); return 'w1'; },
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
