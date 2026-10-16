import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { leggiAmbiente } from './ambiente';
import type { Database } from './database.types';

export type ClientNoxa = SupabaseClient<Database>;

/** Chiave della sessione nel localStorage del dispositivo. */
export const CHIAVE_SESSIONE = 'noxa-sessione';

let client: ClientNoxa | undefined;

/**
 * Client Supabase con la sola chiave pubblica: ogni accesso ai dati passa dalla RLS
 * (ADR-0002). Si crea alla prima chiamata, nel browser: l'export statico non lo usa mai
 * durante la build.
 */
export function supabase(): ClientNoxa {
  if (!client) {
    const { supabaseUrl, supabaseChiaveAnon } = leggiAmbiente();
    client = createClient<Database>(supabaseUrl, supabaseChiaveAnon, {
      auth: {
        storageKey: CHIAVE_SESSIONE,
        persistSession: true,
        autoRefreshToken: true,
        // I link delle email arrivano con token_hash e li verifica la pagina che li riceve.
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
