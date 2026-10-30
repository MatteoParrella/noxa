import { z } from 'zod';
import { converti } from '@/lib/errori';
import { supabase } from '@/lib/supabase';

/**
 * Diario delle serate (F-30). Le regole stanno nel database: privato per il titolare,
 * alcolici solo per i maggiorenni (R-40), eventi solo se visibili (R-20, R-23), amici solo
 * confermati. Qui solo chiamate, validazione con Zod e conversione degli errori.
 */

export const CATEGORIE = [
  'ingresso',
  'prevendita',
  'trasporto',
  'cibo',
  'bevande_analcoliche',
  'alcolici',
  'guardaroba',
  'altro',
] as const;
const Categoria = z.enum(CATEGORIE);
export type CategoriaSpesa = z.infer<typeof Categoria>;

const SchemaPersona = z.object({
  id: z.uuid(),
  username: z.string(),
  nome_visualizzato: z.string(),
  avatar_path: z.string().nullable(),
});
export type PersonaDiario = z.infer<typeof SchemaPersona>;

const SchemaSpesa = z.object({
  categoria: Categoria,
  importo_centesimi: z.number().int().min(1).max(100_000),
});
export type Spesa = z.infer<typeof SchemaSpesa>;

const SchemaEventoDiario = z.object({
  id: z.uuid(),
  titolo: z.string(),
  inizio: z.string(),
  stato: z.string(),
});
export type EventoDiario = z.infer<typeof SchemaEventoDiario>;

const SchemaLocaleDiario = z.object({ id: z.uuid(), nome: z.string(), comune: z.string() });
export type LocaleDiario = z.infer<typeof SchemaLocaleDiario>;

export const SchemaVoce = z.object({
  id: z.uuid(),
  data_serata: z.string(),
  evento: SchemaEventoDiario.nullable(),
  locale: SchemaLocaleDiario.nullable(),
  nome_locale_libero: z.string().nullable(),
  voto: z.number().int().min(1).max(5).nullable(),
  note: z.string().nullable(),
  spese: z.array(SchemaSpesa),
  dj: z.array(z.string()),
  amici: z.array(SchemaPersona),
  amici_altri: z.number().int(),
  creato_il: z.string(),
  aggiornato_il: z.string(),
});
/** Una serata del diario come la restituisce `mio_diario()`. */
export type Voce = z.infer<typeof SchemaVoce>;

/**
 * Dati che si salvano: è anche il formato delle voci in coda offline. Gli identificativi di
 * evento, locale e amici sono quelli scelti; la visibilità la controlla il database.
 */
export const SchemaSalvataggio = z.object({
  id: z.uuid(),
  data_serata: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  evento_id: z.uuid().nullable(),
  locale_id: z.uuid().nullable(),
  nome_locale_libero: z.string().max(80).nullable(),
  voto: z.number().int().min(1).max(5).nullable(),
  note: z.string().max(1000).nullable(),
  spese: z.array(SchemaSpesa).max(8),
  dj: z.array(z.string().min(1).max(80)).max(20),
  amici: z.array(z.uuid()).max(30),
});
export type Salvataggio = z.infer<typeof SchemaSalvataggio>;

function valida<T>(schema: z.ZodType<T>, dati: unknown): T {
  const esito = schema.safeParse(dati);
  if (!esito.success) throw converti(esito.error);
  return esito.data;
}

export async function leggiDiario(): Promise<Voce[]> {
  const { data, error } = await supabase().rpc('mio_diario');
  if (error) throw converti(error);
  return valida(z.array(SchemaVoce), data);
}

export async function salvaSerata(serata: Salvataggio): Promise<void> {
  const { error } = await supabase().rpc('salva_serata_diario', { serata });
  if (error) throw converti(error);
}

/** Eliminare una serata già eliminata non è un errore: la coda offline può ripeterlo. */
export async function eliminaSerata(id: string): Promise<void> {
  const { error } = await supabase().from('serate_tracker').delete().eq('id', id);
  if (error) throw converti(error);
}

export async function categorieDisponibili(): Promise<CategoriaSpesa[]> {
  const { data, error } = await supabase().rpc('categorie_spesa_disponibili');
  if (error) throw converti(error);
  return valida(z.array(Categoria), data);
}

const SchemaRisultato = z.object({
  tipo: z.enum(['evento', 'locale']),
  id: z.uuid(),
  titolo: z.string(),
  data_serata: z.string().nullable(),
  inizio: z.string().nullable(),
  locale_id: z.uuid(),
  locale_nome: z.string(),
  comune: z.string(),
});
export type RisultatoDove = z.infer<typeof SchemaRisultato>;

export async function cercaDove(testo: string): Promise<RisultatoDove[]> {
  const { data, error } = await supabase().rpc('cerca_per_diario', { testo });
  if (error) throw converti(error);
  return valida(z.array(SchemaRisultato), data);
}
