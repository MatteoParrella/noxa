import type { ErrorEvent } from '@sentry/browser';

/**
 * Sentry nell'app (ADR-0014, R-62): errori senza dati personali. Si attiva solo con
 * NEXT_PUBLIC_SENTRY_DSN (regione UE), nessun tracciamento delle sessioni o delle prestazioni,
 * nessuna identità dell'utente. `pulisciEvento` è il `beforeSend`: toglie richiesta,
 * utente, breadcrumb ed extra, e cancella da messaggi ed eccezioni email, coordinate, token
 * e testi tra virgolette (che possono contenere quello che una persona ha scritto).
 */

const EMAIL = /[^\s@"'<>]+@[^\s@"'<>]+\.[a-z]{2,}/gi;
const COORDINATE = /-?\d{1,3}\.\d{3,}/g;
const TRA_VIRGOLETTE = /(["'«“])(?:(?!\1).){1,}?(["'»”])/g;
const TOKEN = /\b(?:ey[\w-]{10,}\.[\w-]+\.[\w-]+|[a-f0-9]{32,})\b/gi;
const PARAMETRI = /\?[^\s#]*/g;

export function pulisciTesto(testo: string): string {
  return testo
    .replace(EMAIL, '[email]')
    .replace(TOKEN, '[token]')
    .replace(COORDINATE, '[numero]')
    .replace(TRA_VIRGOLETTE, '[testo]')
    .replace(PARAMETRI, '?[parametri]');
}

export function pulisciEvento(evento: ErrorEvent): ErrorEvent {
  delete evento.user;
  delete evento.request;
  delete evento.breadcrumbs;
  delete evento.extra;
  delete evento.contexts?.['state'];
  if (evento.message) evento.message = pulisciTesto(evento.message);
  for (const eccezione of evento.exception?.values ?? []) {
    if (eccezione.value) eccezione.value = pulisciTesto(eccezione.value);
    for (const riquadro of eccezione.stacktrace?.frames ?? []) {
      delete riquadro.vars;
      if (riquadro.abs_path) riquadro.abs_path = riquadro.abs_path.replace(PARAMETRI, '');
    }
  }
  return evento;
}

let attivo = false;

/** Avvia Sentry una volta, nel browser, se il DSN è configurato. */
export async function avviaSentry(): Promise<void> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (attivo || !dsn || typeof window === 'undefined') return;
  const Sentry = await import('@sentry/browser');
  Sentry.init({
    dsn,
    release: process.env.NEXT_PUBLIC_VERSIONE_APP,
    environment: process.env.NODE_ENV,
    defaultIntegrations: false,
    integrations: [
      Sentry.globalHandlersIntegration(),
      Sentry.linkedErrorsIntegration(),
      Sentry.dedupeIntegration(),
    ],
    tracesSampleRate: 0,
    beforeSend: pulisciEvento,
    beforeBreadcrumb: () => null,
  });
  attivo = true;
}

/** Invia un errore già gestito, con il solo contesto tecnico. */
export function inviaErrore(contesto: string, errore: unknown): void {
  if (!attivo) return;
  void import('@sentry/browser').then((Sentry) =>
    Sentry.captureException(errore, { tags: { contesto } }),
  );
}
