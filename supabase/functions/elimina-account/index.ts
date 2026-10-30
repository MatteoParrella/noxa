// Edge Function `elimina-account` (R-64, ADR-0025): elimina l'account di chi chiama.
//
// 1. Con il JWT dell'utente chiama la RPC `elimina_mio_account(password)`, che verifica
//    password e due fattori, conserva l'identità solo in caso di escalation (R-55) ed elimina
//    l'utente: la cascata del database cancella tutti i dati dell'account.
// 2. Con la chiave service_role, usata solo qui e solo per questo, cancella subito i file della
//    foto profilo restituiti dalla RPC. Se lo storage non risponde, il job pulizia_flyer li
//    elimina comunque entro un giorno (private.immagini_da_eliminare).
//
// I log contengono solo l'esito, mai identificativi, email o password (R-62).
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

type Esito = 'eliminato' | 'password_errata' | 'serve_codice';

const ORIGINI = (Deno.env.get('NOXA_ORIGINI_APP') ?? '')
  .split(',')
  .map((origine) => origine.trim())
  .filter(Boolean);

function intestazioni(richiesta: Request): Record<string, string> {
  const origine = richiesta.headers.get('Origin') ?? '';
  // Senza elenco (in locale) si risponde a qualsiasi origine: la richiesta vale solo con il
  // JWT dell'utente, mai con i cookie.
  const consentita = ORIGINI.length === 0 || ORIGINI.includes(origine) ? origine || '*' : 'null';
  return {
    'Access-Control-Allow-Origin': consentita,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
}

function risposta(richiesta: Request, stato: number, corpo: Record<string, unknown>): Response {
  return new Response(JSON.stringify(corpo), { status: stato, headers: intestazioni(richiesta) });
}

function registra(evento: string, dati: Record<string, string | number> = {}): void {
  console.log(JSON.stringify({ funzione: 'elimina-account', evento, ...dati }));
}

Deno.serve(async (richiesta) => {
  if (richiesta.method === 'OPTIONS') return new Response(null, { headers: intestazioni(richiesta) });
  if (richiesta.method !== 'POST') return risposta(richiesta, 405, { errore: 'metodo_non_ammesso' });

  const autorizzazione = richiesta.headers.get('Authorization');
  if (!autorizzazione?.startsWith('Bearer ')) {
    return risposta(richiesta, 401, { errore: 'accesso_richiesto' });
  }

  let password: unknown;
  try {
    ({ password } = (await richiesta.json()) as { password?: unknown });
  } catch {
    return risposta(richiesta, 400, { errore: 'richiesta_non_valida' });
  }
  if (typeof password !== 'string' || password.length === 0 || password.length > 200) {
    return risposta(richiesta, 400, { errore: 'richiesta_non_valida' });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const chiaveAnon = Deno.env.get('SUPABASE_ANON_KEY');
  const chiaveServizio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !chiaveAnon || !chiaveServizio) {
    registra('configurazione_mancante');
    return risposta(richiesta, 500, { errore: 'non_riuscita' });
  }

  const comeUtente = createClient(url, chiaveAnon, {
    global: { headers: { Authorization: autorizzazione } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await comeUtente.rpc('elimina_mio_account', { password });
  if (error) {
    if (error.code === 'NX048') {
      registra('troppi_tentativi');
      return risposta(richiesta, 429, { errore: 'troppi_tentativi', codice: 'NX048' });
    }
    if (error.code === '42501' || error.code === 'PGRST301') {
      return risposta(richiesta, 401, { errore: 'accesso_richiesto' });
    }
    registra('errore_database', { codice: error.code ?? 'sconosciuto' });
    return risposta(richiesta, 500, { errore: 'non_riuscita' });
  }

  const esito = (data as { esito?: Esito; file_avatar?: string[] } | null) ?? {};
  if (esito.esito !== 'eliminato') {
    registra('non_eliminato', { esito: esito.esito ?? 'sconosciuto' });
    return risposta(richiesta, 200, { esito: esito.esito ?? 'password_errata' });
  }

  const file = esito.file_avatar ?? [];
  if (file.length > 0) {
    const comeServizio = createClient(url, chiaveServizio, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: erroreStorage } = await comeServizio.storage.from('avatar').remove(file);
    if (erroreStorage) registra('file_non_eliminati', { numero: file.length });
  }
  registra('eliminato', { file: file.length });
  return risposta(richiesta, 200, { esito: 'eliminato' });
});
