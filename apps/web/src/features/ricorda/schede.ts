import { messaggi } from '@/lib/messaggi/it';
import type { DatiRiepilogo } from './api-anno';

/**
 * Schede del riepilogo annuale (design/F-33-wrapped §Schede): da 5 a 8, quelle senza dati si
 * saltano. Solo dati del diario della persona: gli amici sono numeri (R-42), niente spesa
 * (R-43), nessun riferimento all'alcol, uguali per tutte le età.
 */

export type TipoScheda =
  'copertina' | 'serate' | 'locali' | 'musica' | 'compagnia' | 'badge' | 'voto' | 'chiusura';

export type Fondo = 'inchiostro' | 'accento' | 'superficie' | 'tenue';

export type SchedaWrapped = {
  tipo: TipoScheda;
  fondo: Fondo;
  /** Testo alternativo completo (design/F-33-wrapped §Accessibilità). */
  alt: string;
};

const s = messaggi.ricorda.riepilogo.schede;
const mesi = messaggi.ricorda.statistiche.mesi;

const nomeMese = (mese: number) => (mesi[mese - 1] ?? '').toLowerCase();
const serate = (n: number) => (n === 1 ? '1 serata' : `${n} serate`);
const elenco = (voci: readonly string[]) =>
  voci.length <= 1 ? (voci[0] ?? '') : `${voci.slice(0, -1).join(', ')} e ${voci.at(-1) ?? ''}`;

/** «Sabato 26 settembre 2026» da «2026-09-26». */
export function dataEstesa(iso: string): string {
  const [anno, mese, giorno] = iso.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(anno, mese - 1, giorno)));
}

/** Schede da mostrare, nell'ordine; `nomiBadge` traduce i codici dei badge in nomi. */
export function schedeDi(
  dati: DatiRiepilogo,
  nomiBadge: ReadonlyMap<string, string>,
): SchedaWrapped[] {
  const schede: SchedaWrapped[] = [
    {
      tipo: 'copertina',
      fondo: 'inchiostro',
      alt: `Il tuo ${dati.anno} di notte. ${s.copertinaNota}`,
    },
    {
      tipo: 'serate',
      fondo: 'accento',
      alt: `Hai annotato ${serate(dati.serate)}. Il mese più pieno è ${nomeMese(dati.mese_top.mese)}, con ${serate(dati.mese_top.serate)}.`,
    },
  ];
  if (dati.locali_diversi > 0) {
    const primi = dati.locali_top.map((l) => `${l.nome} con ${serate(l.serate)}`);
    schede.push({
      tipo: 'locali',
      fondo: 'superficie',
      alt:
        `Hai annotato serate in ${dati.locali_diversi === 1 ? '1 locale' : `${dati.locali_diversi} locali diversi`}.` +
        (primi.length > 0 ? ` I più frequenti: ${elenco(primi)}.` : ''),
    });
  }
  if (dati.genere_top || dati.dj_top.length > 0) {
    schede.push({
      tipo: 'musica',
      fondo: 'tenue',
      alt:
        (dati.genere_top ? `Il tuo genere: ${dati.genere_top.nome}.` : '') +
        (dati.dj_top.length > 0 ? ` I tuoi DJ: ${elenco(dati.dj_top.map((d) => d.nome))}.` : ''),
    });
  }
  if (dati.serate_con_amici > 0) {
    schede.push({
      tipo: 'compagnia',
      fondo: 'inchiostro',
      alt: `${serate(dati.serate_con_amici)} in compagnia, con ${dati.amici_diversi === 1 ? '1 amico' : `${dati.amici_diversi} amici diversi`}.`,
    });
  }
  const badge = dati.badge.map((codice) => nomiBadge.get(codice)).filter((n) => n !== undefined);
  if (badge.length > 0) {
    schede.push({
      tipo: 'badge',
      fondo: 'accento',
      alt: `${badge.length === 1 ? '1 badge ottenuto' : `${badge.length} badge ottenuti`} nel ${dati.anno}: ${elenco(badge)}.`,
    });
  }
  if (dati.voto_top) {
    schede.push({
      tipo: 'voto',
      fondo: 'superficie',
      alt:
        `La serata col voto più alto: ${dati.voto_top.voto} su 5, ${dataEstesa(dati.voto_top.data_serata)}` +
        (dati.voto_top.locale ? `, ${dati.voto_top.locale}.` : '.'),
    });
  }
  schede.push({
    tipo: 'chiusura',
    fondo: 'inchiostro',
    alt: `Ci vediamo nel ${dati.anno + 1}. Noxa.`,
  });
  return schede;
}

/** Nome del file dell'immagine salvata: niente nomi di persone, solo anno e scheda. */
export function nomeFile(anno: number, tipo: TipoScheda): string {
  return `noxa-${anno}-${tipo}.png`;
}
