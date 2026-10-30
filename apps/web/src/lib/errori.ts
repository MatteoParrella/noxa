import { isAuthError } from '@supabase/supabase-js';

/**
 * Errori di dominio dell'app (ARCHITECTURE.md §5.2). Ogni chiamata a Supabase converte gli
 * errori con `converti`, così le schermate ragionano su tipi e codici stabili e mai sui
 * messaggi in inglese dei servizi.
 */

/** Codici degli errori del database (SQLSTATE NX0nn) e dell'hook di registrazione. */
export const CODICI_DATABASE = {
  NX001: 'eta_insufficiente',
  NX002: 'username_non_valido',
  NX003: 'username_in_uso',
  NX004: 'nome_non_valido',
  NX005: 'data_nascita_non_valida',
  NX006: 'consensi_non_validi',
  NX007: 'data_nascita_immutabile',
  NX008: 'troppe_richieste_oggi',
  NX009: 'troppe_richieste_in_attesa',
  NX010: 'troppi_codici_oggi',
  NX011: 'codice_non_valido',
  NX012: 'codice_scaduto',
  NX013: 'codice_usato',
  NX014: 'gia_in_contatto',
  NX015: 'troppe_segnalazioni_oggi',
  NX016: 'persona_non_disponibile',
  NX017: 'eta_dichiarata_protetta',
  NX018: 'alcol_protetto',
  NX019: 'attivazione_riservata',
  NX020: 'serve_motivazione_registrata',
  NX021: 'motivazione_mancante',
  NX022: 'fonte_non_consentita',
  NX023: 'conferme_foto_mancanti',
  NX024: 'foto_non_caricata',
  NX025: 'gia_deciso',
  NX026: 'cambio_stato_non_previsto',
  NX027: 'troppi_caricamenti_oggi',
  NX028: 'reclamo_fuori_termine',
  NX029: 'reclamo_gia_presentato',
  NX030: 'reclamo_non_ammesso',
  NX031: 'reclamo_stesso_moderatore',
  NX032: 'conferma_escalation_errata',
  NX033: 'segnalazione_in_carico_ad_altri',
  NX034: 'conferme_flyer_mancanti',
  NX035: 'approvazione_flyer_riservata',
  NX036: 'account_sospeso',
  NX037: 'gruppo_pieno',
  NX038: 'non_invitabile',
  NX039: 'passaggio_non_disponibile',
  NX040: 'guida_solo_maggiorenni',
  NX041: 'posti_esauriti',
  NX042: 'data_passata',
  NX043: 'evento_non_adatto',
  NX044: 'modifica_membri_non_prevista',
  NX045: 'troppi_gruppi_oggi',
  NX046: 'data_futura',
  NX047: 'esportazione_recente',
  NX048: 'troppi_tentativi_eliminazione',
} as const;

export type CodiceDatabase = (typeof CODICI_DATABASE)[keyof typeof CODICI_DATABASE];

export type CodiceValidazione =
  | CodiceDatabase
  | 'password_debole'
  | 'password_violata'
  | 'password_uguale'
  | 'email_non_valida'
  | 'link_scaduto'
  | 'verifica_umana_fallita'
  | 'valore_duplicato'
  | 'valore_non_ammesso'
  | 'non_trovato'
  | 'codice_due_fattori_errato'
  | 'codice_due_fattori_scaduto';

export type CodiceAutorizzazione = 'credenziali_non_valide' | 'email_non_confermata' | 'negato';

abstract class ErroreNoxa extends Error {
  abstract readonly tipo: string;
  constructor(
    messaggio: string,
    readonly causa?: unknown,
  ) {
    super(messaggio);
  }
}

/** La rete non risponde: l'azione si può ripetere. */
export class ErroreRete extends ErroreNoxa {
  readonly tipo = 'rete';
}

export class ErroreAutorizzazione extends ErroreNoxa {
  readonly tipo = 'autorizzazione';
  constructor(
    readonly codice: CodiceAutorizzazione,
    causa?: unknown,
  ) {
    super(codice, causa);
  }
}

export class ErroreValidazione extends ErroreNoxa {
  readonly tipo = 'validazione';
  constructor(
    readonly codice: CodiceValidazione,
    causa?: unknown,
  ) {
    super(codice, causa);
  }
}

/** Troppe richieste in poco tempo (limiti di Supabase Auth o del database). */
export class ErroreLimite extends ErroreNoxa {
  readonly tipo = 'limite';
}

export class ErroreSconosciuto extends ErroreNoxa {
  readonly tipo = 'sconosciuto';
}

export type ErroreDominio =
  ErroreRete | ErroreAutorizzazione | ErroreValidazione | ErroreLimite | ErroreSconosciuto;

function codiceDatabase(testo: unknown): CodiceDatabase | undefined {
  if (typeof testo !== 'string') return undefined;
  const corrispondenza = /^(NX\d{3})\b/.exec(testo);
  const chiave = corrispondenza?.[1];
  if (chiave && chiave in CODICI_DATABASE) {
    return CODICI_DATABASE[chiave as keyof typeof CODICI_DATABASE];
  }
  return undefined;
}

function proprieta(oggetto: unknown, nome: string): unknown {
  return typeof oggetto === 'object' && oggetto !== null && nome in oggetto
    ? (oggetto as Record<string, unknown>)[nome]
    : undefined;
}

/** Converte qualsiasi errore di Supabase o del browser in un errore di dominio. */
export function converti(errore: unknown): ErroreDominio {
  if (errore instanceof ErroreNoxa) return errore as ErroreDominio;

  if (typeof navigator !== 'undefined' && !navigator.onLine)
    return new ErroreRete('offline', errore);
  if (errore instanceof TypeError) return new ErroreRete('fetch', errore);

  if (isAuthError(errore)) {
    const daDatabase = codiceDatabase(errore.message);
    if (daDatabase) return new ErroreValidazione(daDatabase, errore);
    if (errore.name === 'AuthRetryableFetchError') return new ErroreRete('auth', errore);
    switch (errore.code) {
      case 'invalid_credentials':
        return new ErroreAutorizzazione('credenziali_non_valide', errore);
      case 'email_not_confirmed':
        return new ErroreAutorizzazione('email_non_confermata', errore);
      case 'over_request_rate_limit':
      case 'over_email_send_rate_limit':
        return new ErroreLimite('limite', errore);
      case 'weak_password': {
        const motivi = proprieta(errore, 'reasons');
        const violata = Array.isArray(motivi) && motivi.includes('pwned');
        return new ErroreValidazione(violata ? 'password_violata' : 'password_debole', errore);
      }
      case 'same_password':
        return new ErroreValidazione('password_uguale', errore);
      case 'email_address_invalid':
      case 'validation_failed':
        return new ErroreValidazione('email_non_valida', errore);
      case 'otp_expired':
      case 'flow_state_expired':
        return new ErroreValidazione('link_scaduto', errore);
      case 'captcha_failed':
        return new ErroreValidazione('verifica_umana_fallita', errore);
      case 'mfa_verification_failed':
      case 'mfa_verification_rejected':
        return new ErroreValidazione('codice_due_fattori_errato', errore);
      case 'mfa_challenge_expired':
        return new ErroreValidazione('codice_due_fattori_scaduto', errore);
      default:
        if (errore.status === 429) return new ErroreLimite('limite', errore);
        return new ErroreSconosciuto(errore.code ?? 'auth', errore);
    }
  }

  // Errori di PostgREST: { code, message, details, hint }
  const codice = proprieta(errore, 'code');
  if (typeof codice === 'string') {
    const daDatabase = codiceDatabase(codice);
    if (daDatabase) return new ErroreValidazione(daDatabase, errore);
    if (codice === '42501' || codice === 'PGRST301')
      return new ErroreAutorizzazione('negato', errore);
    // Vincolo di unicità (per esempio uno username già preso) e vincoli di formato.
    if (codice === '23505') return new ErroreValidazione('valore_duplicato', errore);
    if (codice === '23514') return new ErroreValidazione('valore_non_ammesso', errore);
    if (codice === 'P0002') return new ErroreValidazione('non_trovato', errore);
  }

  return new ErroreSconosciuto('sconosciuto', errore);
}
