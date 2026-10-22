import { messaggi } from '@/lib/messaggi/it';
import type { TipoNotifica } from './api';

const testi = messaggi.notifiche;

/** Titolo e motivazione di una notifica; gli esiti di moderazione hanno un titolo per esito. */
export function testoNotifica(tipo: TipoNotifica, dati: Record<string, unknown>) {
  if (tipo !== 'esito_moderazione') return { titolo: testi.tipi[tipo], motivazione: null };
  const esito = typeof dati.esito === 'string' ? dati.esito : '';
  const chiave =
    esito === 'contenuto_rimosso' && dati.contenuto === 'foto' ? 'contenuto_rimosso_foto' : esito;
  return {
    titolo: testi.esiti[chiave] ?? testi.tipi.esito_moderazione,
    motivazione: typeof dati.motivazione === 'string' ? dati.motivazione : null,
  };
}
