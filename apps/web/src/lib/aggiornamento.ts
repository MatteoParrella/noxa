/**
 * Aggiornamento della PWA (ARCHITECTURE.md §5.5). Il service worker di Workbox è generato con
 * `skipWaiting: false` (scripts/genera-sw.mjs): una versione nuova si installa e resta in
 * attesa. L'app lo segnala e, quando l'utente sceglie «Ricarica», chiede al service worker in
 * attesa di attivarsi (messaggio `SKIP_WAITING`, gestito da Workbox) e ricarica la pagina
 * appena prende il controllo. Se l'avviso resta senza risposta, l'aggiornamento si applica da
 * solo quando l'app passa in secondo piano (`aggiornaInSecondoPiano`): una PWA installata non
 * chiude quasi mai tutte le sue finestre e altrimenti resterebbe a lungo sulla versione vecchia.
 */

/** Ogni quanto controllare una versione nuova mentre l'app resta aperta. */
export const INTERVALLO_CONTROLLO_MS = 60 * 60 * 1000;

type Registrazione = Pick<
  ServiceWorkerRegistration,
  'waiting' | 'installing' | 'addEventListener' | 'removeEventListener' | 'update'
>;

type Contenitore = Pick<ServiceWorkerContainer, 'controller'>;

/**
 * Chiama `suDisponibile` quando c'è un service worker nuovo installato e in attesa. Alla prima
 * installazione (nessun controller) non c'è niente da aggiornare e non si avvisa.
 * Restituisce la funzione che smette di osservare.
 */
export function osservaAggiornamento(
  registrazione: Registrazione,
  contenitore: Contenitore,
  suDisponibile: (inAttesa: ServiceWorker) => void,
): () => void {
  const segnalaSeInAttesa = () => {
    if (registrazione.waiting && contenitore.controller) suDisponibile(registrazione.waiting);
  };

  const osservati = new Set<ServiceWorker>();
  const suCambioStato = () => segnalaSeInAttesa();
  const suNuovaVersione = () => {
    const nuovo = registrazione.installing;
    if (!nuovo || osservati.has(nuovo)) return;
    osservati.add(nuovo);
    nuovo.addEventListener('statechange', suCambioStato);
  };

  segnalaSeInAttesa();
  suNuovaVersione();
  registrazione.addEventListener('updatefound', suNuovaVersione);
  return () => {
    registrazione.removeEventListener('updatefound', suNuovaVersione);
    for (const worker of osservati) worker.removeEventListener('statechange', suCambioStato);
  };
}

/**
 * Controlla se c'è una versione nuova quando l'app torna in primo piano e una volta all'ora:
 * le PWA installate restano aperte a lungo e il browser controlla da solo solo alla navigazione.
 */
export function controllaPeriodicamente(
  registrazione: Pick<ServiceWorkerRegistration, 'update'>,
  documento: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>,
  intervalloMs = INTERVALLO_CONTROLLO_MS,
): () => void {
  const controlla = () => {
    // Offline o con il server non raggiungibile si riprova al prossimo controllo.
    registrazione.update().catch(() => undefined);
  };
  const suVisibilita = () => {
    if (documento.visibilityState === 'visible') controlla();
  };
  documento.addEventListener('visibilitychange', suVisibilita);
  const timer = setInterval(controlla, intervalloMs);
  return () => {
    documento.removeEventListener('visibilitychange', suVisibilita);
    clearInterval(timer);
  };
}

/**
 * Attiva il service worker in attesa e ricarica la pagina quando prende il controllo, una
 * volta sola anche se l'evento arriva più volte.
 */
export function applicaAggiornamento(
  inAttesa: Pick<ServiceWorker, 'postMessage'>,
  contenitore: Pick<ServiceWorkerContainer, 'addEventListener'>,
  ricarica: () => void,
): void {
  let ricaricata = false;
  contenitore.addEventListener('controllerchange', () => {
    if (ricaricata) return;
    ricaricata = true;
    ricarica();
  });
  inAttesa.postMessage({ type: 'SKIP_WAITING' });
}

type Documento = Pick<
  Document,
  'visibilityState' | 'activeElement' | 'addEventListener' | 'removeEventListener'
>;

/** Un campo in cui l'utente sta scrivendo: ricaricare gli farebbe perdere il testo. */
function staScrivendo(elemento: Element | null): boolean {
  if (!elemento) return false;
  const tag = elemento.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (elemento as HTMLElement).isContentEditable === true
  );
}

/**
 * Con una versione nuova in attesa, la applica quando l'app passa in secondo piano (l'utente
 * è andato su un'altra app o ha bloccato il telefono), così alla riapertura vede l'ultima
 * versione senza dover toccare «Ricarica». Non lo fa se un campo di testo è attivo.
 * Restituisce la funzione che smette di osservare.
 */
export function aggiornaInSecondoPiano(
  inAttesa: Pick<ServiceWorker, 'postMessage'>,
  contenitore: Pick<ServiceWorkerContainer, 'addEventListener'>,
  documento: Documento,
  ricarica: () => void,
): () => void {
  let applicato = false;
  const suVisibilita = () => {
    if (applicato || documento.visibilityState !== 'hidden') return;
    if (staScrivendo(documento.activeElement)) return;
    applicato = true;
    applicaAggiornamento(inAttesa, contenitore, ricarica);
  };
  documento.addEventListener('visibilitychange', suVisibilita);
  return () => documento.removeEventListener('visibilitychange', suVisibilita);
}
