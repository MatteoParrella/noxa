import { z } from 'zod';
import { converti } from '@/lib/errori';
import { supabase } from '@/lib/supabase';

/**
 * Amicizie, codici invito, blocchi e segnalazioni (F-11, F-12, F-42). Le regole stanno nel
 * database (R-10…R-17, R-50): qui solo chiamate e conversione degli errori.
 */

const SchemaPersona = z.object({
  id: z.uuid(),
  username: z.string(),
  nome_visualizzato: z.string(),
});
export type Persona = z.infer<typeof SchemaPersona>;

const SchemaAmicizia = z.object({
  id: z.uuid(),
  stato: z.enum(['in_attesa', 'accettata']),
  canale: z.enum(['ricerca', 'codice_invito']),
  creata_il: z.string(),
  richiedente_id: z.uuid(),
  destinatario_id: z.uuid(),
  // Null se il profilo non è più visibile (account sospeso): la riga si ignora.
  richiedente: SchemaPersona.nullable(),
  destinatario: SchemaPersona.nullable(),
});

export type Relazione = {
  amiciziaId: string;
  persona: Persona;
  canale: 'ricerca' | 'codice_invito';
};

export type ElencoAmici = {
  amici: Relazione[];
  ricevute: Relazione[];
  inviate: Relazione[];
};

const PROFILO = 'id, username, nome_visualizzato';

export async function leggiAmici(io: string): Promise<ElencoAmici> {
  const { data, error } = await supabase()
    .from('amicizie')
    .select(
      `id, stato, canale, creata_il, richiedente_id, destinatario_id,
       richiedente:profili!amicizie_richiedente_id_fkey(${PROFILO}),
       destinatario:profili!amicizie_destinatario_id_fkey(${PROFILO})`,
    )
    .order('creata_il', { ascending: false });
  if (error) throw converti(error);
  const righe = z.array(SchemaAmicizia).safeParse(data);
  if (!righe.success) throw converti(righe.error);

  const elenco: ElencoAmici = { amici: [], ricevute: [], inviate: [] };
  for (const riga of righe.data) {
    const inviataDaMe = riga.richiedente_id === io;
    const persona = inviataDaMe ? riga.destinatario : riga.richiedente;
    if (!persona) continue;
    const relazione = { amiciziaId: riga.id, persona, canale: riga.canale };
    if (riga.stato === 'accettata') elenco.amici.push(relazione);
    else if (inviataDaMe) elenco.inviate.push(relazione);
    else elenco.ricevute.push(relazione);
  }
  elenco.amici.sort((a, b) =>
    a.persona.nome_visualizzato.localeCompare(b.persona.nome_visualizzato, 'it'),
  );
  return elenco;
}

const SchemaRisultato = SchemaPersona.extend({
  relazione: z.enum(['nessuna', 'amici', 'inviata', 'ricevuta']),
});
export type RisultatoRicerca = z.infer<typeof SchemaRisultato>;

/** Ricerca per prefisso nella propria fascia (R-10): il database applica tutti i filtri. */
export async function cercaUtenti(testo: string): Promise<RisultatoRicerca[]> {
  const { data, error } = await supabase().rpc('cerca_utenti', { testo });
  if (error) throw converti(error);
  const esito = z.array(SchemaRisultato).safeParse(data);
  if (!esito.success) throw converti(esito.error);
  return esito.data;
}

export async function inviaRichiesta(io: string, destinatario: string): Promise<void> {
  const { error } = await supabase()
    .from('amicizie')
    .insert({ richiedente_id: io, destinatario_id: destinatario, canale: 'ricerca' });
  if (error) throw converti(error);
}

export async function accettaRichiesta(amiciziaId: string): Promise<void> {
  const { error } = await supabase()
    .from('amicizie')
    .update({ stato: 'accettata' })
    .eq('id', amiciziaId);
  if (error) throw converti(error);
}

/** Rifiuta, annulla o rimuove: per il database sono la stessa cancellazione. */
export async function eliminaAmicizia(amiciziaId: string): Promise<void> {
  const { error } = await supabase().from('amicizie').delete().eq('id', amiciziaId);
  if (error) throw converti(error);
}

/** Avviso al minorenne prima di accettare una richiesta da una persona maggiorenne (R-12). */
export async function avvisoRichiesta(amiciziaId: string): Promise<boolean> {
  const { data, error } = await supabase().rpc('avviso_richiesta', { amicizia: amiciziaId });
  if (error) throw converti(error);
  return data === true;
}

const SchemaCodice = z.object({ codice: z.string(), scade_il: z.string() });
export type CodiceInvito = z.infer<typeof SchemaCodice>;

export async function creaCodice(): Promise<CodiceInvito> {
  const { data, error } = await supabase().rpc('crea_codice_invito');
  if (error) throw converti(error);
  const esito = z.array(SchemaCodice).length(1).safeParse(data);
  if (!esito.success) throw converti(esito.error);
  return esito.data[0]!;
}

const SchemaAnteprima = z.object({
  stato: z.enum(['valido', 'scaduto', 'usato', 'non_valido', 'gia_amici', 'in_attesa']),
  titolare_id: z.uuid().nullable(),
  username: z.string().nullable(),
  nome_visualizzato: z.string().nullable(),
  avviso_fasce: z.boolean(),
});
export type AnteprimaCodice = z.infer<typeof SchemaAnteprima>;

export async function anteprimaCodice(codice: string): Promise<AnteprimaCodice> {
  const { data, error } = await supabase().rpc('anteprima_codice_invito', { codice });
  if (error) throw converti(error);
  const esito = z.array(SchemaAnteprima).length(1).safeParse(data);
  if (!esito.success) throw converti(esito.error);
  return esito.data[0]!;
}

export async function usaCodice(codice: string): Promise<void> {
  const { error } = await supabase().rpc('usa_codice_invito', { codice });
  if (error) throw converti(error);
}

export type ProfiloPersona = {
  persona: Persona;
  relazione:
    | { tipo: 'nessuna' }
    | { tipo: 'amici'; amiciziaId: string }
    | { tipo: 'inviata'; amiciziaId: string }
    | { tipo: 'ricevuta'; amiciziaId: string; canale: 'ricerca' | 'codice_invito' };
};

/**
 * Profilo di un'altra persona, se la RLS lo lascia vedere (R-10, R-13, R-17); null per tutti
 * i casi in cui non si può vedere, senza distinguerli.
 */
export async function leggiPersona(io: string, id: string): Promise<ProfiloPersona | null> {
  const client = supabase();
  const { data, error } = await client.from('profili').select(PROFILO).eq('id', id).maybeSingle();
  if (error) throw converti(error);
  if (!data || id === io) return null;
  const persona = SchemaPersona.parse(data);

  const { data: amicizie, error: erroreAmicizie } = await client
    .from('amicizie')
    .select('id, stato, canale, richiedente_id')
    .or(`richiedente_id.eq.${id},destinatario_id.eq.${id}`)
    .limit(1);
  if (erroreAmicizie) throw converti(erroreAmicizie);
  const riga = amicizie?.[0];
  if (!riga) return { persona, relazione: { tipo: 'nessuna' } };
  if (riga.stato === 'accettata')
    return { persona, relazione: { tipo: 'amici', amiciziaId: riga.id } };
  if (riga.richiedente_id === io)
    return { persona, relazione: { tipo: 'inviata', amiciziaId: riga.id } };
  return { persona, relazione: { tipo: 'ricevuta', amiciziaId: riga.id, canale: riga.canale } };
}

export async function blocca(io: string, altro: string): Promise<void> {
  const { error } = await supabase()
    .from('blocchi')
    .insert({ bloccante_id: io, bloccato_id: altro });
  if (error) throw converti(error);
}

export async function sblocca(io: string, altro: string): Promise<void> {
  const { error } = await supabase()
    .from('blocchi')
    .delete()
    .eq('bloccante_id', io)
    .eq('bloccato_id', altro);
  if (error) throw converti(error);
}

const SchemaBloccato = SchemaPersona.extend({ bloccato_il: z.string() });
export type Bloccato = z.infer<typeof SchemaBloccato>;

export async function mieiBloccati(): Promise<Bloccato[]> {
  const { data, error } = await supabase().rpc('miei_bloccati');
  if (error) throw converti(error);
  const esito = z.array(SchemaBloccato).safeParse(data);
  if (!esito.success) throw converti(esito.error);
  return esito.data;
}

export type MotivoSegnalazione =
  | 'contenuto_inappropriato'
  | 'molestie'
  | 'adescamento_o_rischio_minore'
  | 'spam'
  | 'eta_errata'
  | 'altro';

export async function segnalaProfilo(dati: {
  io: string;
  profilo: string;
  motivo: MotivoSegnalazione;
  dettagli: string;
}): Promise<void> {
  const dettagli = dati.dettagli.trim();
  const { error } = await supabase()
    .from('segnalazioni')
    .insert({
      segnalante_id: dati.io,
      tipo_oggetto: 'profilo',
      oggetto_id: dati.profilo,
      motivo: dati.motivo,
      dettagli: dettagli === '' ? null : dettagli,
    });
  if (error) throw converti(error);
}

const SchemaSegnalazione = z.object({
  id: z.uuid(),
  tipo_oggetto: z.string(),
  descrizione: z.string().nullable(),
  motivo: z.string(),
  stato: z.enum(['aperta', 'in_lavorazione', 'chiusa']),
  creata_il: z.string(),
  chiusa_il: z.string().nullable(),
  decisione: z.string().nullable(),
  decisa_il: z.string().nullable(),
});
export type MiaSegnalazione = z.infer<typeof SchemaSegnalazione>;

export async function mieSegnalazioni(): Promise<MiaSegnalazione[]> {
  const { data, error } = await supabase().rpc('mie_segnalazioni');
  if (error) throw converti(error);
  const esito = z.array(SchemaSegnalazione).safeParse(data);
  if (!esito.success) throw converti(esito.error);
  return esito.data;
}

export async function aggiornaProfilo(
  io: string,
  dati: { nomeVisualizzato: string; username: string },
): Promise<void> {
  const { error } = await supabase()
    .from('profili')
    .update({ nome_visualizzato: dati.nomeVisualizzato.trim(), username: dati.username })
    .eq('id', io);
  if (error) throw converti(error);
}
