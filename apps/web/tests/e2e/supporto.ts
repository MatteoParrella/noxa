import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export const TEMI = ['scuro', 'chiaro'] as const;
export type TemaProva = (typeof TEMI)[number];

/** Origine fittizia del bucket `mappe` nei test: le richieste sono servite dalle fixture. */
export const ORIGINE_MAPPE = 'http://mappe.noxa.test';

/** Imposta il tema prima che la pagina si carichi, come farebbe la scelta dell'utente. */
export async function impostaTema(pagina: Page, tema: TemaProva) {
  await pagina.addInitScript((valore) => {
    window.localStorage.setItem('noxa-tema', valore);
  }, tema);
}

/** Nessuna violazione WCAG 2.2 AA (DESIGN.md §4). */
export async function verificaAccessibilita(pagina: Page) {
  const risultato = await new AxeBuilder({ page: pagina })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .exclude('.maplibregl-canvas')
    .analyze();
  expect(risultato.violations).toEqual([]);
}
