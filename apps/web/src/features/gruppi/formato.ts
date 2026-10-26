import { daIso, giornoSettimana } from '@/lib/date';
import { messaggi } from '@/lib/messaggi/it';
import type { MezzoTrasporto, Partecipante, RispostaSerata } from './api';

/** Testi formattati di gruppi e serate (design/F-13-gruppi, design/F-14-serata). */

const GIORNI = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'] as const;
const due = (n: number) => String(n).padStart(2, '0');

/** Giorno e data separati per la colonna monospaziata: { giorno: 'SAB', data: '08.11' }. */
export function partiData(iso: string): { giorno: string; data: string } {
  const data = daIso(iso);
  return {
    giorno: GIORNI[giornoSettimana(data)] ?? '',
    data: `${due(data.giorno)}.${due(data.mese)}`,
  };
}

/** "SAB 08.11" */
export function dataBreve(iso: string): string {
  const { giorno, data } = partiData(iso);
  return `${giorno} ${data}`;
}

/** "21:30" da un orario di Postgres ("21:30:00"). */
export function oraRitrovo(ora: string | null): string | null {
  return ora ? ora.slice(0, 5) : null;
}

/** Conteggi delle risposte di chi si vede. */
export function contaRisposte(partecipanti: readonly Partecipante[]) {
  const conta = (risposta: RispostaSerata) =>
    partecipanti.filter((p) => p.risposta === risposta).length;
  return { si: conta('si'), forse: conta('forse'), no: conta('no') };
}

/** Chi viene (sì o forse) e non ha ancora scelto come tornare: solo il numero, senza nomi. */
export function senzaRitorno(partecipanti: readonly Partecipante[]): number {
  return partecipanti.filter(
    (p) => (p.risposta === 'si' || p.risposta === 'forse') && p.trasporto_ritorno === null,
  ).length;
}

export function guida(p: Pick<Partecipante, 'trasporto_andata' | 'trasporto_ritorno'>): boolean {
  return p.trasporto_andata === 'auto_guido' || p.trasporto_ritorno === 'auto_guido';
}

/** Auto del gruppo: chi guida, i passeggeri che hanno scelto il passaggio e i posti rimasti. */
export function autoDelGruppo(partecipanti: readonly Partecipante[]) {
  return partecipanti
    .filter((p) => guida(p) && p.risposta !== 'no')
    .map((conducente) => {
      const passeggeri = partecipanti.filter((p) => p.passaggio_da === conducente.id);
      const posti = conducente.posti_liberi ?? 0;
      return { conducente, passeggeri, rimasti: Math.max(posti - passeggeri.length, 0), posti };
    });
}

/** Etichetta di un mezzo, "Da decidere" se manca. */
export function etichettaMezzo(mezzo: MezzoTrasporto | null): string {
  return mezzo ? messaggi.gruppi.serata.mezzi[mezzo] : messaggi.gruppi.serata.daDecidere;
}
