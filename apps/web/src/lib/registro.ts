import { inviaErrore } from './sentry';

/**
 * Registro degli errori dell'app. In sviluppo scrive nella console; in produzione invia a
 * Sentry (ADR-0014), se configurato, solo il tipo di errore e il contesto: `pulisciEvento`
 * toglie email, coordinate e testi scritti dagli utenti (R-62).
 */
export function registraErrore(contesto: string, errore: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console -- unico punto di uscita dei log in sviluppo
    console.error(`[noxa] ${contesto}`, errore);
    return;
  }
  inviaErrore(contesto, errore);
}
