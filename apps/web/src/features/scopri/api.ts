import { z } from 'zod';
import { converti } from '@/lib/errori';
import { supabase } from '@/lib/supabase';
import type { ParametriRicerca } from './filtri';

/**
 * Catalogo degli eventi (F-01…F-05). Le regole stanno nel database: `cerca_eventi` e
 * `dettaglio_evento` sono security invoker ed ereditano la RLS (R-20…R-23, R-67). Le
 * coordinate sono solo parametri della chiamata e non vengono salvate né registrate (R-33).
 */

const SchemaStatoPartecipazione = z.enum(['interessato', 'partecipo']);
export type StatoPartecipazione = z.infer<typeof SchemaStatoPartecipazione>;

const SchemaAmico = z.object({
  id: z.uuid(),
  /** Solo nel dettaglio, per aprire il profilo dell'amico. */
  username: z.string().optional(),
  nome_visualizzato: z.string(),
  stato: SchemaStatoPartecipazione,
});
export type AmicoPartecipante = z.infer<typeof SchemaAmico>;

const SchemaCopertina = z.enum(['locale', 'flyer', 'tipografica']);
export type TipoCopertina = z.infer<typeof SchemaCopertina>;

const SchemaEvento = z.object({
  id: z.uuid(),
  titolo: z.string(),
  inizio: z.string(),
  fine: z.string().nullable(),
  data_serata: z.string(),
  eta_minima: z.number().int(),
  eta_minima_dichiarata: z.boolean(),
  stato: z.enum(['in_revisione', 'pubblicato', 'rifiutato', 'annullato']),
  prezzo_min_centesimi: z.number().int().nullable(),
  generi_evento: z.array(z.string()),
  locale_id: z.uuid(),
  locale_nome: z.string(),
  locale_comune: z.string(),
  locale_lat: z.number(),
  locale_lon: z.number(),
  distanza_m: z.number().int().nullable(),
  copertina_tipo: SchemaCopertina,
  copertina_path: z.string().nullable(),
  copertina_attribuzione: z.string().nullable(),
  amici_partecipano: z.number().int(),
  amici_interessati: z.number().int(),
  amici: z.array(SchemaAmico),
  mia_partecipazione: SchemaStatoPartecipazione.nullable(),
});
export type EventoElenco = z.infer<typeof SchemaEvento>;

export async function cercaEventi(parametri: ParametriRicerca): Promise<EventoElenco[]> {
  const { data, error } = await supabase().rpc('cerca_eventi', {
    dal: parametri.dal,
    al: parametri.al,
    ...(parametri.lat !== null && parametri.lon !== null
      ? { lat: parametri.lat, lon: parametri.lon }
      : {}),
    ...(parametri.raggioKm !== null ? { raggio_km: parametri.raggioKm } : {}),
    ...(parametri.generi.length > 0 ? { generi: parametri.generi } : {}),
    ...(parametri.etaMassima !== null ? { eta_minima_max: parametri.etaMassima } : {}),
    solo_amici: parametri.soloAmici,
  });
  if (error) throw converti(error);
  const esito = z.array(SchemaEvento).safeParse(data);
  if (!esito.success) throw converti(esito.error);
  return esito.data;
}

const SchemaDettaglio = SchemaEvento.omit({
  locale_id: true,
  distanza_m: true,
  amici_partecipano: true,
  amici_interessati: true,
}).extend({
  descrizione: z.string().nullable(),
  artisti: z.array(z.string()),
  url_biglietti: z.string().nullable(),
  locale_id: z.uuid(),
  locale_indirizzo: z.string(),
  fonte_tipo: z.string().nullable(),
  fonte_url: z.string().nullable(),
  mia_visibilita: z.boolean().nullable(),
});
export type DettaglioEvento = z.infer<typeof SchemaDettaglio>;

/** Dettaglio di un evento, oppure null in tutti i casi in cui non si può vedere (R-20, R-23). */
export async function dettaglioEvento(id: string): Promise<DettaglioEvento | null> {
  const { data, error } = await supabase().rpc('dettaglio_evento', { evento: id });
  if (error) throw converti(error);
  const esito = z.array(SchemaDettaglio).max(1).safeParse(data);
  if (!esito.success) throw converti(esito.error);
  return esito.data[0] ?? null;
}

/** Visibilità predefinita delle partecipazioni, dalle impostazioni di privacy (R-67). */
export async function visibilitaPredefinita(io: string): Promise<boolean> {
  const { data, error } = await supabase()
    .from('profili_privati')
    .select('partecipazioni_visibili')
    .eq('utente_id', io)
    .maybeSingle();
  if (error) throw converti(error);
  return data?.partecipazioni_visibili ?? false;
}

export type Partecipazione = { stato: StatoPartecipazione; visibile: boolean } | null;

/**
 * Porta la propria partecipazione da `prima` a `dopo` (F-05): inserimento, modifica o
 * cancellazione. Niente upsert: il titolare e l'evento non si aggiornano (permessi di colonna).
 */
export async function cambiaPartecipazione(dati: {
  io: string;
  evento: string;
  prima: Partecipazione;
  dopo: Partecipazione;
}): Promise<void> {
  const tabella = supabase().from('partecipazioni_evento');
  const { io, evento, prima, dopo } = dati;
  const { error } = !dopo
    ? await tabella.delete().eq('utente_id', io).eq('evento_id', evento)
    : !prima
      ? await tabella.insert({
          utente_id: io,
          evento_id: evento,
          stato: dopo.stato,
          visibile_agli_amici: dopo.visibile,
        })
      : await tabella
          .update({ stato: dopo.stato, visibile_agli_amici: dopo.visibile })
          .eq('utente_id', io)
          .eq('evento_id', evento);
  if (error) throw converti(error);
}

export type MotivoSegnalazioneEvento =
  'evento_falso' | 'dati_errati' | 'contenuto_inappropriato' | 'alcol_a_minori' | 'altro';

/** Segnalazione di un evento o della foto del suo locale (R-50, ADR-0018). */
export async function segnala(dati: {
  io: string;
  oggetto: { tipo: 'evento' | 'immagine_locale'; id: string };
  motivo: MotivoSegnalazioneEvento;
}): Promise<void> {
  const { error } = await supabase().from('segnalazioni').insert({
    segnalante_id: dati.io,
    tipo_oggetto: dati.oggetto.tipo,
    oggetto_id: dati.oggetto.id,
    motivo: dati.motivo,
  });
  if (error) throw converti(error);
}

export type Copertina = { tipo: TipoCopertina; path: string | null };

const BUCKET: Record<Exclude<TipoCopertina, 'tipografica'>, string> = {
  locale: 'immagini-locali',
  flyer: 'flyer-pubblicati',
};

/** Durata dei link firmati alle immagini dei bucket privati (DATA_MODEL.md §6). */
export const DURATA_LINK_SECONDI = 3600;

/**
 * Link firmati per le copertine: i bucket sono privati e lo storage applica le stesse regole
 * di visibilità degli eventi e dei locali. Un'immagine che non si può firmare resta senza link
 * e la copertina passa al fondo tipografico.
 */
export async function firmaCopertine(copertine: Copertina[]): Promise<Record<string, string>> {
  const perBucket = new Map<string, Set<string>>();
  for (const copertina of copertine) {
    if (copertina.tipo === 'tipografica' || !copertina.path) continue;
    const bucket = BUCKET[copertina.tipo];
    const percorsi = perBucket.get(bucket) ?? new Set<string>();
    percorsi.add(copertina.path);
    perBucket.set(bucket, percorsi);
  }
  const link: Record<string, string> = {};
  for (const [bucket, percorsi] of perBucket) {
    const { data, error } = await supabase()
      .storage.from(bucket)
      .createSignedUrls([...percorsi], DURATA_LINK_SECONDI);
    if (error) throw converti(error);
    for (const voce of data) {
      if (voce.path && voce.signedUrl && !voce.error) link[voce.path] = voce.signedUrl;
    }
  }
  return link;
}

const SchemaGenere = z.object({ codice: z.string(), nome: z.string() });
export type GenereMusicale = z.infer<typeof SchemaGenere>;

export async function leggiGeneri(): Promise<GenereMusicale[]> {
  const { data, error } = await supabase()
    .from('generi_musicali')
    .select('codice, nome')
    .order('nome');
  if (error) throw converti(error);
  const esito = z.array(SchemaGenere).safeParse(data);
  if (!esito.success) throw converti(esito.error);
  // "altro" va sempre in fondo.
  return esito.data.sort((a, b) => Number(a.codice === 'altro') - Number(b.codice === 'altro'));
}
