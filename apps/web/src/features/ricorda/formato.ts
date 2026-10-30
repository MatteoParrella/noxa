import { partiData } from '@/features/gruppi/formato';
import { NOMI_MESI, daIso, giornoSettimana } from '@/lib/date';
import { messaggi } from '@/lib/messaggi/it';
import type { Spesa } from './api';
import type { VoceMostrata } from './coda';

/** Testi formattati del diario (design/F-30-tracker): date, importi e voti in monospaziato. */

export { partiData };

const GIORNI_LUNGHI = [
  'lunedì',
  'martedì',
  'mercoledì',
  'giovedì',
  'venerdì',
  'sabato',
  'domenica',
] as const;
const due = (n: number) => String(n).padStart(2, '0');

/** "OTTOBRE 2026" da "2026-10". */
export function titoloMese(mese: string): string {
  const [anno, numero] = mese.split('-').map(Number) as [number, number];
  return `${NOMI_MESI[numero - 1] ?? ''} ${anno}`;
}

/** "SABATO 17.10.2026" (maiuscolo nello stile, qui in minuscolo). */
export function dataLunga(iso: string): string {
  const data = daIso(iso);
  return `${GIORNI_LUNGHI[giornoSettimana(data)] ?? ''} ${due(data.giorno)}.${due(data.mese)}.${data.anno}`;
}

/** "Sabato 17.10" */
export function dataMedia(iso: string): string {
  const data = daIso(iso);
  const giorno = GIORNI_LUNGHI[giornoSettimana(data)] ?? '';
  return `${giorno.charAt(0).toUpperCase()}${giorno.slice(1)} ${due(data.giorno)}.${due(data.mese)}`;
}

/** "€ 15,00", "€ 1.000,00": il punto delle migliaia sempre, anche a quattro cifre. */
export function euro(centesimi: number): string {
  const euro = Math.floor(centesimi / 100);
  const resto = centesimi % 100;
  return `€ ${String(euro).replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${due(resto)}`;
}

/** "15,00" per il campo dell'importo. */
export function importoInCampo(centesimi: number): string {
  return `${Math.floor(centesimi / 100)},${due(centesimi % 100)}`;
}

/**
 * Importo scritto dall'utente in centesimi: accetta "15", "15,5", "15,50", "15.50" e
 * "1.000,00"; null se non è un importo da 0,01 a 1.000 €.
 */
export function leggiImporto(testo: string): number | null {
  const pulito = testo.trim().replace(/\s|€/g, '');
  if (pulito === '') return null;
  let normale = pulito;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(pulito)) {
    normale = pulito.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+(,\d{1,2})?$/.test(pulito)) {
    normale = pulito.replace(',', '.');
  } else if (!/^\d+(\.\d{1,2})?$/.test(pulito)) {
    return null;
  }
  const centesimi = Math.round(Number(normale) * 100);
  return Number.isFinite(centesimi) && centesimi >= 1 && centesimi <= 100_000 ? centesimi : null;
}

export function totaleSpese(spese: readonly Spesa[]): number {
  return spese.reduce((somma, spesa) => somma + spesa.importo_centesimi, 0);
}

/** Titolo della serata: l'evento, altrimenti il locale o il nome scritto a mano. */
export function titoloVoce(voce: Pick<VoceMostrata, 'evento' | 'locale' | 'nome_locale_libero'>) {
  return voce.evento?.titolo ?? voce.locale?.nome ?? voce.nome_locale_libero ?? '';
}

/** Sottotitolo: "Binario 7 · Monza" per un evento, "Monza" per un locale, niente altrimenti. */
export function luogoVoce(voce: Pick<VoceMostrata, 'evento' | 'locale'>): string | null {
  if (!voce.locale) return null;
  return voce.evento ? `${voce.locale.nome} · ${voce.locale.comune}` : voce.locale.comune;
}

/** "con Marco B. e Sara C." oppure "con Elena V. e altri 2". */
export function conChi(nomi: readonly string[], altri: number): string | null {
  const testi = messaggi.ricorda.area;
  const totale = nomi.length + altri;
  if (totale === 0) return null;
  const [primo, secondo] = nomi;
  if (!primo) return testi.con(altri === 1 ? '1 persona' : `${altri} persone`);
  if (totale === 1) return testi.con(primo);
  if (totale === 2 && secondo) return testi.con(`${primo} e ${secondo}`);
  return testi.con(testi.eAltri(primo, totale - 1));
}

/** "21:30" in ora di Roma, per il riquadro dell'evento. */
export function oraRoma(iso: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
