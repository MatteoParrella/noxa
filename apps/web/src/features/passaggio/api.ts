import { z } from 'zod';
import { converti } from '@/lib/errori';
import { supabase } from '@/lib/supabase';

const SchemaServizio = z.object({
  id: z.string().uuid(),
  tipo: z.enum(['mezzi_pubblici', 'taxi', 'app_trasporto']),
  nome: z.string(),
  zona: z.enum(['milano', 'brianza', 'tutte']),
  telefono: z.string().nullable(),
  url: z.string().nullable(),
  nota: z.string().nullable(),
  verificato_il: z.string(),
});

export type ServizioTrasporto = z.infer<typeof SchemaServizio>;
export type TipoServizio = ServizioTrasporto['tipo'];

/**
 * Mezzi notturni, radiotaxi e app di trasporto per tornare senza un passaggio (F-23). Le voci
 * adatte all'età le sceglie il database (R-04): l'app mostra quelle che riceve, in ordine.
 */
export async function leggiServiziTrasporto(): Promise<ServizioTrasporto[]> {
  const { data, error } = await supabase()
    .from('servizi_trasporto')
    .select('id, tipo, nome, zona, telefono, url, nota, verificato_il')
    .order('ordine');
  if (error) throw converti(error);
  const esito = z.array(SchemaServizio).safeParse(data);
  if (!esito.success) throw converti(esito.error);
  return esito.data;
}
