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

function comeFoto(scelta: FotoLibera, h: number): FotoSerata {
  return {
    src: `/copertine/${scelta.file}`,
    x: ORIZZONTALI[(h >>> 5) % ORIZZONTALI.length] ?? 50,
    y: VERTICALI[(h >>> 9) % VERTICALI.length] ?? 45,
    specchiata: ((h >>> 13) & 1) === 1,
  };
}

/**
 * Foto già assegnate in un elenco (`fotoDiUnElenco`), per seme: il dettaglio e la mappa della
 * stessa serata mostrano la stessa foto dell'elenco da cui si arriva.
 */
const assegnate = new Map<string, FotoSerata>();

/** Foto, inquadratura e verso di una serata: stesso seme, stessa copertina. */
export function fotoSerata(
  seme: string,
  famiglia: Famiglia,
  foto: readonly FotoLibera[] = FOTO_LIBERE,
): FotoSerata | null {
  const giaScelta = foto === FOTO_LIBERE ? assegnate.get(seme) : undefined;
  if (giaScelta) return giaScelta;
  const temi = TEMI[famiglia];
  const adatte = foto.filter((voce) => temi.includes(voce.tema));
  if (adatte.length === 0) return null;
  const h = fnv1a(`foto:${seme}`);
  const scelta = adatte[h % adatte.length];
  return scelta ? comeFoto(scelta, h) : null;
}

/**
 * Foto di tutte le serate di un elenco, nell'ordine in cui compaiono: una foto già usata
 * passa alla successiva adatta, così nello stesso elenco nessuna foto si ripete finché la
 * libreria ne ha (iterazione 12). Inquadratura e verso restano quelli del seme.
 */
export function fotoDiUnElenco(
  serate: ReadonlyArray<{ seme: string; famiglia: Famiglia }>,
  foto: readonly FotoLibera[] = FOTO_LIBERE,
): Map<string, FotoSerata> {
  const usate = new Set<string>();
  const risultato = new Map<string, FotoSerata>();
  for (const { seme, famiglia } of serate) {
    if (risultato.has(seme)) continue;
    const temi = TEMI[famiglia];
    const adatte = foto.filter((voce) => temi.includes(voce.tema));
    if (adatte.length === 0) continue;
    const h = fnv1a(`foto:${seme}`);
    const partenza = h % adatte.length;
    let scelta = adatte[partenza];
    for (let passo = 0; passo < adatte.length; passo++) {
      const candidata = adatte[(partenza + passo) % adatte.length];
      if (candidata && !usate.has(candidata.file)) {
        scelta = candidata;
        break;
      }
    }
    if (!scelta) continue;
    usate.add(scelta.file);
    const assegnata = comeFoto(scelta, h);
    risultato.set(seme, assegnata);
    if (foto === FOTO_LIBERE) assegnate.set(seme, assegnata);
  }
  return risultato;
}
