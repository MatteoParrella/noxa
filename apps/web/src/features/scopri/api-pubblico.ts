import { z } from 'zod';
import { SchemaColoriCopertina } from '@/lib/copertinaGenerata';
import { converti } from '@/lib/errori';
import { supabase } from '@/lib/supabase';

/**
 * Elenco delle serate per il sito senza account (ADR-0036). L'unico accesso del ruolo anon è
 * la RPC `cerca_eventi_pubblici`: poche colonne, nessun dato degli utenti; le serate con
 * riferimenti all'alcol arrivano senza titolo né generi (`riservato`, R-23).
 */
const SchemaEventoPubblico = z.object({
  id: z.uuid(),
  riservato: z.boolean(),
  titolo: z.string().nullable(),
  inizio: z.string(),
  fine: z.string().nullable(),
  data_serata: z.string(),
  eta_minima: z.number().int(),
  eta_minima_dichiarata: z.boolean(),
  stato: z.enum(['in_revisione', 'pubblicato', 'rifiutato', 'annullato']),
  generi_evento: z.array(z.string()),
  locale_nome: z.string(),
  locale_comune: z.string(),
  copertina_colori: SchemaColoriCopertina,
});
export type EventoPubblico = z.infer<typeof SchemaEventoPubblico>;

export async function cercaEventiPubblici(dal: string, al: string): Promise<EventoPubblico[]> {
  const { data, error } = await supabase().rpc('cerca_eventi_pubblici', { dal, al });
  if (error) throw converti(error);
  const esito = z.array(SchemaEventoPubblico).safeParse(data);
  if (!esito.success) throw converti(esito.error);
  return esito.data;
}

const SchemaGenere = z.object({ codice: z.string(), nome: z.string() });

export async function leggiGeneriPubblici(): Promise<Record<string, string>> {
  const { data, error } = await supabase().rpc('generi_pubblici');
  if (error) throw converti(error);
  const esito = z.array(SchemaGenere).safeParse(data);
  if (!esito.success) throw converti(esito.error);
  return Object.fromEntries(esito.data.map((genere) => [genere.codice, genere.nome]));
}
