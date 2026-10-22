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
  flyerBozza: '00000000-0000-4000-8000-0000000000b1',
  flyerCorrispondenza: '00000000-0000-4000-8000-0000000000b2',
  flyerErrore: '00000000-0000-4000-8000-0000000000b3',
  eventoBozza: '00000000-0000-4000-8000-00000000e101',
  eventoPubblicato: '00000000-0000-4000-8000-00000000e102',
  segnalazioneP1: '00000000-0000-4000-8000-00000000b101',
  segnalazioneP2: '00000000-0000-4000-8000-00000000b102',
  profiloSegnalato: '00000000-0000-4000-8000-0000000000f7',
  reclamoMio: '00000000-0000-4000-8000-00000000b201',
  reclamoAltrui: '00000000-0000-4000-8000-00000000b202',
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

function eventoJson(dati: {
  id: string;
  titolo: string;
  locale_id: string;
  locale_nome: string;
  inizio: string;
  stato: 'in_revisione' | 'pubblicato';
}) {
  return {
    locale_comune: 'Monza',
    fine: null,
    eta_minima: 18,
    eta_minima_dichiarata: false,
    riferimenti_alcol: false,
    generi: ['techno'],
    artisti: [],
    prezzo_min_centesimi: 1500,
    url_biglietti: null,
    ...dati,
  };
}

const ESTRAZIONE = {
  e_un_evento: true,
  contenuto_inappropriato: false,
  titolo: 'Luci Basse',
  nome_locale: 'Officina Lambro',
  comune: 'Monza',
  indirizzo: null,
  data: '2026-11-01',
  ora_inizio: '23:00:00',
  ora_fine: '04:00:00',
  anno_inferito: false,
  eta_minima: null,
  riferimenti_alcol: true,
  generi: ['techno', 'house'],
  artisti: ['Nera Vale'],
  prezzo_min_centesimi: 1200,
  confidenza: { titolo: 0.95, nome_locale: 0.9, data: 0.88, ora_inizio: 0.9, eta_minima: 0.41 },
};

/** Coda dei flyer: una bozza, una corrispondenza con un evento pubblicato, uno illeggibile. */
export const CODA_FLYER = [
  {
    id: ID.flyerBozza,
    stato: 'in_revisione',
    creato_il: '2026-10-21T18:02:00Z',
    storage_path: 'a1/b1.webp',
    risultato_estrazione: ESTRAZIONE,
    modello: 'claude-di-prova',
    versione_prompt: 'v1',
    confidenza: 0.88,
    contenuto_sospetto: false,
    nota_revisione: null,
    evento: null,
    candidato: null,
  },
  {
    id: ID.flyerCorrispondenza,
    stato: 'in_revisione',
    creato_il: '2026-10-21T19:10:00Z',
    storage_path: 'a1/b2.webp',
    risultato_estrazione: {
      ...ESTRAZIONE,
      titolo: 'Notte Ferrovia',
      nome_locale: 'Club Binario 7',
      data: '2026-10-23',
      ora_inizio: '23:30:00',
      confidenza: { titolo: 0.5, nome_locale: 0.95, data: 0.9, ora_inizio: 0.9, eta_minima: 0.9 },
    },
    modello: 'claude-di-prova',
    versione_prompt: 'v1',
    confidenza: 0.5,
    contenuto_sospetto: false,
    nota_revisione: null,
    evento: eventoJson({
      id: ID.eventoBozza,
      titolo: 'Notte Ferrovia',
      locale_id: ID.binario,
      locale_nome: 'Club Binario 7',
      inizio: '2026-10-23T21:30:00Z',
      stato: 'in_revisione',
    }),
    candidato: eventoJson({
      id: ID.eventoPubblicato,
      titolo: 'Notte Ferrovia',
      locale_id: ID.binario,
      locale_nome: 'Club Binario 7',
      inizio: '2026-10-23T21:30:00Z',
      stato: 'pubblicato',
    }),
  },
  {
    id: ID.flyerErrore,
    stato: 'errore',
    creato_il: '2026-10-21T20:00:00Z',
    storage_path: 'a1/b3.webp',
    risultato_estrazione: null,
    modello: null,
    versione_prompt: null,
    confidenza: null,
    contenuto_sospetto: false,
    nota_revisione: 'Estrazione non disponibile: revisione manuale.',
    evento: null,
    candidato: null,
  },
];

/** Una segnalazione di priorità 1 che scade tra due ore e una di priorità 2 in carico ad altri. */
export function codaSegnalazioni() {
  const adesso = Date.now();
  return [
    {
      id: ID.segnalazioneP1,
      tipo_oggetto: 'profilo',
      oggetto_id: ID.profiloSegnalato,
      motivo: 'adescamento_o_rischio_minore',
      priorita: 1,
      stato: 'aperta',
      creata_il: new Date(adesso - 2 * 3600_000).toISOString(),
      scadenza: new Date(adesso + 2 * 3600_000 + 15 * 60_000).toISOString(),
      chiusa_il: null,
      presa_da_me: false,
      presa_da: null,
      stesso_oggetto: 2,
      in_escalation: false,
    },
    {
      id: ID.segnalazioneP2,
      tipo_oggetto: 'foto_profilo',
      oggetto_id: ID.profiloSegnalato,
      motivo: 'contenuto_inappropriato',
      priorita: 2,
      stato: 'in_lavorazione',
      creata_il: new Date(adesso - 3600_000).toISOString(),
      scadenza: new Date(adesso + 30 * 60_000).toISOString(),
      chiusa_il: null,
      presa_da_me: false,
      presa_da: 'Moderatore Due',
      stesso_oggetto: 1,
      in_escalation: false,
    },
  ];
}

export function dettaglioSegnalazione(id: string) {
  const riga = codaSegnalazioni().find((s) => s.id === id);
  if (!riga) return [];
  return [
    {
      segnalazione_id: riga.id,
      tipo_oggetto: riga.tipo_oggetto,
      oggetto_id: riga.oggetto_id,
      motivo: riga.motivo,
      dettagli: 'Ha chiesto l’amicizia a mia sorella di 14 anni e le ha scritto altrove.',
      priorita: riga.priorita,
      stato: riga.stato,
      creata_il: riga.creata_il,
      scadenza: riga.scadenza,
      presa_da_me: riga.presa_da_me,
      presa_da: riga.presa_da,
      in_escalation: false,
      occultato: false,
      oggetto: {
        id: ID.profiloSegnalato,
        username: 'teo.m.night',
        nome_visualizzato: 'Teo M.',
        avatar_path: `${ID.profiloSegnalato}/00000000-0000-4000-8000-000000000a01.webp`,
        avatar_nascosto: false,
        stato_account: 'attivo',
      },
      altre: [
        {
          id: '00000000-0000-4000-8000-00000000b103',
          motivo: 'adescamento_o_rischio_minore',
          dettagli: null,
          stato: 'aperta',
          creata_il: riga.creata_il,
        },
      ],
      registro: [
        {
          creata_il: riga.creata_il,
          autore: null,
          azione: 'occulta_contenuto',
          motivazione: 'Priorità 1 assegnata in automatico.',
        },
      ],
    },
  ];
}

export const RECLAMI = [
  {
    id: ID.reclamoAltrui,
    stato: 'inviato',
    testo: 'Il flyer era leggibile: la data è scritta in basso.',
    creato_il: '2026-10-21T10:00:00Z',
    ruolo: 'caricamento',
    decisione_id: '00000000-0000-4000-8000-00000000b301',
    decisione_azione: 'rifiuta_flyer',
    decisione_motivazione: 'Data e orario non si leggono con sicurezza.',
    decisione_il: '2026-10-20T21:00:00Z',
    decisione_autore: 'Moderatore Due',
    tipo_oggetto: 'caricamento_flyer',
    descrizione: 'Flyer di Luci Basse',
    puo_decidere: true,
    esito: null,
    motivazione_esito: null,
    deciso_il: null,
  },
  {
    id: ID.reclamoMio,
    stato: 'inviato',
    testo: 'La foto è mia e non viola nulla.',
    creato_il: '2026-10-21T11:00:00Z',
    ruolo: 'coinvolto',
    decisione_id: '00000000-0000-4000-8000-00000000b302',
    decisione_azione: 'rimuovi_contenuto',
    decisione_motivazione: 'Foto di un’altra persona usata senza consenso.',
    decisione_il: '2026-10-20T22:00:00Z',
    decisione_autore: 'Moderatore Uno',
    tipo_oggetto: 'foto_profilo',
    descrizione: '@giulia.r',
    puo_decidere: false,
    esito: null,
    motivazione_esito: null,
    deciso_il: null,
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
              flyer: CODA_FLYER.length,
              segnalazioni: 2,
              segnalazioni_urgenti: 1,
              scadenza_urgente: codaSegnalazioni()[0]?.scadenza ?? null,
              reclami: RECLAMI.length,
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
      case 'POST /rest/v1/rpc/coda_flyer':
        return { stato: 200, corpo: CODA_FLYER };
      case 'POST /rest/v1/rpc/coda_segnalazioni':
        return { stato: 200, corpo: codaSegnalazioni() };
      case 'POST /rest/v1/rpc/dettaglio_segnalazione': {
        const corpo = (richiesta.postDataJSON() ?? {}) as { id?: string };
        return { stato: 200, corpo: dettaglioSegnalazione(corpo.id ?? '') };
      }
      case 'POST /rest/v1/rpc/reclami_moderazione':
        return { stato: 200, corpo: RECLAMI };
      case 'POST /rest/v1/rpc/decidi_flyer':
        return { stato: 200, corpo: ID.eventoBozza };
      case 'POST /rest/v1/rpc/decidi_segnalazione':
        return { stato: 200, corpo: null };
      case 'POST /rest/v1/rpc/prendi_in_carico_segnalazione':
      case 'POST /rest/v1/rpc/escalation_segnalazione':
      case 'POST /rest/v1/rpc/escalation_flyer':
      case 'POST /rest/v1/rpc/esamina_reclamo':
      case 'POST /rest/v1/rpc/decidi_reclamo':
        return { stato: 204 };
      case 'POST /rest/v1/rpc/esegui_fonte_ora':
        return { stato: 200, corpo: 42 };
      case 'POST /rest/v1/rpc/decidi_candidato_locale':
      case 'POST /rest/v1/rpc/decidi_duplicato':
      case 'POST /rest/v1/rpc/correggi_eta_alcol_evento':
      case 'POST /rest/v1/rpc/cambia_stato_evento':
      case 'POST /rest/v1/rpc/decidi_possibile_annullamento':
        return { stato: 204 };
      case 'POST /rest/v1/rpc/salva_foto_locale':
        return { stato: 200, corpo: null };
      case 'POST /rest/v1/rpc/rimuovi_foto_locale':
        return { stato: 200, corpo: `${ID.binario}.webp` };
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
        if (
          /^POST \/storage\/v1\/object\/sign\/(flyer-caricati|flyer-pubblicati|avatar)$/.test(
            chiave,
          )
        ) {
          const bucket = chiave.split('/').pop() as string;
          const { paths } = (richiesta.postDataJSON() ?? { paths: [] }) as { paths: string[] };
          return {
            stato: 200,
            corpo: paths.map((path) => ({
              path,
              signedURL: `/object/sign/${bucket}/${path}?token=t`,
              error: null,
            })),
          };
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
      if (
        /^GET \/storage\/v1\/object\/sign\/(immagini-locali|flyer-caricati|flyer-pubblicati|avatar)\//.test(
          chiave,
        )
      ) {
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
