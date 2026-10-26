import { z } from 'zod';
import { converti } from '@/lib/errori';
import { supabase } from '@/lib/supabase';

/**
 * Gruppi, inviti e serate di gruppo (F-13…F-16). Le regole stanno nel database (R-11, R-15,
 * R-16, R-17, R-24): qui solo chiamate, validazione con Zod e conversione degli errori.
 */

const SchemaPersona = z.object({
  id: z.uuid(),
  username: z.string(),
  nome_visualizzato: z.string(),
  avatar_path: z.string().nullable(),
});
export type PersonaGruppo = z.infer<typeof SchemaPersona>;

const Ruolo = z.enum(['admin', 'membro']);
const StatoMembro = z.enum(['invitato', 'attivo']);
const StatoSerata = z.enum(['proposta', 'confermata', 'annullata']);
const Risposta = z.enum(['si', 'forse', 'no']);
const Biglietto = z.enum(['nessuno', 'prevendita', 'lista', 'alla_cassa']);
const Mezzo = z.enum(['auto_guido', 'passaggio', 'mezzi_pubblici', 'taxi_ncc', 'a_piedi', 'altro']);

export type RuoloGruppo = z.infer<typeof Ruolo>;
export type StatoSerata = z.infer<typeof StatoSerata>;
export type RispostaSerata = z.infer<typeof Risposta>;
export type StatoBiglietto = z.infer<typeof Biglietto>;
export type MezzoTrasporto = z.infer<typeof Mezzo>;

function valida<T>(schema: z.ZodType<T>, dati: unknown): T {
  const esito = schema.safeParse(dati);
  if (!esito.success) throw converti(esito.error);
  return esito.data;
}

// ---------------------------------------------------------------------------------------------
// Gruppi
// ---------------------------------------------------------------------------------------------

const SchemaGruppoElenco = z.object({
  id: z.uuid(),
  nome: z.string(),
  mio_ruolo: Ruolo,
  mio_stato: StatoMembro,
  membri: z.number().int().nullable(),
  primi: z.array(SchemaPersona),
  invitato_da: SchemaPersona.nullable(),
  prossima: z
    .object({ id: z.uuid(), data_serata: z.string(), titolo: z.string().nullable() })
    .nullable(),
});
export type GruppoElenco = z.infer<typeof SchemaGruppoElenco>;

export async function mieiGruppi(): Promise<GruppoElenco[]> {
  const { data, error } = await supabase().rpc('miei_gruppi');
  if (error) throw converti(error);
  return valida(z.array(SchemaGruppoElenco), data);
}

const SchemaSerataRiga = z.object({
  id: z.uuid(),
  titolo: z.string().nullable(),
  data_serata: z.string(),
  ora_ritrovo: z.string().nullable(),
  stato: StatoSerata,
  locale_nome: z.string().nullable(),
  locale_comune: z.string().nullable(),
  passata: z.boolean(),
  si: z.number().int(),
  forse: z.number().int(),
  mia_risposta: Risposta.nullable(),
});
export type SerataRiga = z.infer<typeof SchemaSerataRiga>;

const SchemaMembro = SchemaPersona.extend({ ruolo: Ruolo, stato: StatoMembro });
export type Membro = z.infer<typeof SchemaMembro>;

const SchemaDettaglioGruppo = z.object({
  id: z.uuid(),
  nome: z.string(),
  mio_ruolo: Ruolo,
  creato_da: SchemaPersona.nullable(),
  membri_totale: z.number().int(),
  membri: z.array(SchemaMembro),
  altri: z.number().int(),
  serate: z.array(SchemaSerataRiga),
});
export type DettaglioGruppo = z.infer<typeof SchemaDettaglioGruppo>;

/** Dettaglio per un membro attivo; null se non si fa più parte del gruppo (o non esiste). */
export async function dettaglioGruppo(gruppo: string): Promise<DettaglioGruppo | null> {
  const { data, error } = await supabase().rpc('dettaglio_gruppo', { gruppo });
  if (error) throw converti(error);
  const righe = valida(z.array(SchemaDettaglioGruppo), data);
  return righe[0] ?? null;
}

const SchemaAnteprima = z.object({
  stato: z.enum(['valido', 'non_valido']),
  nome: z.string().nullable(),
  invitato_da: SchemaPersona.nullable(),
  membri: z.number().int().nullable(),
  conosciuti: z.array(SchemaPersona),
  altri: z.number().int().nullable(),
});
export type AnteprimaInvito = z.infer<typeof SchemaAnteprima>;

export async function anteprimaInvito(gruppo: string): Promise<AnteprimaInvito> {
  const { data, error } = await supabase().rpc('anteprima_invito_gruppo', { gruppo });
  if (error) throw converti(error);
  const righe = valida(z.array(SchemaAnteprima).length(1), data);
  return righe[0]!;
}

const SchemaInvitabile = SchemaPersona.extend({
  motivo: z
    .enum(['gia_nel_gruppo', 'invito_in_attesa', 'non_disponibile', 'fasce', 'pieno'])
    .nullable(),
});
export type AmicoInvitabile = z.infer<typeof SchemaInvitabile>;

/** Amici con il motivo per cui non si possono invitare, dati il gruppo e i già selezionati (R-15). */
export async function amiciInvitabili(
  gruppo: string | null,
  selezionati: readonly string[],
): Promise<AmicoInvitabile[]> {
  const { data, error } = await supabase().rpc('amici_invitabili', {
    ...(gruppo ? { gruppo } : {}),
    selezionati: [...selezionati],
  });
  if (error) throw converti(error);
  return valida(z.array(SchemaInvitabile), data);
}

export async function creaGruppo(nome: string, invitati: readonly string[]): Promise<string> {
  const { data, error } = await supabase().rpc('crea_gruppo', {
    nome: nome.trim(),
    invitati: [...invitati],
  });
  if (error) throw converti(error);
  return valida(z.uuid(), data);
}

export async function invitaNelGruppo(
  gruppo: string,
  invitati: readonly string[],
): Promise<number> {
  const { data, error } = await supabase().rpc('invita_nel_gruppo', {
    gruppo,
    invitati: [...invitati],
  });
  if (error) throw converti(error);
  return valida(z.number().int(), data);
}

/** L'invitato accetta (R-11): il database ricontrolla l'invariante delle fasce (R-15). */
export async function accettaInvito(io: string, gruppo: string): Promise<void> {
  const { error } = await supabase()
    .from('membri_gruppo')
    .update({ stato: 'attivo' })
    .eq('gruppo_id', gruppo)
    .eq('utente_id', io);
  if (error) throw converti(error);
}

/** Rifiuta un invito, esce dal gruppo o (se admin) toglie un membro: è sempre una cancellazione. */
export async function togliDalGruppo(gruppo: string, utente: string): Promise<void> {
  const { error } = await supabase()
    .from('membri_gruppo')
    .delete()
    .eq('gruppo_id', gruppo)
    .eq('utente_id', utente);
  if (error) throw converti(error);
}

export async function cambiaRuolo(
  gruppo: string,
  utente: string,
  ruolo: RuoloGruppo,
): Promise<void> {
  const { error } = await supabase()
    .from('membri_gruppo')
    .update({ ruolo })
    .eq('gruppo_id', gruppo)
    .eq('utente_id', utente);
  if (error) throw converti(error);
}

export async function rinominaGruppo(gruppo: string, nome: string): Promise<void> {
  const { error } = await supabase().from('gruppi').update({ nome: nome.trim() }).eq('id', gruppo);
  if (error) throw converti(error);
}

export async function eliminaGruppo(gruppo: string): Promise<void> {
  const { error } = await supabase().from('gruppi').delete().eq('id', gruppo);
  if (error) throw converti(error);
}

// ---------------------------------------------------------------------------------------------
// Serate
// ---------------------------------------------------------------------------------------------

const SchemaProssima = z.object({
  id: z.uuid(),
  gruppo_id: z.uuid(),
  gruppo_nome: z.string(),
  titolo: z.string().nullable(),
  data_serata: z.string(),
  ora_ritrovo: z.string().nullable(),
  stato: StatoSerata,
  mia_risposta: Risposta.nullable(),
});
export type SerataProssima = z.infer<typeof SchemaProssima>;

export async function prossimeSerate(): Promise<SerataProssima[]> {
  const { data, error } = await supabase().rpc('prossime_serate');
  if (error) throw converti(error);
  return valida(z.array(SchemaProssima), data);
}

const TipoCopertina = z.enum(['locale', 'flyer', 'tipografica', 'sostitutiva']);

const SchemaEventoAdatto = z.object({
  id: z.uuid(),
  titolo: z.string(),
  inizio: z.string(),
  fine: z.string().nullable(),
  data_serata: z.string(),
  eta_minima: z.number().int(),
  eta_minima_dichiarata: z.boolean(),
  locale_nome: z.string(),
  locale_comune: z.string(),
  url_biglietti: z.string().nullable(),
  copertina_tipo: TipoCopertina,
  copertina_path: z.string().nullable(),
  copertina_attribuzione: z.string().nullable(),
});
export type EventoAdatto = z.infer<typeof SchemaEventoAdatto>;

/** Solo eventi visibili a tutti i membri attivi del gruppo (R-24). */
export async function eventiAdatti(gruppo: string, testo: string): Promise<EventoAdatto[]> {
  const { data, error } = await supabase().rpc('eventi_adatti_al_gruppo', {
    gruppo,
    ...(testo.trim() ? { testo: testo.trim() } : {}),
  });
  if (error) throw converti(error);
  return valida(z.array(SchemaEventoAdatto), data);
}

export type NuovaSerata = {
  gruppo: string;
  evento: string | null;
  titolo: string;
  /** AAAA-MM-GG; con un evento la data la prende il database dall'evento. */
  data: string;
  ora: string;
  luogo: string;
  urlPrevendita: string;
  urlLista: string;
  note: string;
};

const vuotoANull = (testo: string) => (testo.trim() === '' ? null : testo.trim());

export async function proponiSerata(io: string, serata: NuovaSerata): Promise<string> {
  const { data, error } = await supabase()
    .from('serate_gruppo')
    .insert({
      gruppo_id: serata.gruppo,
      evento_id: serata.evento,
      titolo: serata.evento ? null : vuotoANull(serata.titolo),
      data_serata: serata.data,
      ora_ritrovo: vuotoANull(serata.ora),
      luogo_ritrovo: vuotoANull(serata.luogo),
      url_prevendita: vuotoANull(serata.urlPrevendita),
      url_lista: vuotoANull(serata.urlLista),
      note: vuotoANull(serata.note),
      creata_da: io,
    })
    .select('id')
    .single();
  if (error) throw converti(error);
  return valida(z.object({ id: z.uuid() }), data).id;
}

const SchemaPartecipante = SchemaPersona.extend({
  io: z.boolean(),
  risposta: Risposta.nullable(),
  biglietto: Biglietto.nullable(),
  trasporto_andata: Mezzo.nullable(),
  trasporto_ritorno: Mezzo.nullable(),
  posti_liberi: z.number().int().nullable(),
  passaggio_da: z.uuid().nullable(),
  aggiornato_il: z.string().nullable(),
});
export type Partecipante = z.infer<typeof SchemaPartecipante>;

const SchemaDettaglioSerata = z.object({
  id: z.uuid(),
  gruppo_id: z.uuid(),
  gruppo_nome: z.string(),
  titolo: z.string().nullable(),
  data_serata: z.string(),
  ora_ritrovo: z.string().nullable(),
  luogo_ritrovo: z.string().nullable(),
  url_prevendita: z.string().nullable(),
  url_lista: z.string().nullable(),
  note: z.string().nullable(),
  stato: StatoSerata,
  creata_da: SchemaPersona.nullable(),
  posso_gestire: z.boolean(),
  posso_guidare: z.boolean(),
  passata: z.boolean(),
  evento: z
    .object({
      id: z.uuid(),
      titolo: z.string(),
      inizio: z.string(),
      fine: z.string().nullable(),
      eta_minima: z.number().int(),
      eta_minima_dichiarata: z.boolean(),
      stato: z.string(),
      locale_nome: z.string(),
      locale_comune: z.string(),
      copertina_tipo: TipoCopertina,
      copertina_path: z.string().nullable(),
      copertina_attribuzione: z.string().nullable(),
    })
    .nullable(),
  partecipanti: z.array(SchemaPartecipante),
  altri: z.number().int(),
});
export type DettaglioSerata = z.infer<typeof SchemaDettaglioSerata>;

/** Dettaglio di una serata; null se non è (più) visibile, senza dire perché (R-24). */
export async function dettaglioSerata(serata: string): Promise<DettaglioSerata | null> {
  const { data, error } = await supabase().rpc('dettaglio_serata', { serata });
  if (error) throw converti(error);
  const righe = valida(z.array(SchemaDettaglioSerata), data);
  return righe[0] ?? null;
}

export type MiaPartecipazione = {
  risposta: RispostaSerata;
  biglietto: StatoBiglietto;
  trasporto_andata: MezzoTrasporto | null;
  trasporto_ritorno: MezzoTrasporto | null;
  posti_liberi: number | null;
  passaggio_da: string | null;
};

/** Salva la propria risposta con biglietto e trasporto (F-14, F-15, F-16). */
export async function salvaPartecipazione(
  io: string,
  serata: string,
  dati: MiaPartecipazione,
): Promise<void> {
  const { error } = await supabase()
    .from('partecipazioni_serata')
    .upsert({ serata_id: serata, utente_id: io, ...dati }, { onConflict: 'serata_id,utente_id' });
  if (error) throw converti(error);
}

export async function cambiaStatoSerata(
  serata: string,
  stato: 'confermata' | 'annullata',
): Promise<void> {
  const { error } = await supabase().from('serate_gruppo').update({ stato }).eq('id', serata);
  if (error) throw converti(error);
}

export type TipoSegnalabile = 'gruppo' | 'serata_gruppo';

export type MotivoSegnalazioneTesto =
  'contenuto_inappropriato' | 'molestie' | 'adescamento_o_rischio_minore' | 'spam' | 'altro';

/** Segnala il nome del gruppo o i testi della serata (R-16, R-50). */
export async function segnalaTesto(dati: {
  io: string;
  tipo: TipoSegnalabile;
  oggetto: string;
  motivo: MotivoSegnalazioneTesto;
  dettagli: string;
}): Promise<void> {
  const dettagli = dati.dettagli.trim();
  const { error } = await supabase()
    .from('segnalazioni')
    .insert({
      segnalante_id: dati.io,
      tipo_oggetto: dati.tipo,
      oggetto_id: dati.oggetto,
      motivo: dati.motivo,
      dettagli: dettagli === '' ? null : dettagli,
    });
  if (error) throw converti(error);
}
