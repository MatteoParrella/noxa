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

/**
 * Script eseguito prima del rendering: applica il tema (niente lampo del tema sbagliato) e
 * attiva le animazioni allo scorrimento (.movimento), che senza JavaScript restano spente.
 */
export const SCRIPT_TEMA = `document.documentElement.classList.add('movimento');try{if(localStorage.getItem('${CHIAVE}')==='chiaro')document.documentElement.dataset.tema='chiaro'}catch(e){}`;
