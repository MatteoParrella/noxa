/**
 * Aggiornamento della PWA (ARCHITECTURE.md §5.5). Il service worker di Workbox è generato con
 * `skipWaiting: false` (scripts/genera-sw.mjs): una versione nuova si installa e resta in
 * attesa. L'app lo segnala e, quando l'utente sceglie «Ricarica», chiede al service worker in
 * attesa di attivarsi (messaggio `SKIP_WAITING`, gestito da Workbox) e ricarica la pagina
 * appena prende il controllo.
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
