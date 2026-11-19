import { z } from 'zod';
import { converti } from '@/lib/errori';
import { supabase } from '@/lib/supabase';
import { CATEGORIE, valida } from './api';

/**
 * Statistiche (F-31), badge (F-32) e riepilogo annuale (F-33). Tutto si calcola nel database
 * dai dati del diario: qui solo chiamate, validazione con Zod e conversione degli errori.
 * Solo il titolare vede questi dati (R-69); i badge per soli maggiorenni non arrivano ai
 * minorenni (R-41); il riepilogo non contiene altri utenti né spese (R-42, R-43).
 */

// ---------------------------------------------------------------------------------------------
// Statistiche
// ---------------------------------------------------------------------------------------------
const SchemaConteggio = z.object({ nome: z.string(), serate: z.number().int() });
export type Conteggio = z.infer<typeof SchemaConteggio>;

export const SchemaStatistiche = z.object({
  anno: z.number().int().nullable(),
  serate: z.number().int(),
  per_mese: z.array(z.number().int()).length(12).nullable(),
  per_anno: z.array(z.object({ anno: z.number().int(), serate: z.number().int() })).nullable(),
  locali: z.array(SchemaConteggio),
  generi: z.array(SchemaConteggio.extend({ codice: z.string() })),
  dj: z.array(SchemaConteggio),
  spese: z.object({
    totale_centesimi: z.number().int(),
    per_categoria: z.array(
      z.object({ categoria: z.enum(CATEGORIE), importo_centesimi: z.number().int() }),
    ),
  }),
});
export type Statistiche = z.infer<typeof SchemaStatistiche>;

/** `anno` null: tutte le serate, con il conteggio per anno. */
export async function leggiStatistiche(anno: number | null): Promise<Statistiche> {
  const { data, error } = await supabase().rpc('mie_statistiche', anno === null ? {} : { anno });
  if (error) throw converti(error);
  return valida(SchemaStatistiche, data);
}

// ---------------------------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------------------------
export const TIPI_CRITERIO = [
  'serate',
  'locali_diversi',
  'generi_diversi',
  'dj_diversi',
  'serate_con_note',
  'quattro_stagioni',
  'stesso_locale',
  'serate_con_amici',
] as const;
export type TipoCriterio = (typeof TIPI_CRITERIO)[number];

const SchemaBadge = z.object({
  codice: z.string(),
  nome: z.string(),
  descrizione: z.string(),
  criterio: z.object({ tipo: z.enum(TIPI_CRITERIO), soglia: z.number().int() }),
  ordine: z.number().int(),
});

export type BadgeBacheca = z.infer<typeof SchemaBadge> & { ottenutoIl: string | null };

/** Catalogo visibile a chi chiama con la data di ottenimento, nell'ordine del catalogo. */
export async function leggiBadge(): Promise<BadgeBacheca[]> {
  const client = supabase();
  const [catalogo, miei] = await Promise.all([
    client
      .from('badge')
      .select('codice, nome, descrizione, criterio, ordine')
      .order('ordine', { ascending: true }),
    client.from('badge_utente').select('badge_codice, ottenuto_il'),
  ]);
  if (catalogo.error) throw converti(catalogo.error);
  if (miei.error) throw converti(miei.error);
  const badge = valida(z.array(SchemaBadge), catalogo.data);
  const ottenuti = new Map(
    valida(z.array(z.object({ badge_codice: z.string(), ottenuto_il: z.string() })), miei.data).map(
      (riga) => [riga.badge_codice, riga.ottenuto_il],
    ),
  );
  return badge.map((b) => ({ ...b, ottenutoIl: ottenuti.get(b.codice) ?? null }));
}

// ---------------------------------------------------------------------------------------------
// Riepilogo annuale
// ---------------------------------------------------------------------------------------------
export const SchemaDatiRiepilogo = z.object({
  anno: z.number().int(),
  serate: z.number().int(),
  per_mese: z.array(z.number().int()).length(12),
  mese_top: z.object({ mese: z.number().int().min(1).max(12), serate: z.number().int() }),
  locali_diversi: z.number().int(),
  locali_top: z.array(SchemaConteggio),
  genere_top: SchemaConteggio.extend({ codice: z.string() }).nullable(),
  dj_top: z.array(SchemaConteggio),
  serate_con_amici: z.number().int(),
  amici_diversi: z.number().int(),
  badge: z.array(z.string()),
  voto_top: z
    .object({ data_serata: z.string(), locale: z.string().nullable(), voto: z.number().int() })
    .nullable(),
});
export type DatiRiepilogo = z.infer<typeof SchemaDatiRiepilogo>;

const SchemaRiepilogo = z.object({
  anno: z.number().int(),
  dati: SchemaDatiRiepilogo,
  generato_il: z.string(),
});
export type Riepilogo = z.infer<typeof SchemaRiepilogo>;

/** I propri riepiloghi, dal più recente. */
export async function leggiRiepiloghi(): Promise<Riepilogo[]> {
  const { data, error } = await supabase()
    .from('riepiloghi_annuali')
    .select('anno, dati, generato_il')
    .order('anno', { ascending: false });
  if (error) throw converti(error);
  return valida(z.array(SchemaRiepilogo), data);
}

/**
 * Aggiorna il riepilogo dell'anno (dal 1° dicembre al 31 gennaio, una volta al giorno):
 * null se le serate dell'anno sono meno di 3.
 */
export async function aggiornaRiepilogo(): Promise<DatiRiepilogo | null> {
  const { data, error } = await supabase().rpc('rigenera_mio_riepilogo');
  if (error) throw converti(error);
  return valida(SchemaDatiRiepilogo.nullable(), data);
}
