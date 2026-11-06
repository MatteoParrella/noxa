/**
 * Cronologia interna dell'app, per il pulsante "indietro" delle pagine interne.
 *
 * Il pulsante deve riportare alla pagina da cui si è arrivati (come il gesto o il tasto
 * indietro del telefono), non a una pagina "madre" fissa: una persona si apre da Amici, da un
 * gruppo o da una serata, un evento da Scopri, da Vivi o da una notifica. La cronologia del
 * browser non dice dove porta `history.back()` né se la pagina precedente è ancora di Noxa,
 * quindi teniamo una pila degli indirizzi visitati in questa scheda (sessionStorage, che
 * sopravvive al ricaricamento come la cronologia). Senza una pagina precedente il pulsante
 * porta alla pagina madre indicata da chi lo usa.
 */

const CHIAVE = 'noxa:cronologia';
const MASSIMO = 50;
const EVENTO = 'noxa:cronologia';

let inMemoria: string[] = [];

function leggi(): string[] {
  try {
    const grezzo = window.sessionStorage.getItem(CHIAVE);
    if (grezzo === null) return inMemoria;
    const valore: unknown = JSON.parse(grezzo);
    return Array.isArray(valore) && valore.every((v) => typeof v === 'string')
      ? (valore as string[])
      : [];
  } catch {
    return inMemoria;
  }
}

function scrivi(pila: string[]): void {
  inMemoria = pila;
  try {
    window.sessionStorage.setItem(CHIAVE, JSON.stringify(pila));
  } catch {
    // Archiviazione non disponibile (navigazione privata): resta la copia in memoria.
  }
  window.dispatchEvent(new Event(EVENTO));
}

/** Pila dopo l'arrivo su `indirizzo`: un ritorno alla penultima pagina la accorcia. */
export function prossimaPila(pila: readonly string[], indirizzo: string): string[] {
  if (pila[pila.length - 1] === indirizzo) return [...pila];
  if (pila[pila.length - 2] === indirizzo) return pila.slice(0, -1);
  return [...pila, indirizzo].slice(-MASSIMO);
}

/** Da chiamare a ogni cambio di pagina, con percorso e parametri (`/evento/?id=…`). */
export function registraPagina(indirizzo: string): void {
  const pila = leggi();
  const nuova = prossimaPila(pila, indirizzo);
  if (nuova.length === pila.length && nuova.every((v, i) => v === pila[i])) return;
  scrivi(nuova);
}

const soloPercorso = (indirizzo: string) => indirizzo.split('?')[0] ?? '';

/**
 * Indirizzo della pagina precedente dell'app, se c'è, vista dalla pagina `percorso`. Al primo
 * disegno di una pagina nuova la pila non la contiene ancora (si aggiorna dopo, in
 * `TracciaNavigazione`): la si conta come se ci fosse, così l'etichetta è subito giusta.
 */
export function precedenteDi(pila: readonly string[], percorso: string): string | null {
  const ultima = pila[pila.length - 1];
  const penultima = pila[pila.length - 2];
  if (ultima !== undefined && soloPercorso(ultima) === percorso) return penultima ?? null;
  if (penultima !== undefined && soloPercorso(penultima) === percorso)
    return pila[pila.length - 3] ?? null;
  return ultima ?? null;
}

export function paginaPrecedente(percorso: string): string | null {
  return precedenteDi(leggi(), percorso);
}

export function osservaCronologia(avvisa: () => void): () => void {
  window.addEventListener(EVENTO, avvisa);
  return () => window.removeEventListener(EVENTO, avvisa);
}

/** Nome della pagina da mostrare nel pulsante, dal percorso. */
const NOMI: Readonly<Record<string, string>> = {
  '/scopri/': 'Scopri',
  '/scopri/carica-flyer/': 'Carica un flyer',
  '/scopri/miei-flyer/': 'I miei flyer',
  '/evento/': 'Evento',
  '/organizza/': 'Organizza',
  '/gruppi/nuovo/': 'Crea un gruppo',
  '/gruppo/': 'Gruppo',
  '/serata/': 'Serata',
  '/serata/nuova/': 'Proponi una serata',
  '/vivi/': 'Vivi',
  '/vivi/chi-lo-vede/': 'Chi lo vede',
  '/ricorda/': 'Ricorda',
  '/ricorda/serata/': 'Serata del diario',
  '/ricorda/modifica/': 'Modifica',
  '/notifiche/': 'Notifiche',
  '/profilo/': 'Profilo',
  '/profilo/modifica/': 'Modifica',
  '/profilo/privacy/': 'Privacy e dati',
  '/profilo/privacy/informativa/': 'Informativa in breve',
  '/profilo/privacy/scarica/': 'Scarica i tuoi dati',
  '/profilo/privacy/elimina/': 'Elimina l’account',
  '/profilo/bloccati/': 'Persone bloccate',
  '/profilo/segnalazioni/': 'Le mie segnalazioni',
  '/amici/': 'Amici',
  '/amici/cerca/': 'Cerca',
  '/amici/codice/': 'Il mio codice',
  '/amici/invito/': 'Codice invito',
  '/amici/scansiona/': 'Scansiona',
  '/persona/': 'Profilo',
};

export const NOME_GENERICO = 'Indietro';

/** Percorso con la barra finale, come gli indirizzi dell'esportazione statica. */
export const conBarra = (percorso: string) => (percorso.endsWith('/') ? percorso : `${percorso}/`);

export function nomePagina(indirizzo: string): string {
  return NOMI[conBarra(soloPercorso(indirizzo))] ?? NOME_GENERICO;
}
