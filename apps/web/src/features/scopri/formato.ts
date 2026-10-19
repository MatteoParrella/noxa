import {
  aggiungiGiorni,
  confrontaDate,
  daIso,
  giornoSettimana,
  serataInCorso,
  type DataCalendario,
} from '@/lib/date';
import { messaggi } from '@/lib/messaggi/it';
import type { AmicoPartecipante } from './api';
import { intervallo, type Filtri } from './filtri';

/** Testi formattati delle schede evento (design/F-01-scopri). */

const testi = messaggi.scopri;
const due = (numero: number) => String(numero).padStart(2, '0');

const GIORNI_BREVI = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'] as const;
const GIORNI = [
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
  'Domenica',
] as const;

/** "gio 15.10" */
export function giornoBreve(data: DataCalendario): string {
  return `${GIORNI_BREVI[giornoSettimana(data)]} ${due(data.giorno)}.${due(data.mese)}`;
}

/** Data mostrata accanto al titolo: "gio 15.10" oppure "16–18.10" per un intervallo. */
export function dataIntestazione(dal: DataCalendario, al: DataCalendario): string {
  if (confrontaDate(dal, al) === 0) return giornoBreve(dal);
  if (dal.mese === al.mese) return `${due(dal.giorno)}–${due(al.giorno)}.${due(al.mese)}`;
  return `${due(dal.giorno)}.${due(dal.mese)}–${due(al.giorno)}.${due(al.mese)}`;
}

/** Etichetta della sezione di una serata: "Stasera · gio 15.10", "Domani · ven 16.10", "Sabato 17.10". */
export function etichettaSerata(
  data: DataCalendario,
  oggi: DataCalendario = serataInCorso(),
): string {
  if (confrontaDate(data, oggi) === 0) return `${testi.stasera} · ${giornoBreve(data)}`;
  if (confrontaDate(data, aggiungiGiorni(oggi, 1)) === 0)
    return `${testi.domani} · ${giornoBreve(data)}`;
  return `${GIORNI[giornoSettimana(data)]} ${due(data.giorno)}.${due(data.mese)}`;
}

const formatoOra = new Intl.DateTimeFormat('it-IT', {
  timeZone: 'Europe/Rome',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** "23:00" nel fuso di Milano, qualunque sia il fuso del telefono. */
export function ora(istante: string): string {
  return formatoOra.format(new Date(istante));
}

/** "23:00 → 05:00", oppure solo l'inizio se la fine non è nota. */
export function orario(inizio: string, fine: string | null): string {
  return fine ? `${ora(inizio)} → ${ora(fine)}` : ora(inizio);
}

/** Badge d'età sempre scritto per intero (R-21): "18+" oppure "18+ · non dichiarata". */
export function etichettaEta(eta: number, dichiarata: boolean): string {
  return dichiarata ? `${eta}+` : `${eta}+ · ${testi.etaNonDichiarata}`;
}

/** Prezzo solo come informazione (R-43): "da 15 €", "Ingresso libero", null se non noto. */
export function prezzo(centesimi: number | null): string | null {
  if (centesimi === null) return null;
  if (centesimi === 0) return testi.ingressoLibero;
  const euro = centesimi / 100;
  const testo = Number.isInteger(euro)
    ? String(euro)
    : euro.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `da ${testo} €`;
}

/** "800 m", "2,1 km", "14 km". */
export function distanza(metri: number | null): string | null {
  if (metri === null) return null;
  if (metri < 1000) return `${Math.max(100, Math.round(metri / 100) * 100)} m`;
  const km = metri / 1000;
  return km < 10
    ? `${km.toLocaleString('it-IT', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km`
    : `${Math.round(km)} km`;
}

const nome = (amico: AmicoPartecipante) => amico.nome_visualizzato.split(' ')[0] ?? '';

/**
 * Riga "amici che partecipano" (F-04): solo amici confermati con partecipazione visibile, mai
 * contatori di persone in generale (R-43). Chi partecipa viene prima di chi è interessato.
 */
export function testoAmici(
  amici: AmicoPartecipante[],
  partecipano: number,
  interessati: number,
): string | null {
  const vanno = partecipano > 0;
  const totale = vanno ? partecipano : interessati;
  if (totale === 0) return null;
  const nomi = amici
    .filter((amico) => amico.stato === (vanno ? 'partecipo' : 'interessato'))
    .slice(0, 2)
    .map(nome);
  const altri = totale - nomi.length;
  return vanno ? testi.amici.vanno(nomi, altri) : testi.amici.interessa(nomi, altri);
}

/** Riassunto dei filtri accanto al pulsante: "Monza · 10 km · techno, house". */
export function riassuntoFiltri(filtri: Filtri, nomiGeneri: Record<string, string>): string {
  const parti: string[] = [];
  if (filtri.dove.tipo === 'comune') parti.push(filtri.dove.comune);
  if (filtri.dove.tipo === 'posizione') parti.push(testi.vicinoATe);
  if (filtri.dove.tipo !== 'ovunque')
    parti.push(filtri.distanzaKm ? `${filtri.distanzaKm} km` : testi.distanze.tutte);
  if (filtri.generi.length > 0)
    parti.push(filtri.generi.map((codice) => nomiGeneri[codice] ?? codice).join(', '));
  if (filtri.etaMassima !== null) parti.push(testi.fino(filtri.etaMassima));
  if (filtri.soloAmici) parti.push(testi.conAmici);
  return parti.length > 0 ? parti.join(' · ') : testi.tuttiGliEventi;
}

/** Etichetta sopra il titolo: "MONZA · ENTRO 10 KM", "VICINO A TE", "MILANO E BRIANZA". */
export function luogoIntestazione(filtri: Filtri): string {
  const luogo =
    filtri.dove.tipo === 'comune'
      ? filtri.dove.comune
      : filtri.dove.tipo === 'posizione'
        ? testi.vicinoATe
        : testi.milanoBrianza;
  return filtri.dove.tipo !== 'ovunque' && filtri.distanzaKm
    ? `${luogo} · ${testi.entro(filtri.distanzaKm)}`
    : luogo;
}

export type Serata<T> = { data: string; etichetta: string; eventi: T[] };

/** Eventi raggruppati per serata, nell'ordine in cui arrivano dal database. */
export function perSerata<T extends { data_serata: string }>(
  eventi: T[],
  oggi: DataCalendario = serataInCorso(),
): Serata<T>[] {
  const serate: Serata<T>[] = [];
  for (const evento of eventi) {
    const ultima = serate.at(-1);
    if (ultima && ultima.data === evento.data_serata) ultima.eventi.push(evento);
    else
      serate.push({
        data: evento.data_serata,
        etichetta: etichettaSerata(daIso(evento.data_serata), oggi),
        eventi: [evento],
      });
  }
  return serate;
}

/** Data dell'intestazione per i filtri attuali. */
export function dataFiltri(filtri: Filtri, oggi: DataCalendario = serataInCorso()): string {
  const [dal, al] = intervallo(filtri.quando, oggi);
  return dataIntestazione(dal, al);
}

/**
 * "Apri in Mappe": l'app di mappe del telefono (Apple Mappe su iOS, l'app scelta su Android),
 * OpenStreetMap sul computer. Si apre solo con un tocco dell'utente.
 */
export function linkMappe(
  luogo: { lat: number; lon: number; nome: string },
  agente: string = typeof navigator === 'undefined' ? '' : navigator.userAgent,
): string {
  const nome = encodeURIComponent(luogo.nome);
  if (/iPhone|iPad|iPod/.test(agente))
    return `https://maps.apple.com/?q=${nome}&ll=${luogo.lat},${luogo.lon}`;
  if (/Android/.test(agente))
    return `geo:${luogo.lat},${luogo.lon}?q=${luogo.lat},${luogo.lon}(${nome})`;
  return `https://www.openstreetmap.org/?mlat=${luogo.lat}&mlon=${luogo.lon}#map=17/${luogo.lat}/${luogo.lon}`;
}

/** Dominio mostrato accanto a un link esterno: "binario7.example". */
export function dominio(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
