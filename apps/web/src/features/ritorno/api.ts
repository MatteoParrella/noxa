import { CapacitorHttp } from '@capacitor/core';
import { z } from 'zod';
import { SchemaPersona } from '@/features/amici/api';
import { leggiAmbiente } from '@/lib/ambiente';
import { converti, ErroreRete, ErroreValidazione } from '@/lib/errori';
import { supabase } from '@/lib/supabase';

/**
 * Ritorno sicuro (F-21, R-31): una sessione avviata a mano, da 1 a 5 amici confermati, con
 * l'arrivo previsto tra 10 minuti e 4 ore. Le regole stanno nel database (un ritorno attivo,
 * destinatari amici, limiti, allerta dal server): qui solo chiamate e conversione degli errori.
 */

const SchemaPosizione = z.object({
  lat: z.number(),
  lon: z.number(),
  precisione_m: z.number(),
  registrata_il: z.string(),
});
export type Posizione = z.infer<typeof SchemaPosizione>;

const SchemaStato = z.enum(['attivo', 'arrivato', 'annullato', 'scaduto']);
export type StatoRitorno = z.infer<typeof SchemaStato>;

const Comune = {
  id: z.uuid(),
  stato: SchemaStato,
  avviato_il: z.string(),
  arrivo_previsto: z.string(),
  allerta_inviata_il: z.string().nullable(),
  concluso_il: z.string().nullable(),
  posizione: SchemaPosizione.nullable(),
};

const SchemaRitorniVivi = z.object({
  mio: z.object({ ...Comune, destinatari: z.array(SchemaPersona) }).nullable(),
  ricevuti: z.array(z.object({ ...Comune, utente: SchemaPersona })),
});

export type Persona = z.infer<typeof SchemaPersona>;

type Base = {
  id: string;
  stato: StatoRitorno;
  avviatoIl: string;
  arrivoPrevisto: string;
  allertaInviataIl: string | null;
  conclusoIl: string | null;
  posizione: Posizione | null;
};
export type MioRitorno = Base & { destinatari: Persona[] };
export type RitornoAmico = Base & { persona: Persona };
export type RitorniVivi = { mio: MioRitorno | null; ricevuti: RitornoAmico[] };

function base(riga: z.infer<z.ZodObject<typeof Comune>>): Base {
  return {
    id: riga.id,
    stato: riga.stato,
    avviatoIl: riga.avviato_il,
    arrivoPrevisto: riga.arrivo_previsto,
    allertaInviataIl: riga.allerta_inviata_il,
    conclusoIl: riga.concluso_il,
    posizione: riga.posizione,
  };
}

/** Il proprio ritorno attivo e quelli ricevuti (attivi o conclusi da meno di 15 minuti). */
export async function leggiRitorni(): Promise<RitorniVivi> {
  const { data, error } = await supabase().rpc('ritorni_vivi');
  if (error) throw converti(error);
  const esito = SchemaRitorniVivi.safeParse(data);
  if (!esito.success) throw converti(esito.error);
  return {
    mio: esito.data.mio
      ? { ...base(esito.data.mio), destinatari: esito.data.mio.destinatari }
      : null,
    ricevuti: esito.data.ricevuti.map((riga) => ({ ...base(riga), persona: riga.utente })),
  };
}

const SchemaSuggerimenti = z.object({
  partenza: z.string().nullable(),
  serate: z.array(
    z.object({
      serata_id: z.uuid(),
      titolo: z.string(),
      locale: z.string().nullable(),
      amici: z.array(z.uuid()),
      torna_con_te: z.array(z.uuid()),
    }),
  ),
});
export type SuggerimentiRitorno = z.infer<typeof SchemaSuggerimenti>;

/** Serate di stasera con gli amici da proporre e chi torna con te (F-16). */
export async function leggiSuggerimentiRitorno(): Promise<SuggerimentiRitorno> {
  const { data, error } = await supabase().rpc('suggerimenti_ritorno');
  if (error) throw converti(error);
  const esito = SchemaSuggerimenti.safeParse(data);
  if (!esito.success) throw converti(esito.error);
  return esito.data;
}

const SchemaEsitoAvvio = z.object({
  id: z.uuid(),
  avviato_il: z.string(),
  arrivo_previsto: z.string(),
  destinatari: z.array(z.uuid()),
  esclusi: z.array(z.uuid()),
});
export type EsitoAvvio = z.infer<typeof SchemaEsitoAvvio>;

/** Avvia il ritorno; chi non è più un amico confermato torna in `esclusi`. */
export async function avviaRitorno(dati: {
  arrivoPrevisto: Date;
  destinatari: string[];
}): Promise<EsitoAvvio> {
  const { data, error } = await supabase().rpc('avvia_ritorno', {
    arrivo_previsto: dati.arrivoPrevisto.toISOString(),
    destinatari: dati.destinatari,
  });
  if (error) throw converti(error);
  const esito = SchemaEsitoAvvio.safeParse(data);
  if (!esito.success) throw converti(esito.error);
  return esito.data;
}

/** Proroga di 15 o 30 minuti, entro 4 ore dall'avvio: restituisce il nuovo arrivo previsto. */
export async function prorogaRitorno(id: string, minuti: 15 | 30): Promise<string> {
  const { data, error } = await supabase().rpc('proroga_ritorno', { ritorno: id, minuti });
  if (error) throw converti(error);
  const esito = z.string().safeParse(data);
  if (!esito.success) throw converti(esito.error);
  return esito.data;
}

/** "Sono arrivato" o "Annulla ritorno": l'ora di fine la scrive il database. */
export async function concludiRitorno(id: string, stato: 'arrivato' | 'annullato'): Promise<void> {
  const { error } = await supabase().from('ritorni_sicuri').update({ stato }).eq('id', id);
  if (error) throw converti(error);
}

/** Toglie un destinatario: il ritorno sparisce subito dal suo telefono; l'ultimo annulla. */
export async function togliDestinatarioRitorno(ritorno: string, amico: string): Promise<void> {
  const { error } = await supabase()
    .from('ritorni_destinatari')
    .delete()
    .eq('ritorno_id', ritorno)
    .eq('amico_id', amico);
  if (error) throw converti(error);
}

export type Coordinate = { lat: number; lon: number; precisione: number };

/**
 * Invia una posizione. Nell'app Android la richiesta passa dal client HTTP nativo: dopo 5
 * minuti in background Android rallenta le richieste della WebView (ADR-0028).
 */
export async function inviaPosizione(
  ritorno: string,
  coordinate: Coordinate,
  nativo: boolean,
): Promise<void> {
  const argomenti = {
    ritorno,
    latitudine: coordinate.lat,
    longitudine: coordinate.lon,
    precisione_m: Math.max(1, Math.min(10_000, Math.round(coordinate.precisione))),
  };
  if (!nativo) {
    const { error } = await supabase().rpc('invia_posizione_ritorno', argomenti);
    if (error) throw converti(error);
    return;
  }
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ErroreValidazione('ritorno_non_attivo');
  const { supabaseUrl, supabaseChiaveAnon } = leggiAmbiente();
  let risposta;
  try {
    risposta = await CapacitorHttp.post({
      url: `${supabaseUrl}/rest/v1/rpc/invia_posizione_ritorno`,
      headers: {
        apikey: supabaseChiaveAnon,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: argomenti,
      connectTimeout: 10_000,
      readTimeout: 10_000,
    });
  } catch (errore) {
    throw new ErroreRete('posizione non inviata', errore);
  }
  if (risposta.status >= 200 && risposta.status < 300) return;
  const corpo: unknown = risposta.data;
  throw converti(
    typeof corpo === 'object' && corpo !== null ? corpo : { message: String(corpo), code: '' },
  );
}
