/**
 * Registro degli errori dell'app. In sviluppo scrive nella console; in produzione non
 * scrive nulla finché non arriva Sentry (ADR-0014), che riceverà solo il tipo di errore e
 * il contesto, mai email, coordinate o testi scritti dagli utenti (R-62).
 */
export function registraErrore(contesto: string, errore: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console -- unico punto di uscita dei log in sviluppo
    console.error(`[noxa] ${contesto}`, errore);
  }
}
