import type { Tema } from './mappa/stile';

export type { Tema };

const CHIAVE = 'noxa-tema';

/** Tema attivo sul documento. */
export function temaAttivo(): Tema {
  return document.documentElement.dataset.tema === 'chiaro' ? 'chiaro' : 'scuro';
}

export function applicaTema(tema: Tema): void {
  if (tema === 'chiaro') document.documentElement.dataset.tema = 'chiaro';
  else delete document.documentElement.dataset.tema;
  try {
    window.localStorage.setItem(CHIAVE, tema);
  } catch {
    // Archiviazione non disponibile (navigazione privata): il tema vale solo per la sessione.
  }
  window.dispatchEvent(new CustomEvent<Tema>(EVENTO_TEMA, { detail: tema }));
}

export const EVENTO_TEMA = 'noxa:tema';

/** Script eseguito prima del rendering, per evitare il lampo del tema sbagliato. */
export const SCRIPT_TEMA = `try{if(localStorage.getItem('${CHIAVE}')==='chiaro')document.documentElement.dataset.tema='chiaro'}catch(e){}`;
