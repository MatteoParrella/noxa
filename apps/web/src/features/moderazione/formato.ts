import { ErroreAutorizzazione, ErroreValidazione, converti } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';

const testi = messaggi.moderazione;
const FUSO = 'Europe/Rome';

const formatoDataOra = new Intl.DateTimeFormat('it-IT', {
  timeZone: FUSO,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
const formatoSerata = new Intl.DateTimeFormat('it-IT', {
  timeZone: FUSO,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});
const formatoData = new Intl.DateTimeFormat('it-IT', {
  timeZone: FUSO,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const formatoOra = new Intl.DateTimeFormat('it-IT', {
  timeZone: FUSO,
  hour: '2-digit',
  minute: '2-digit',
});

/** "19.10 08:12": data e ora compatte nelle tabelle (IBM Plex Mono). */
export function dataOra(istante: string): string {
  const parti = Object.fromEntries(
    formatoDataOra.formatToParts(new Date(istante)).map((p) => [p.type, p.value]),
  );
  return `${parti['day']}.${parti['month']} ${parti['hour']}:${parti['minute']}`;
}

/** "ven 24.10" per la serata di un evento (data AAAA-MM-GG). */
export function serata(data: string): string {
  const [anno, mese, giorno] = data.split('-').map(Number) as [number, number, number];
  const parti = Object.fromEntries(
    formatoSerata
      .formatToParts(new Date(Date.UTC(anno, mese - 1, giorno, 12)))
      .map((p) => [p.type, p.value]),
  );
  return `${parti['weekday']?.replace('.', '')} ${parti['day']}.${parti['month']}`;
}

/** "17.10.2026" per una data di calendario o un istante. */
export function data(valore: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(valore)) {
    const [anno, mese, giorno] = valore.split('-');
    return `${giorno}.${mese}.${anno}`;
  }
  return formatoData.format(new Date(valore)).replace(/\//g, '.');
}

export function oraBreve(istante: string): string {
  return formatoOra.format(new Date(istante));
}

/** "8,4 s" per la durata di un'esecuzione. */
export function durata(millisecondi: number): string {
  return `${(millisecondi / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })} s`;
}

export function etichettaEta(eta: number, dichiarata: boolean): string {
  return dichiarata ? `${eta}+` : `18+ · ${testi.eventi.nonDichiarata}`;
}

export function prezzo(centesimi: number | null): string {
  if (centesimi === null) return '—';
  if (centesimi === 0) return 'gratis';
  const euro = centesimi / 100;
  return `da ${euro.toLocaleString('it-IT', { maximumFractionDigits: 2 })} €`;
}

/** Valore per <input type="datetime-local"> nell'ora di Milano. */
export function perCampoDataOra(istante: string | null): string {
  if (!istante) return '';
  const parti = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: FUSO,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(istante))
      .map((p) => [p.type, p.value]),
  );
  return `${parti['year']}-${parti['month']}-${parti['day']}T${parti['hour']}:${parti['minute']}`;
}

/** ISO 8601 con fuso da un valore "AAAA-MM-GGTHH:MM" inteso come ora di Milano. */
export function daCampoDataOra(valore: string): string | null {
  const trovato = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(valore);
  if (!trovato) return null;
  const [anno, mese, giorno, ore, minuti] = trovato.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const comeUtc = Date.UTC(anno, mese - 1, giorno, ore, minuti);
  // Differenza tra Milano e UTC in quel momento (ora legale o solare).
  const aMilano = new Date(new Date(comeUtc).toLocaleString('en-US', { timeZone: FUSO }));
  const aUtc = new Date(new Date(comeUtc).toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(comeUtc - (aMilano.getTime() - aUtc.getTime())).toISOString();
}

/** Dominio e percorso di un URL senza schema, per le tabelle. */
export function urlBreve(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

/** Testo di un errore delle azioni di moderazione, con quello che si può fare. */
export function testoErrore(errore: unknown): string {
  const dominio = converti(errore);
  if (dominio instanceof ErroreValidazione) {
    const specifico = (testi.errori as Record<string, string>)[dominio.codice];
    if (specifico) return specifico;
    if (dominio.codice === 'non_trovato') return testi.comune.nonTrovato;
  }
  if (dominio instanceof ErroreAutorizzazione) return testi.errori.negato;
  return testi.comune.erroreSalvataggio.testo;
}
