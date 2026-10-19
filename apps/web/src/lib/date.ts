import { messaggi } from './messaggi/it';

/** Data di calendario senza ora né fuso. */
export type DataCalendario = { anno: number; mese: number; giorno: number };

export const NOMI_MESI = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
] as const;

/** Oggi nel fuso Europe/Rome, come nel database (SAFETY_PRIVACY.md §2). */
export function oggiARoma(adesso: Date = new Date()): DataCalendario {
  const parti = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(adesso);
  const valore = (tipo: string) => Number(parti.find((parte) => parte.type === tipo)?.value);
  return { anno: valore('year'), mese: valore('month'), giorno: valore('day') };
}

export function giorniNelMese(anno: number, mese: number): number {
  return new Date(Date.UTC(anno, mese, 0)).getUTCDate();
}

/** Anni compiuti a `oggi`. */
export function etaA(nascita: DataCalendario, oggi: DataCalendario): number {
  const compiuti =
    oggi.mese > nascita.mese || (oggi.mese === nascita.mese && oggi.giorno >= nascita.giorno);
  return oggi.anno - nascita.anno - (compiuti ? 0 : 1);
}

function confronta(a: DataCalendario, b: DataCalendario): number {
  return a.anno - b.anno || a.mese - b.mese || a.giorno - b.giorno;
}

const due = (numero: number) => String(numero).padStart(2, '0');

/** gg.mm.aaaa, il formato mostrato all'utente. */
export function formattaData(data: DataCalendario): string {
  return `${due(data.giorno)}.${due(data.mese)}.${data.anno}`;
}

/** AAAA-MM-GG, il formato inviato al database. */
export function dataIso(data: DataCalendario): string {
  return `${data.anno}-${due(data.mese)}-${due(data.giorno)}`;
}

/** Aggiunge i punti mentre si digitano le cifre: "14032009" diventa "14.03.2009". */
export function formattaDigitazione(testo: string): string {
  const cifre = testo.replace(/\D/g, '').slice(0, 8);
  if (cifre.length <= 2) return cifre;
  if (cifre.length <= 4) return `${cifre.slice(0, 2)}.${cifre.slice(2)}`;
  return `${cifre.slice(0, 2)}.${cifre.slice(2, 4)}.${cifre.slice(4)}`;
}

export type EsitoData =
  { valida: true; data: DataCalendario; eta: number } | { valida: false; errore: string };

/**
 * Controlla la data di nascita scritta dall'utente. Serve solo all'esperienza d'uso: l'età
 * minima la verifica il database (R-01, R-04).
 */
export function analizzaDataNascita(testo: string, oggi: DataCalendario = oggiARoma()): EsitoData {
  const testi = messaggi.registrazione.data;
  const pulito = testo.trim();
  if (pulito === '') return { valida: false, errore: testi.mancante };
  const corrispondenza = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(pulito);
  if (!corrispondenza) return { valida: false, errore: testi.formato };
  const [giorno, mese, anno] = corrispondenza.slice(1).map(Number) as [number, number, number];
  if (mese < 1 || mese > 12) return { valida: false, errore: testi.meseInesistente };
  const massimo = giorniNelMese(anno, mese);
  if (giorno < 1 || giorno > massimo) {
    return {
      valida: false,
      errore: testi.inesistente(anno, NOMI_MESI[mese - 1] ?? '', massimo),
    };
  }
  const data = { anno, mese, giorno };
  if (anno <= 1900) return { valida: false, errore: testi.troppoLontana };
  if (confronta(data, oggi) > 0) return { valida: false, errore: testi.futura };
  return { valida: true, data, eta: etaA(data, oggi) };
}

/**
 * Serata in corso nel fuso Europe/Rome: fino alle 06:00 vale ancora quella del giorno prima,
 * come `eventi.data_serata` nel database (DATA_MODEL.md §5.3).
 */
export function serataInCorso(adesso: Date = new Date()): DataCalendario {
  return oggiARoma(new Date(adesso.getTime() - 6 * 3600_000));
}

/** Data spostata di `giorni` (anche negativi), senza problemi di fuso o di ora legale. */
export function aggiungiGiorni(data: DataCalendario, giorni: number): DataCalendario {
  const spostata = new Date(Date.UTC(data.anno, data.mese - 1, data.giorno + giorni));
  return {
    anno: spostata.getUTCFullYear(),
    mese: spostata.getUTCMonth() + 1,
    giorno: spostata.getUTCDate(),
  };
}

/** Giorno della settimana: 0 lunedì … 6 domenica. */
export function giornoSettimana(data: DataCalendario): number {
  return (new Date(Date.UTC(data.anno, data.mese - 1, data.giorno)).getUTCDay() + 6) % 7;
}

export function confrontaDate(a: DataCalendario, b: DataCalendario): number {
  return confronta(a, b);
}

/** AAAA-MM-GG (dal database) → data di calendario. */
export function daIso(testo: string): DataCalendario {
  const [anno, mese, giorno] = testo.slice(0, 10).split('-').map(Number) as [
    number,
    number,
    number,
  ];
  return { anno, mese, giorno };
}
