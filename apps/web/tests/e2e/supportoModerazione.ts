import type { Page, Request, Route } from '@playwright/test';
import { ORIGINE_SUPABASE, PIXEL_PNG, UTENTE_DI_PROVA, serataDiProva } from './supporto';

/**
 * Supabase simulato per l'area di moderazione (design/F-40-moderazione-fonti): due fattori,
 * ruolo, RPC e tabelle della moderazione. Le richieste che non riguardano l'area passano al
 * simulatore generale di `supporto.ts`.
 */

export const FATTORE = 'fattore-totp-1';
export const CODICE_GIUSTO = '481902';

const ID = {
  binario: '00000000-0000-4000-8000-00000000c001',
  lambro: '00000000-0000-4000-8000-00000000c002',
  ventuno: '00000000-0000-4000-8000-00000000c004',
  fonteSito: '00000000-0000-4000-8000-00000000f001',
  fonteInstagram: '00000000-0000-4000-8000-00000000f002',
  fonteDaVerificare: '00000000-0000-4000-8000-00000000f003',
  grezzo: '00000000-0000-4000-8000-00000000d001',
  evento: '00000000-0000-4000-8000-00000000e003',
  candidatoOsm: '00000000-0000-4000-8000-0000000000a1',
  candidatoGoogle: '00000000-0000-4000-8000-0000000000a3',
} as const;
export const ID_MODERAZIONE = ID;

function base64url(valore: unknown): string {
  return Buffer.from(JSON.stringify(valore)).toString('base64url');
}

/** Token con livello di accesso e momento dell'ultimo codice (claim `amr`). */
export function tokenModeratore(aal: 'aal1' | 'aal2', codiceIl = Date.now()): string {
  const adesso = Math.floor(Date.now() / 1000);
  return [
    base64url({ alg: 'HS256', typ: 'JWT' }),
    base64url({
      sub: UTENTE_DI_PROVA,
      role: 'authenticated',
      aud: 'authenticated',
      exp: adesso + 3600 * 24,
      aal,
      amr:
        aal === 'aal2'
          ? [
              { method: 'totp', timestamp: Math.floor(codiceIl / 1000) },
              { method: 'password', timestamp: adesso - 60 },
            ]
          : [{ method: 'password', timestamp: adesso - 60 }],
    }),
    'firma-di-prova',
  ].join('.');
}

function utente(fattori: Array<{ id: string; status: 'verified' | 'unverified' }>) {
  return {
    id: UTENTE_DI_PROVA,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'moderatore@example.com',
    email_confirmed_at: '2026-10-16T08:00:00Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    factors: fattori.map((f) => ({
      id: f.id,
      factor_type: 'totp',
      status: f.status,
      friendly_name: 'Noxa moderazione',
      created_at: '2026-10-16T08:00:00Z',
      updated_at: '2026-10-16T08:00:00Z',
    })),
    created_at: '2026-10-16T08:00:00Z',
    updated_at: '2026-10-16T08:00:00Z',
  };
}

function sessione(
  aal: 'aal1' | 'aal2',
  fattori: Array<{ id: string; status: 'verified' | 'unverified' }>,
) {
  return {
    access_token: tokenModeratore(aal),
    token_type: 'bearer',
    expires_in: 3600 * 24,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
    refresh_token: 'rinnovo-di-prova',
    user: utente(fattori),
  };
}

const ADESSO = new Date().toISOString();
const serata = serataDiProva();

export function localeElenco(
  dati: Partial<Record<string, unknown>> & { id: string; nome: string },
) {
  return {
    comune: 'Monza',
    provincia: 'MB',
    attivo: true,
    da_verificare: false,
    immagine_path: null,
    fonti_totali: 1,
    fonti_attive: 1,
    eventi_7_giorni: 2,
    aggiornato_il: ADESSO,
    ...dati,
  };
}

export const LOCALI = [
  localeElenco({
    id: ID.binario,
    nome: 'Club Binario 7',
    immagine_path: `${ID.binario}.webp`,
    fonti_totali: 2,
    fonti_attive: 2,
    eventi_7_giorni: 5,
  }),
  localeElenco({ id: ID.lambro, nome: 'Officina Lambro', fonti_totali: 2, fonti_attive: 1 }),
  localeElenco({
    id: ID.ventuno,
    nome: 'Sala Ventuno',
    comune: 'Desio',
    da_verificare: true,
    fonti_attive: 0,
  }),
  localeElenco({
    id: '00000000-0000-4000-8000-00000000c006',
    nome: 'Spazio Navile',
    comune: 'Milano',
    provincia: 'MI',
    attivo: false,
    fonti_totali: 0,
    fonti_attive: 0,
    eventi_7_giorni: 0,
  }),
];

const LOCALE_SCHEDA = {
  id: ID.binario,
  nome: 'Club Binario 7',
  indirizzo: 'Via dei Cantieri 12',
  comune: 'Monza',
  provincia: 'MB',
  lat: 45.5845,
  lon: 9.2744,
  osm_id: null,
  google_place_id: null,
  sito_web: 'https://binario7.example',
  instagram_username: 'clubbinario7',
  attivo: true,
  immagine_path: null,
  immagine_fonte: null,
  immagine_attribuzione: null,
  immagine_riferimento: null,
  immagine_approvata_da: null,
  immagine_approvata_il: null,
  aggiornato_il: ADESSO,
};

export const CANDIDATI = [
  {
    id: ID.candidatoOsm,
    origine: 'osm',
    osm_id: 'node/101',
    google_place_id: null,
    nome: 'Club Binario Sette',
    indirizzo: 'Via dei Cantieri 12',
    comune: 'Monza',
    provincia: 'MB',
    lat: 45.5846,
    lon: 9.2745,
    sito_web: null,
    doppione_id: ID.binario,
    doppione_nome: 'Club Binario 7',
  },
  {
    id: ID.candidatoGoogle,
    origine: 'google',
    osm_id: null,
    google_place_id: 'ChIJ-prova',
    nome: null,
    indirizzo: null,
    comune: null,
    provincia: null,
    lat: null,
    lon: null,
    sito_web: null,
    doppione_id: null,
    doppione_nome: null,
  },
];

function fonte(dati: Partial<Record<string, unknown>> & { id: string }) {
  return {
    locale_id: ID.binario,
    tipo: 'sito_locale',
    url: 'https://binario7.example/eventi',
    adattatore: 'sito_jsonld',
    frequenza_minuti: 360,
    pagine_massime: 3,
    stato_conformita: 'consentita',
    robots_esito: 'consentito',
    termini_url: 'https://binario7.example/termini',
    termini_letti_il: '2026-10-02',
    note_conformita: null,
    verificata_il: ADESSO,
    attiva: true,
    ultima_esecuzione_il: ADESSO,
    ultimo_esito: { eventi_letti: 12, eventi_nuovi: 1, eventi_uniti: 3, codice_errore: null },
    errori_consecutivi: 0,
    esecuzioni_senza_eventi: 0,
    ultimo_errore: null,
    disattivata_automaticamente_il: null,
    locale: { nome: 'Club Binario 7', comune: 'Monza' },
    ...dati,
  };
}

export const FONTI = [
  fonte({ id: ID.fonteSito }),
  fonte({
    id: ID.fonteInstagram,
    locale_id: ID.lambro,
    tipo: 'instagram',
    url: 'officinalambro',
    adattatore: 'instagram_business_discovery',
    frequenza_minuti: 720,
    robots_esito: 'non_applicabile',
    attiva: false,
    errori_consecutivi: 5,
    ultimo_errore: 'HTTP_503: il sito ha risposto HTTP 503',
    disattivata_automaticamente_il: ADESSO,
    ultimo_esito: { eventi_letti: 0, eventi_nuovi: 0, eventi_uniti: 0, codice_errore: 'HTTP_503' },
    locale: { nome: 'Officina Lambro', comune: 'Monza' },
  }),
  fonte({
    id: ID.fonteDaVerificare,
    locale_id: ID.ventuno,
    url: 'https://salaventuno.example/calendario',
    stato_conformita: 'da_verificare',
    robots_esito: null,
    termini_url: null,
    termini_letti_il: null,
    verificata_il: null,
    attiva: false,
    ultima_esecuzione_il: null,
    ultimo_esito: null,
    locale: { nome: 'Sala Ventuno', comune: 'Desio' },
  }),
];

const ESECUZIONI = [
  {
    id: 3,
    prova: true,
    iniziata_il: ADESSO,
    durata_ms: 8400,
    pagine_lette: 3,
    eventi_letti: 12,
    eventi_nuovi: 1,
    eventi_uniti: 3,
    eventi_in_revisione: 0,
    eventi_scartati: 0,
    codice_errore: null,
    messaggio_errore: null,
  },
  {
    id: 2,
    prova: false,
    iniziata_il: '2026-10-18T16:00:00Z',
    durata_ms: 30000,
    pagine_lette: 1,
    eventi_letti: 0,
    eventi_nuovi: 0,
    eventi_uniti: 0,
    eventi_in_revisione: 0,
    eventi_scartati: 0,
    codice_errore: 'TIMEOUT',
    messaggio_errore: 'timeout su binario7.example',
  },
];

const INIZIO = `${serata}T21:00:00Z`;

export const DUPLICATI = [
  {
    grezzo_id: ID.grezzo,
    punteggio: 92,
    nota_revisione: 'Stesso locale, orario a 30 minuti, titolo simile',
    creato_il: ADESSO,
    fonte_tipo: 'instagram',
    fonte_url: 'clubbinario7',
    payload: {
      titolo: 'NOTTE FERROVIA – techno all night',
      inizio: INIZIO,
      fine: null,
      eta_minima: 18,
      riferimenti_alcol: true,
      generi: ['techno', 'house'],
      artisti: ['Nera Vale', 'Corrado B.'],
      prezzo_min_centesimi: 1500,
      locale: { nome: 'Club Binario 7' },
      origine: { url: 'https://www.instagram.com/p/NX92/' },
    },
    candidato: {
      id: '00000000-0000-4000-8000-00000000e001',
      titolo: 'Notte Ferrovia',
      locale_nome: 'Club Binario 7',
      inizio: '2026-10-23T20:30:00Z',
      fine: null,
      eta_minima: 18,
      eta_minima_dichiarata: true,
      riferimenti_alcol: false,
      generi: ['house', 'techno'],
      artisti: ['Nera Vale', 'Corrado B.'],
      prezzo_min_centesimi: 1500,
      url: 'https://binario7.example/eventi/23-10',
    },
  },
  {
    grezzo_id: '00000000-0000-4000-8000-00000000d002',
    punteggio: 78,
    nota_revisione: 'Modifica rilevante: inizio spostato di 3.0 ore',
    creato_il: ADESSO,
    fonte_tipo: 'sito_locale',
    fonte_url: 'https://cascinatorretta.example/eventi',
    payload: {
      titolo: 'Cortile Live',
      inizio: INIZIO,
      fine: null,
      eta_minima: 16,
      riferimenti_alcol: false,
      generi: ['indie', 'live'],
      artisti: [],
      prezzo_min_centesimi: 800,
      locale: { nome: 'Cascina Torretta' },
      origine: { url: 'https://cascinatorretta.example/eventi' },
    },
    candidato: {
      id: '00000000-0000-4000-8000-00000000e006',
      titolo: 'Cortile Live',
      locale_nome: 'Cascina Torretta',
      inizio: INIZIO,
      fine: null,
      eta_minima: 18,
      eta_minima_dichiarata: true,
      riferimenti_alcol: false,
      generi: ['indie', 'live'],
      artisti: [],
      prezzo_min_centesimi: 800,
      url: null,
    },
  },
];

export const EVENTI = [
  {
    id: ID.evento,
    titolo: 'Bassi Lunghi',
    locale_id: ID.lambro,
    locale_nome: 'Officina Lambro',
    locale_comune: 'Monza',
    inizio: INIZIO,
    data_serata: serata,
    eta_minima: 18,
    eta_minima_dichiarata: false,
    riferimenti_alcol: true,
    stato: 'in_revisione',
    fonti: 1,
  },
  {
    id: '00000000-0000-4000-8000-00000000e001',
    titolo: 'Notte Ferrovia',
    locale_id: ID.binario,
    locale_nome: 'Club Binario 7',
    locale_comune: 'Monza',
    inizio: INIZIO,
    data_serata: serata,
    eta_minima: 18,
    eta_minima_dichiarata: true,
    riferimenti_alcol: false,
    stato: 'pubblicato',
    fonti: 2,
  },
];

const EVENTO_SCHEDA = {
  id: ID.evento,
  titolo: 'Bassi Lunghi',
  descrizione: null,
  inizio: INIZIO,
  fine: null,
  eta_minima: 18,
  eta_minima_dichiarata: false,
  riferimenti_alcol: true,
  artisti: ['Selva Mc'],
  prezzo_min_centesimi: null,
  url_biglietti: null,
  stato: 'pubblicato',
  locale_id: ID.lambro,
  generi: [{ genere_codice: 'hip_hop' }],
  fonti: [
    { tipo_origine: 'instagram', url_originale: 'https://www.instagram.com/officinalambro/' },
  ],
};

const ANNULLAMENTI = [
  {
    evento_id: '00000000-0000-4000-8000-00000000e020',
    titolo: 'Live in Cascina',
    locale_nome: 'Cascina Torretta',
    locale_comune: 'Vimercate',
    fonte_url: 'https://cascinatorretta.example/eventi',
    inizio: INIZIO,
    data_serata: serata,
    ultima_conferma_il: '2026-10-18T20:05:00Z',
    ha_partecipanti: true,
  },
];

const REGISTRO = [
  {
    creata_il: '2026-10-19T08:14:00Z',
    autore: 'Moderatore Uno',
    azione: 'approva_immagine_locale',
    motivazione: 'Foto approvata. Fonte: autorizzazione_locale; riferimento: AUT-2026-014.',
  },
  {
    creata_il: '2026-10-18T19:31:00Z',
    autore: null,
    azione: 'evento_creato',
    motivazione: '@officinalambro',
  },
];

type Risposta = { stato: number; corpo?: unknown } | 'rete';

export type OpzioniModerazione = {
  ruolo: boolean;
  /** Fattore TOTP: verificato, da attivare o assente. */
  fattore: 'verificato' | 'assente';
  /** Livello della sessione all'apertura: aal2 entra direttamente nell'area. */
  aal: 'aal1' | 'aal2';
};

/** Simulatore dell'area: registra le chiamate e permette di cambiare le risposte. */
export class ModerazioneSimulata {
  readonly chiamate: Array<{ chiave: string; corpo: unknown; url: string }> = [];
  private readonly risposte = new Map<string, Risposta>();
  verificato: boolean;

  constructor(private readonly opzioni: OpzioniModerazione) {
    this.verificato = opzioni.fattore === 'verificato';
  }

  rispondi(chiave: string, risposta: Risposta) {
    this.risposte.set(chiave, risposta);
  }

  di(chiave: string) {
    return this.chiamate.filter((c) => c.chiave === chiave);
  }

  /** Sessione salvata sul dispositivo con il livello scelto. */
  async impostaSessione(pagina: Page) {
    const fattori = this.verificato ? [{ id: FATTORE, status: 'verified' as const }] : [];
    await pagina.addInitScript(
      (valore) => {
        window.localStorage.setItem('noxa-sessione', valore);
      },
      JSON.stringify(sessione(this.opzioni.aal, fattori)),
    );
  }

  private predefinita(chiave: string, richiesta: Request): Risposta | null {
    const url = new URL(richiesta.url());
    switch (chiave) {
      case 'GET /auth/v1/user':
        return {
          stato: 200,
          corpo: utente(this.verificato ? [{ id: FATTORE, status: 'verified' }] : []),
        };
      case 'POST /auth/v1/factors':
        return {
          stato: 200,
          corpo: {
            id: FATTORE,
            type: 'totp',
            friendly_name: 'Noxa moderazione',
            totp: {
              qr_code: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
              secret: 'NXQ47KD2M9WP3HTR',
              uri: 'otpauth://totp/Noxa',
            },
          },
        };
      case `POST /auth/v1/factors/${FATTORE}/challenge`:
        return {
          stato: 200,
          corpo: { id: 'sfida-1', type: 'totp', expires_at: Math.floor(Date.now() / 1000) + 300 },
        };
      case `POST /auth/v1/factors/${FATTORE}/verify`: {
        const corpo = (richiesta.postDataJSON() ?? {}) as { code?: string };
        if (corpo.code !== CODICE_GIUSTO) {
          return {
            stato: 422,
            corpo: {
              code: 422,
              error_code: 'mfa_verification_failed',
              msg: 'Invalid TOTP code entered',
            },
          };
        }
        this.verificato = true;
        return { stato: 200, corpo: sessione('aal2', [{ id: FATTORE, status: 'verified' }]) };
      }
      case 'GET /rest/v1/ruoli_utente':
        return { stato: 200, corpo: this.opzioni.ruolo ? [{ ruolo: 'moderatore' }] : [] };
      case 'GET /rest/v1/profili':
        if (url.searchParams.get('id') !== `eq.${UTENTE_DI_PROVA}`) return null;
        return { stato: 200, corpo: { nome_visualizzato: 'Moderatore Uno' } };
      case 'POST /rest/v1/rpc/contatori_moderazione':
        return {
          stato: 200,
          corpo: [
            {
              duplicati: DUPLICATI.length,
              possibili_annullamenti: ANNULLAMENTI.length,
              candidati_locali: CANDIDATI.length,
            },
          ],
        };
      case 'POST /rest/v1/rpc/locali_moderazione':
        return { stato: 200, corpo: LOCALI };
      case 'POST /rest/v1/rpc/locale_moderazione':
        return { stato: 200, corpo: [LOCALE_SCHEDA] };
      case 'POST /rest/v1/rpc/candidati_da_verificare':
        return { stato: 200, corpo: CANDIDATI };
      case 'POST /rest/v1/rpc/registro_moderazione':
        return { stato: 200, corpo: REGISTRO };
      case 'POST /rest/v1/rpc/coda_duplicati':
        return { stato: 200, corpo: DUPLICATI };
      case 'POST /rest/v1/rpc/eventi_moderazione':
        return { stato: 200, corpo: EVENTI };
      case 'POST /rest/v1/rpc/possibili_annullamenti':
        return { stato: 200, corpo: ANNULLAMENTI };
      case 'POST /rest/v1/rpc/esegui_fonte_ora':
        return { stato: 200, corpo: 42 };
      case 'POST /rest/v1/rpc/decidi_candidato_locale':
      case 'POST /rest/v1/rpc/decidi_duplicato':
      case 'POST /rest/v1/rpc/correggi_eta_alcol_evento':
      case 'POST /rest/v1/rpc/cambia_stato_evento':
      case 'POST /rest/v1/rpc/decidi_possibile_annullamento':
      case 'POST /rest/v1/rpc/salva_foto_locale':
      case 'POST /rest/v1/rpc/rimuovi_foto_locale':
        return { stato: 204 };
      case 'GET /rest/v1/fonti': {
        const id = url.searchParams.get('id')?.replace(/^eq\./, '');
        const locale = url.searchParams.get('locale_id')?.replace(/^eq\./, '');
        if (id) {
          const trovata = FONTI.find((f) => f.id === id);
          return trovata
            ? { stato: 200, corpo: trovata }
            : { stato: 406, corpo: { code: 'PGRST116' } };
        }
        return { stato: 200, corpo: locale ? FONTI.filter((f) => f.locale_id === locale) : FONTI };
      }
      case 'POST /rest/v1/fonti':
        return { stato: 201, corpo: { id: '00000000-0000-4000-8000-00000000f099' } };
      case 'PATCH /rest/v1/fonti':
      case 'PATCH /rest/v1/locali':
      case 'PATCH /rest/v1/eventi':
      case 'DELETE /rest/v1/eventi_generi':
        return { stato: 204 };
      case 'POST /rest/v1/locali':
        return { stato: 201, corpo: { id: '00000000-0000-4000-8000-00000000c099' } };
      case 'POST /rest/v1/eventi_generi':
      case 'POST /rest/v1/azioni_moderazione':
        return { stato: 201 };
      case 'GET /rest/v1/esecuzioni_fonte':
        return { stato: 200, corpo: ESECUZIONI };
      case 'GET /rest/v1/eventi':
        return { stato: 200, corpo: EVENTO_SCHEDA };
      default:
        if (chiave.startsWith('POST /storage/v1/object/immagini-locali/')) {
          return { stato: 200, corpo: { Key: 'immagini-locali/x.webp' } };
        }
        if (chiave.startsWith('POST /storage/v1/object/sign/immagini-locali')) {
          return {
            stato: 200,
            corpo: [
              {
                path: `${ID.binario}.webp`,
                signedURL: `/object/sign/immagini-locali/${ID.binario}.webp?token=t`,
                error: null,
              },
            ],
          };
        }
        if (chiave.startsWith('DELETE /storage/v1/object/immagini-locali'))
          return { stato: 200, corpo: [] };
        return null;
    }
  }

  async collega(pagina: Page) {
    await pagina.route(`${ORIGINE_SUPABASE}/**`, async (route: Route) => {
      const richiesta = route.request();
      if (richiesta.method() === 'OPTIONS') return route.fallback();
      const url = new URL(richiesta.url());
      const chiave = `${richiesta.method()} ${url.pathname}`;
      if (chiave.startsWith('GET /storage/v1/object/sign/immagini-locali/')) {
        return route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL_PNG });
      }
      const risposta = this.risposte.get(chiave) ?? this.predefinita(chiave, richiesta);
      if (!risposta) return route.fallback();
      let corpo: unknown = null;
      try {
        corpo = richiesta.postDataJSON();
      } catch {
        corpo = richiesta.postData();
      }
      this.chiamate.push({ chiave, corpo, url: richiesta.url() });
      const intestazioni = { 'Access-Control-Allow-Origin': '*' };
      if (risposta === 'rete') return route.abort('internetdisconnected');
      if (risposta.corpo === undefined)
        return route.fulfill({ status: risposta.stato, headers: intestazioni });
      return route.fulfill({ status: risposta.stato, headers: intestazioni, json: risposta.corpo });
    });
  }
}
