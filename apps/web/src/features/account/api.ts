import { converti } from '@/lib/errori';
import { supabase } from '@/lib/supabase';
import { PERCORSI, VERSIONI_DOCUMENTI } from './documenti';
import { SchemaAccount, type Account, type DocumentoDaAccettare } from './schemi';

/**
 * Chiamate a Supabase Auth e al database per l'account (F-10, F-41). Ogni funzione lancia
 * solo errori di dominio (src/lib/errori.ts).
 */

/** Indirizzo assoluto di una pagina dell'app, usato nei link delle email. */
function indirizzo(percorso: string): string {
  return new URL(percorso, window.location.origin).toString();
}

function captcha(token: string | null): { captchaToken?: string } {
  return token ? { captchaToken: token } : {};
}

export type DatiRegistrazione = {
  email: string;
  password: string;
  username: string;
  nomeVisualizzato: string;
  /** AAAA-MM-GG */
  dataNascita: string;
  tokenVerificaUmana: string | null;
};

/** Codici di Supabase Auth per un'email già registrata. */
const EMAIL_GIA_REGISTRATA = new Set(['user_already_exists', 'email_exists']);

/**
 * Registrazione: i dati del profilo viaggiano nei metadati e il database li verifica
 * (hook e trigger, R-01), crea profilo e consensi e li toglie dai metadati (R-05).
 * Un'email già registrata riceve la stessa risposta di una registrazione riuscita: la
 * schermata non rivela chi ha un account (come il recupero della password). Nessun secondo
 * account viene creato.
 */
export async function registra(dati: DatiRegistrazione): Promise<void> {
  const { error } = await supabase().auth.signUp({
    email: dati.email,
    password: dati.password,
    options: {
      emailRedirectTo: indirizzo(PERCORSI.conferma),
      data: {
        username: dati.username,
        nome_visualizzato: dati.nomeVisualizzato,
        data_nascita: dati.dataNascita,
        consensi: VERSIONI_DOCUMENTI,
      },
      ...captcha(dati.tokenVerificaUmana),
    },
  });
  if (error && !(error.code && EMAIL_GIA_REGISTRATA.has(error.code))) throw converti(error);
}

export async function reinviaVerifica(email: string, token: string | null): Promise<void> {
  const { error } = await supabase().auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: indirizzo(PERCORSI.conferma), ...captcha(token) },
  });
  if (error) throw converti(error);
}

/** Verifica il link dell'email (token_hash), che funziona anche su un altro dispositivo. */
export async function verificaLink(tokenHash: string, tipo: 'email' | 'recovery'): Promise<void> {
  const { error } = await supabase().auth.verifyOtp({ token_hash: tokenHash, type: tipo });
  if (error) throw converti(error);
}

export async function accedi(email: string, password: string, token: string | null): Promise<void> {
  const { error } = await supabase().auth.signInWithPassword({
    email,
    password,
    options: captcha(token),
  });
  if (error) throw converti(error);
}

/** La risposta è la stessa che l'account esista o no: Supabase non lo rivela. */
export async function richiediRecupero(email: string, token: string | null): Promise<void> {
  const { error } = await supabase().auth.resetPasswordForEmail(email, {
    redirectTo: indirizzo(PERCORSI.nuovaPassword),
    ...captcha(token),
  });
  if (error) throw converti(error);
}

/** Nuova password, poi uscita da tutti gli altri dispositivi (design/F-10-accesso). */
export async function impostaNuovaPassword(password: string): Promise<void> {
  const client = supabase();
  const { error } = await client.auth.updateUser({ password });
  if (error) throw converti(error);
  const { error: erroreUscita } = await client.auth.signOut({ scope: 'others' });
  if (erroreUscita) throw converti(erroreUscita);
}

export async function esci(): Promise<void> {
  const { error } = await supabase().auth.signOut();
  if (error) throw converti(error);
}

export async function leggiMioAccount(): Promise<Account | null> {
  const { data, error } = await supabase().rpc('mio_account');
  if (error) throw converti(error);
  if (data === null) return null;
  const esito = SchemaAccount.safeParse(data);
  if (!esito.success) throw converti(esito.error);
  return esito.data;
}

export async function completaOnboarding(utenteId: string): Promise<void> {
  const { error } = await supabase()
    .from('profili_privati')
    .update({ onboarding_completato_il: new Date().toISOString() })
    .eq('utente_id', utenteId);
  if (error) throw converti(error);
}

/** Consenso alle versioni in vigore; il database accetta solo quelle (R-63). */
export async function accettaDocumenti(
  utenteId: string,
  documenti: readonly DocumentoDaAccettare[],
): Promise<void> {
  const { error } = await supabase()
    .from('consensi')
    .insert(
      documenti.map((documento) => ({
        utente_id: utenteId,
        tipo: documento.tipo,
        versione: documento.versione,
      })),
    );
  if (error) throw converti(error);
}
