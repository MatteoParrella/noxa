import { fnv1a, type Famiglia } from './copertinaGenerata';
import elenco from './fotoSerata.json';

/**
 * Foto d'atmosfera delle copertine (ADR-0032): fotografie di pubblico dominio o CC0 (luci,
 * laser, palchi, piste), servite dall'app, senza persone riconoscibili né alcol (R-56). Non
 * sono foto dell'evento: danno l'atmosfera del genere. Ogni serata sceglie la sua dal seme
 * (titolo + locale), con un'inquadratura propria e la tinta dei colori della fonte.
 */
export type TemaFoto = 'club' | 'disco' | 'folla' | 'palco';

export type FotoLibera = {
  file: string;
  tema: TemaFoto;
  autore: string;
  licenza: 'cc0' | 'pdm';
  /** Pagina della foto nell'archivio di origine: la prova della licenza. */
  fonte: string;
};

export const FOTO_LIBERE = elenco as FotoLibera[];

/** Temi adatti a ogni famiglia di generi, in ordine di preferenza. */
const TEMI: Record<Famiglia, readonly TemaFoto[]> = {
  techno: ['club'],
  elettronica: ['club', 'disco'],
  dnb: ['club', 'folla'],
  house: ['disco', 'club'],
  commerciale: ['disco', 'folla'],
  hiphop: ['folla', 'club'],
  reggaeton: ['folla', 'disco'],
  latino: ['disco', 'folla'],
  indie: ['palco', 'folla'],
  live: ['palco'],
  altro: ['disco', 'palco', 'club', 'folla'],
  accento: ['club', 'disco', 'folla', 'palco'],
};

export type FotoSerata = {
  src: string;
  /** Punto dell'immagine tenuto al centro del ritaglio, in percentuale. */
  x: number;
  y: number;
  specchiata: boolean;
};

const ORIZZONTALI = [20, 35, 50, 65, 80] as const;
const VERTICALI = [30, 45, 60] as const;

/** Foto, inquadratura e verso di una serata: stesso seme, stessa copertina. */
export function fotoSerata(
  seme: string,
  famiglia: Famiglia,
  foto: readonly FotoLibera[] = FOTO_LIBERE,
): FotoSerata | null {
  const temi = TEMI[famiglia];
  const adatte = foto.filter((voce) => temi.includes(voce.tema));
  if (adatte.length === 0) return null;
  const h = fnv1a(`foto:${seme}`);
  const scelta = adatte[h % adatte.length];
  if (!scelta) return null;
  return {
    src: `/copertine/${scelta.file}`,
    x: ORIZZONTALI[(h >>> 5) % ORIZZONTALI.length] ?? 50,
    y: VERTICALI[(h >>> 9) % VERTICALI.length] ?? 45,
    specchiata: ((h >>> 13) & 1) === 1,
  };
}
