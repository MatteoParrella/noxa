/** Tavolozza dei gruppi: gli stessi valori del check `gruppi_colore` (DATA_MODEL.md §5.4). */
export const COLORI_GRUPPO = [
  'ciano',
  'blu',
  'viola',
  'rosa',
  'rosso',
  'arancione',
  'giallo',
  'verde',
] as const;
export type ColoreGruppo = (typeof COLORI_GRUPPO)[number];

export const NOMI_COLORI: Record<ColoreGruppo, string> = {
  ciano: 'Ciano',
  blu: 'Blu',
  viola: 'Viola',
  rosa: 'Rosa',
  rosso: 'Rosso',
  arancione: 'Arancione',
  giallo: 'Giallo',
  verde: 'Verde',
};

export function eColoreGruppo(valore: string): valore is ColoreGruppo {
  return (COLORI_GRUPPO as readonly string[]).includes(valore);
}
