import { z } from 'zod';
import { converti } from '@/lib/errori';
import { supabase } from '@/lib/supabase';

/**
 * Notifiche dell'app (F-06, F-11, F-12, F-40): lettura e aggiornamento letta_il.
 * Le righe sono scritte solo dal database (trigger e funzioni security definer).
 */

export const TIPI_NOTIFICA = [
  'richiesta_amicizia',
  'amicizia_accettata',
  'invito_gruppo',
  'nuova_serata',
  'aggiornamento_serata',
  'checkin_amico',
  'ritorno_avviato',
  'ritorno_allerta',
  'ritorno_arrivato',
  'esito_moderazione',
  'rimozione_gruppo',
  'badge_ottenuto',
  'riepilogo_pronto',
] as const;
export type TipoNotifica = (typeof TIPI_NOTIFICA)[number];

const SchemaNotifica = z.object({
  id: z.string().uuid(),
  tipo: z.enum(TIPI_NOTIFICA),
  dati: z.record(z.string(), z.unknown()),
  letta_il: z.string().nullable(),
  creata_il: z.string(),
});
export type Notifica = z.infer<typeof SchemaNotifica>;

/** Ultime 100 notifiche dell'utente, dalla più recente. */
export async function leggiNotifiche(): Promise<Notifica[]> {
  const { data, error } = await supabase()
    .from('notifiche')
    .select('id, tipo, dati, letta_il, creata_il')
    .order('creata_il', { ascending: false })
    .limit(100);
  if (error) throw converti(error);
  const esito = z.array(SchemaNotifica).safeParse(data);
  if (!esito.success) throw converti(esito.error);
  return esito.data;
}

/** Segna come lette tutte le notifiche non ancora lette dell'utente. */
export async function segnaLetteTutte(): Promise<void> {
  const { error } = await supabase()
    .from('notifiche')
    .update({ letta_il: new Date().toISOString() })
    .is('letta_il', null);
  if (error) throw converti(error);
}
