import { supabase } from './supabase';

/**
 * Avvisi senza dati su un canale Broadcast privato (DATA_MODEL.md §7): la policy di
 * `realtime.messages` decide chi ascolta; chi riceve un avviso ricarica con le RPC, soggette
 * alla RLS. Restituisce la funzione che chiude il canale.
 */
export function ascoltaAvvisi(argomento: string, onAvviso: () => void): () => void {
  const client = supabase();
  const canale = client
    .channel(argomento, { config: { private: true } })
    .on('broadcast', { event: 'cambio' }, onAvviso);
  let chiuso = false;
  // Il token deve arrivare a Realtime prima dell'ingresso in un canale privato.
  void client.realtime.setAuth().then(() => {
    if (!chiuso) canale.subscribe();
  });
  return () => {
    chiuso = true;
    void client.removeChannel(canale);
  };
}
