import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { svuotaCoda } from '@/features/ricorda/coda';
import { cancellaCacheLocale } from '@/lib/cacheLocale';
import { ErroreLimite, ErroreRete, ErroreSconosciuto, converti } from '@/lib/errori';
import { registraErrore } from '@/lib/registro';
import { supabase } from '@/lib/supabase';

/**
 * Privacy e dati (F-41, F-42): impostazione delle partecipazioni (R-67), esportazione dei
 * propri dati ed eliminazione dell'account (R-64, ADR-0025). Le regole stanno nel database:
 * una esportazione all'ora, password e due fattori per eliminare.
 */

export async function salvaPartecipazioniVisibili(io: string, visibili: boolean): Promise<void> {
  const { error } = await supabase()
    .from('profili_privati')
    .update({ partecipazioni_visibili: visibili })
    .eq('utente_id', io);
  if (error) throw converti(error);
}

export type Esportazione =
  { stato: 'pronto'; contenuto: string; byte: number } | { stato: 'limite'; prossima: Date };

/** Prepara il file JSON dei propri dati, oppure dice quando si potrà richiedere di nuovo. */
export async function esportaDati(): Promise<Esportazione> {
  const { data, error } = await supabase().rpc('esporta_miei_dati');
  if (error) {
    if (error.code === 'NX047') {
      const prossima = new Date(error.details ?? '');
      return {
        stato: 'limite',
        prossima: Number.isNaN(prossima.getTime()) ? new Date(Date.now() + 3600_000) : prossima,
      };
    }
    throw converti(error);
  }
  const contenuto = JSON.stringify(data, null, 2);
  return { stato: 'pronto', contenuto, byte: new Blob([contenuto]).size };
}

/** Identificativo del fattore TOTP verificato, se l'account ha i due fattori. */
export async function fattoreDueFattori(): Promise<string | null> {
  const { data, error } = await supabase().auth.mfa.listFactors();
  if (error) throw converti(error);
  return data.totp.find((fattore) => fattore.status === 'verified')?.id ?? null;
}

export type EsitoEliminazione = 'eliminato' | 'password_errata' | 'serve_codice';

/**
 * Elimina l'account con l'Edge Function `elimina-account`. Con i due fattori la sessione
 * passa prima a aal2 con il codice; la password la verifica il database.
 */
export async function eliminaAccount(dati: {
  password: string;
  codice?: string;
  fattoreId?: string;
}): Promise<EsitoEliminazione> {
  const client = supabase();
  if (dati.codice && dati.fattoreId) {
    const { error } = await client.auth.mfa.challengeAndVerify({
      factorId: dati.fattoreId,
      code: dati.codice,
    });
    if (error) throw converti(error);
  }
  const { data, error } = await client.functions.invoke<{ esito?: EsitoEliminazione }>(
    'elimina-account',
    { body: { password: dati.password } },
  );
  if (error) {
    if (error instanceof FunctionsFetchError) throw new ErroreRete('funzione', error);
    if (error instanceof FunctionsHttpError) {
      const risposta = error.context as Response;
      if (risposta.status === 429) throw new ErroreLimite('tentativi', error);
    }
    throw new ErroreSconosciuto('elimina-account', error);
  }
  const esito = data?.esito;
  if (esito === 'eliminato' || esito === 'password_errata' || esito === 'serve_codice')
    return esito;
  throw new ErroreSconosciuto('elimina-account', data);
}

/**
 * Dopo l'eliminazione: niente resta sul dispositivo. La sessione si chiude solo qui, perché
 * sul server non esiste più.
 */
export async function pulisciDispositivo(io: string): Promise<void> {
  try {
    await Promise.all([cancellaCacheLocale(), svuotaCoda(io)]);
  } catch (errore) {
    registraErrore('pulizia del dispositivo', errore);
  }
  await supabase().auth.signOut({ scope: 'local' });
}
