import { z } from 'zod';
import { PROFILO, SchemaPersona } from '@/features/amici/api';
import { converti } from '@/lib/errori';
import { supabase } from '@/lib/supabase';

/**
 * Check-in "sono qui" (F-20, R-30): solo il locale, solo agli amici confermati scelti, per 6
 * ore. Le regole stanno nel database (impostazione accesa, un check-in attivo, destinatari
 * amici, scadenza, blocchi): qui solo chiamate e conversione degli errori.
 */

const SchemaLocale = z.object({ id: z.uuid(), nome: z.string(), comune: z.string() });
// Null se l'evento non è visibile all'età di chi guarda (R-20): resta il locale.
const SchemaEvento = z.object({ id: z.uuid(), titolo: z.string() }).nullable();

const SchemaMioCheckin = z.object({
  id: z.uuid(),
  creato_il: z.string(),
  scade_il: z.string(),
  locale: SchemaLocale,
  evento: SchemaEvento,
  destinatari: z.array(z.object({ amico: SchemaPersona.nullable() })),
});

export type Persona = z.infer<typeof SchemaPersona>;

export type MioCheckin = {
  id: string;
  creatoIl: string;
  scadeIl: string;
  locale: z.infer<typeof SchemaLocale>;
  evento: z.infer<typeof SchemaEvento>;
  destinatari: Persona[];
};

/** Il proprio check-in attivo, o null. */
export async function leggiMioCheckin(io: string): Promise<MioCheckin | null> {
  const { data, error } = await supabase()
    .from('checkin')
    .select(
      `id, creato_il, scade_il, locale:locali(id, nome, comune), evento:eventi(id, titolo),
       destinatari:checkin_destinatari(amico:profili!checkin_destinatari_amico_id_fkey(${PROFILO}))`,
    )
    .eq('utente_id', io)
    .is('terminato_il', null)
    .gt('scade_il', new Date().toISOString())
    .order('creato_il', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw converti(error);
  if (!data) return null;
  const riga = SchemaMioCheckin.safeParse(data);
  if (!riga.success) throw converti(riga.error);
  return {
    id: riga.data.id,
    creatoIl: riga.data.creato_il,
    scadeIl: riga.data.scade_il,
    locale: riga.data.locale,
    evento: riga.data.evento,
    destinatari: riga.data.destinatari
      .flatMap(({ amico }) => (amico ? [amico] : []))
      .sort((a, b) => a.nome_visualizzato.localeCompare(b.nome_visualizzato, 'it')),
  };
}

const SchemaCheckinAmico = z.object({
  id: z.uuid(),
  creato_il: z.string(),
  scade_il: z.string(),
  locale: SchemaLocale.nullable(),
  evento: SchemaEvento,
  // Null se il profilo non è più visibile (account sospeso): la riga si ignora.
  utente: SchemaPersona.nullable(),
});

export type CheckinAmico = {
  id: string;
  creatoIl: string;
  scadeIl: string;
  locale: z.infer<typeof SchemaLocale>;
  evento: z.infer<typeof SchemaEvento>;
  persona: Persona;
};

/** Check-in attivi degli amici che mi hanno scelto: la RLS restituisce solo quelli (R-30). */
export async function leggiCheckinAmici(io: string): Promise<CheckinAmico[]> {
  const { data, error } = await supabase()
    .from('checkin')
    .select(
      `id, creato_il, scade_il, locale:locali(id, nome, comune), evento:eventi(id, titolo),
       utente:profili!checkin_utente_id_fkey(${PROFILO})`,
    )
    .neq('utente_id', io)
    .is('terminato_il', null)
    .gt('scade_il', new Date().toISOString())
    .order('creato_il', { ascending: false });
  if (error) throw converti(error);
  const righe = z.array(SchemaCheckinAmico).safeParse(data);
  if (!righe.success) throw converti(righe.error);
  return righe.data.flatMap((riga) =>
    riga.utente && riga.locale
      ? [
          {
            id: riga.id,
            creatoIl: riga.creato_il,
            scadeIl: riga.scade_il,
            locale: riga.locale,
            evento: riga.evento,
            persona: riga.utente,
          },
        ]
      : [],
  );
}

/** Un check-in ricevuto, per la notifica: null se è terminato, scaduto o non più visibile. */
export async function leggiCheckinRicevuto(id: string): Promise<CheckinAmico | null> {
  const { data, error } = await supabase()
    .from('checkin')
    .select(
      `id, creato_il, scade_il, locale:locali(id, nome, comune), evento:eventi(id, titolo),
       utente:profili!checkin_utente_id_fkey(${PROFILO})`,
    )
    .eq('id', id)
    .is('terminato_il', null)
    .gt('scade_il', new Date().toISOString())
    .maybeSingle();
  if (error) throw converti(error);
  const riga = SchemaCheckinAmico.nullable().safeParse(data);
  if (!riga.success) throw converti(riga.error);
  if (!riga.data?.utente || !riga.data.locale) return null;
  return {
    id: riga.data.id,
    creatoIl: riga.data.creato_il,
    scadeIl: riga.data.scade_il,
    locale: riga.data.locale,
    evento: riga.data.evento,
    persona: riga.data.utente,
  };
}

/** Impostazione "Check-in «sono qui»" di Privacy e dati (R-30, spenta di default). */
export async function leggiCheckinAbilitato(io: string): Promise<boolean> {
  const { data, error } = await supabase()
    .from('profili_privati')
    .select('checkin_abilitato')
    .eq('utente_id', io)
    .single();
  if (error) throw converti(error);
  return data.checkin_abilitato;
}

/** Spegnerla termina il check-in attivo (trigger `dopo_disattivazione_checkin`). */
export async function salvaCheckinAbilitato(io: string, abilitato: boolean): Promise<void> {
  const { error } = await supabase()
    .from('profili_privati')
    .update({ checkin_abilitato: abilitato })
    .eq('utente_id', io);
  if (error) throw converti(error);
}

const SchemaSuggerimenti = z.object({
  eventi: z.array(
    z.object({
      evento_id: z.uuid(),
      titolo: z.string(),
      inizio: z.string(),
      fine: z.string().nullable(),
      locale_id: z.uuid(),
      locale: z.string(),
      comune: z.string(),
    }),
  ),
  serate: z.array(
    z.object({
      serata_id: z.uuid(),
      titolo: z.string(),
      evento_id: z.uuid().nullable(),
      evento: z.string().nullable(),
      locale_id: z.uuid().nullable(),
      locale: z.string().nullable(),
      comune: z.string().nullable(),
      amici: z.array(z.uuid()),
    }),
  ),
});
export type Suggerimenti = z.infer<typeof SchemaSuggerimenti>;

/** Eventi a cui partecipi stasera e serate di gruppo di stasera, con gli amici da proporre. */
export async function leggiSuggerimenti(): Promise<Suggerimenti> {
  const { data, error } = await supabase().rpc('suggerimenti_checkin');
  if (error) throw converti(error);
  const esito = SchemaSuggerimenti.safeParse(data);
  if (!esito.success) throw converti(esito.error);
  return esito.data;
}

const SchemaLocaleTrovato = SchemaLocale.extend({ indirizzo: z.string() });
export type LocaleTrovato = z.infer<typeof SchemaLocaleTrovato>;

/** Locali attivi del catalogo per nome: nessuna posizione del telefono (R-30). */
export async function cercaLocali(testo: string): Promise<LocaleTrovato[]> {
  const pulito = testo.trim().replace(/[%_\\]/g, '');
  if (pulito.length < 2) return [];
  const { data, error } = await supabase()
    .from('locali')
    .select('id, nome, comune, indirizzo')
    .eq('attivo', true)
    .ilike('nome', `%${pulito}%`)
    .order('nome')
    .limit(8);
  if (error) throw converti(error);
  const esito = z.array(SchemaLocaleTrovato).safeParse(data);
  if (!esito.success) throw converti(esito.error);
  return esito.data;
}

const SchemaEsitoCheckin = z.object({
  id: z.uuid(),
  scade_il: z.string(),
  destinatari: z.array(z.uuid()),
  esclusi: z.array(z.uuid()),
});
export type EsitoCheckin = z.infer<typeof SchemaEsitoCheckin>;

/** Crea il check-in; chi non è più un amico confermato torna in `esclusi`. */
export async function faiCheckin(dati: {
  locale: string;
  evento: string | null;
  destinatari: string[];
}): Promise<EsitoCheckin> {
  const { data, error } = await supabase().rpc('fai_checkin', {
    locale: dati.locale,
    // La RPC accetta null: il tipo generato non lo dice per gli argomenti uuid.
    evento: dati.evento as string,
    destinatari: dati.destinatari,
  });
  if (error) throw converti(error);
  const esito = SchemaEsitoCheckin.safeParse(data);
  if (!esito.success) throw converti(esito.error);
  return esito.data;
}

/** "Sono andato via": l'ora di fine la scrive il database. */
export async function terminaCheckin(id: string): Promise<void> {
  const { error } = await supabase()
    .from('checkin')
    .update({ terminato_il: new Date().toISOString() })
    .eq('id', id);
  if (error) throw converti(error);
}

/** Toglie un destinatario: il check-in sparisce subito dal suo telefono. */
export async function togliDestinatario(checkin: string, amico: string): Promise<void> {
  const { error } = await supabase()
    .from('checkin_destinatari')
    .delete()
    .eq('checkin_id', checkin)
    .eq('amico_id', amico);
  if (error) throw converti(error);
}
