import { messaggi } from '@/lib/messaggi/it';
import type { TipoNotifica } from './api';

const testi = messaggi.notifiche;

const testo = (valore: unknown) => (typeof valore === 'string' ? valore : '');

/**
 * Titolo e motivazione di una notifica. Gli esiti di moderazione hanno un titolo per esito; le
 * uscite da un gruppo dicono il motivo con il nome del gruppo, che la persona conosceva già
 * (R-15); le serate cambiate dicono cosa è cambiato.
 */
export function testoNotifica(tipo: TipoNotifica, dati: Record<string, unknown>) {
  if (tipo === 'rimozione_gruppo') {
    const gruppo = testo(dati.nome_gruppo);
    const motivo = testo(dati.motivo);
    if (!gruppo) return { titolo: testi.tipi.rimozione_gruppo, motivazione: null };
    if (dati.era_invitato === true)
      return { titolo: testi.rimozione.invitoScaduto(gruppo), motivazione: null };
    if (motivo === 'fasce' || motivo === 'compleanno')
      return { titolo: testi.rimozione[motivo](gruppo), motivazione: testi.rimozione.cosaFare };
    return { titolo: testi.rimozione.tolto(gruppo), motivazione: null };
  }
  if (tipo === 'aggiornamento_serata') {
    return {
      titolo: testi.serata[testo(dati.cambio)] ?? testi.tipi.aggiornamento_serata,
      motivazione: null,
    };
  }
  if (tipo !== 'esito_moderazione') return { titolo: testi.tipi[tipo], motivazione: null };
  const esito = testo(dati.esito);
  const chiave =
    esito === 'contenuto_rimosso' && dati.contenuto === 'foto'
      ? 'contenuto_rimosso_foto'
      : esito === 'contenuto_rimosso' && dati.tipo_oggetto === 'gruppo'
        ? 'contenuto_rimosso_gruppo'
        : esito === 'contenuto_rimosso' && dati.tipo_oggetto === 'serata_gruppo'
          ? 'contenuto_rimosso_serata'
          : esito;
  return {
    titolo: testi.esiti[chiave] ?? testi.tipi.esito_moderazione,
    motivazione: typeof dati.motivazione === 'string' ? dati.motivazione : null,
  };
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Pagina a cui porta una notifica: la serata o il gruppo quando la notifica li riguarda. */
export function linkNotifica(tipo: TipoNotifica, dati: Record<string, unknown>): string {
  const serata = testo(dati.serata_id);
  if ((tipo === 'nuova_serata' || tipo === 'aggiornamento_serata') && uuid.test(serata))
    return `/serata/?id=${serata}`;
  return LINK[tipo];
}

const LINK: Record<TipoNotifica, string> = {
  richiesta_amicizia: '/amici/',
  amicizia_accettata: '/amici/',
  invito_gruppo: '/organizza/',
  nuova_serata: '/organizza/',
  aggiornamento_serata: '/organizza/',
  checkin_amico: '/vivi/',
  ritorno_avviato: '/vivi/',
  ritorno_allerta: '/vivi/',
  ritorno_arrivato: '/vivi/',
  esito_moderazione: '/profilo/segnalazioni/',
  rimozione_gruppo: '/organizza/',
  badge_ottenuto: '/ricorda/badge/',
  riepilogo_pronto: '/ricorda/wrapped/',
};
