/**
 * Pagina da riaprire dopo l'accesso, per esempio un link d'invito aperto senza sessione.
 * Solo percorsi interni dell'app, salvati nella scheda corrente.
 */
const CHIAVE = 'noxa-dopo-accesso';

export function ricordaPaginaDopoAccesso(percorso: string): void {
  if (!percorso.startsWith('/') || percorso.startsWith('//')) return;
  try {
    window.sessionStorage.setItem(CHIAVE, percorso);
  } catch {
    // Archiviazione non disponibile: dopo l'accesso si va in Scopri.
  }
}

/** Restituisce e dimentica la pagina da riaprire, se c'è. */
export function prendiPaginaDopoAccesso(): string | null {
  try {
    const percorso = window.sessionStorage.getItem(CHIAVE);
    window.sessionStorage.removeItem(CHIAVE);
    return percorso && percorso.startsWith('/') && !percorso.startsWith('//') ? percorso : null;
  } catch {
    return null;
  }
}
