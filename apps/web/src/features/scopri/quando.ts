import { messaggi } from '@/lib/messaggi/it';
import type { Quando } from './filtri';

type Rapido = Exclude<Quando['tipo'], 'data'>;

/** Segmenti Stasera · Domani · Weekend; una data dal calendario non ne seleziona nessuno. */
export const OPZIONI_QUANDO: ReadonlyArray<{ valore: Rapido; etichetta: string }> = [
  { valore: 'stasera', etichetta: messaggi.scopri.stasera },
  { valore: 'domani', etichetta: messaggi.scopri.domani },
  { valore: 'weekend', etichetta: messaggi.scopri.weekend },
];

export function valoreQuando(quando: Quando): Rapido | null {
  return quando.tipo === 'data' ? null : quando.tipo;
}
