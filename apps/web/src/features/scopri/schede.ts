import type { DatiCopertina } from '@/components/ui/Copertina';
import type { DatiSchedaEvento } from '@/components/ui/SchedaEvento';
import { daIso } from '@/lib/date';
import { messaggi } from '@/lib/messaggi/it';
import type { EventoElenco, TipoCopertina } from './api';
import { nomeGenere } from './dati';
import { distanza, etichettaEta, giornoBreve, ora, orario, prezzo, testoAmici } from './formato';

/** Copertina con il link firmato, se c'è (ADR-0018). */
export function copertina(
  evento: {
    copertina_tipo: TipoCopertina;
    copertina_path: string | null;
    locale_nome: string;
    titolo: string;
  },
  link: Record<string, string> | undefined,
): DatiCopertina {
  const url = evento.copertina_path ? link?.[evento.copertina_path] : undefined;
  return {
    tipo: evento.copertina_tipo,
    url,
    alt:
      evento.copertina_tipo === 'flyer'
        ? messaggi.evento.flyer(evento.titolo)
        : messaggi.evento.fotoLocale(evento.locale_nome),
  };
}

/** Dati di presentazione di una scheda dell'elenco o della mappa. */
export function datiScheda(
  evento: EventoElenco,
  link: Record<string, string> | undefined,
  nomiGeneri: Record<string, string>,
): DatiSchedaEvento {
  const giorno = giornoBreve(daIso(evento.data_serata));
  const eta = etichettaEta(evento.eta_minima, evento.eta_minima_dichiarata);
  const quando = `${giorno} · ${orario(evento.inizio, evento.fine)}`;
  const meta = [distanza(evento.distanza_m), prezzo(evento.prezzo_min_centesimi)].filter(
    (voce): voce is string => voce !== null,
  );
  const amici = testoAmici(evento.amici, evento.amici_partecipano, evento.amici_interessati);
  const annullato = evento.stato === 'annullato';
  return {
    href: `/evento/?id=${evento.id}`,
    nome: messaggi.scopri.evento({
      titolo: evento.titolo,
      locale: evento.locale_nome,
      comune: evento.locale_comune,
      quando: `${giorno} ${ora(evento.inizio)}`,
      eta,
      // Il nome del link sostituisce il contenuto: dentro c'è tutto quello che la scheda mostra.
      altro: [
        ...(annullato ? [messaggi.scopri.annullato] : []),
        ...meta,
        ...(amici ? [amici] : []),
      ],
    }),
    titolo: evento.titolo,
    locale: evento.locale_nome,
    comune: evento.locale_comune,
    quando,
    ora: ora(evento.inizio),
    orario: orario(evento.inizio, evento.fine),
    eta,
    generi: evento.generi_evento.slice(0, 2).map((codice) => nomeGenere(nomiGeneri, codice)),
    meta,
    annullato,
    copertina: copertina(evento, link),
  };
}
