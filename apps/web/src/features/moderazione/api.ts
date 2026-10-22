import { z } from 'zod';
import { converti } from '@/lib/errori';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/lib/database.types';

/**
 * Area di moderazione (F-40, F-44). Ogni lettura e scrittura passa dalla RLS o da RPC che
 * verificano il ruolo e i due fattori nel database (R-06); i dati degli utenti non ci sono
 * (R-69). Le operazioni delicate chiedono una motivazione che resta nel registro.
 */

function verifica<T>(schema: z.ZodType<T>, dati: unknown): T {
  const esito = schema.safeParse(dati);
  if (!esito.success) throw converti(esito.error);
  return esito.data;
}

// ---------------------------------------------------------------------------------------------
// Due fattori e ruolo (R-06)
// ---------------------------------------------------------------------------------------------

export type StatoDueFattori =
  | { stato: 'da_attivare' }
  | { stato: 'da_verificare'; fattoreId: string; verificatoIl: number | null }
  | { stato: 'verificato'; fattoreId: string; verificatoIl: number | null };

/** Durata dell'accesso all'area dopo il codice: poi lo si chiede di nuovo. */
export const DURATA_ACCESSO_MS = 8 * 3600_000;

/** Momento dell'ultimo codice inserito, dal claim `amr` del token di sessione. */
function ultimoCodice(token: string | undefined): number | null {
  const parte = token?.split('.')[1];
  if (!parte) return null;
  try {
    const dati = JSON.parse(atob(parte.replace(/-/g, '+').replace(/_/g, '/'))) as {
      amr?: Array<{ method?: string; timestamp?: number }>;
    };
    const totp = dati.amr?.find((voce) => voce.method === 'totp');
    return totp?.timestamp ? totp.timestamp * 1000 : null;
  } catch {
    return null;
  }
}

export async function leggiStatoDueFattori(): Promise<StatoDueFattori> {
  const client = supabase();
  const [fattori, livello, sessione] = await Promise.all([
    client.auth.mfa.listFactors(),
    client.auth.mfa.getAuthenticatorAssuranceLevel(),
    client.auth.getSession(),
  ]);
  if (fattori.error) throw converti(fattori.error);
  if (livello.error) throw converti(livello.error);
  const fattore = fattori.data.totp.find((voce) => voce.status === 'verified');
  if (!fattore) return { stato: 'da_attivare' };
  const verificatoIl = ultimoCodice(sessione.data.session?.access_token);
  const scaduto = verificatoIl !== null && Date.now() - verificatoIl > DURATA_ACCESSO_MS;
  if (livello.data.currentLevel === 'aal2' && !scaduto) {
    return { stato: 'verificato', fattoreId: fattore.id, verificatoIl };
  }
  return { stato: 'da_verificare', fattoreId: fattore.id, verificatoIl };
}

export type NuovoFattore = { fattoreId: string; qr: string; segreto: string };

/** Attiva i due fattori: un nuovo fattore TOTP da confermare con il primo codice. */
export async function avviaAttivazione(): Promise<NuovoFattore> {
  const client = supabase();
  // Un'attivazione lasciata a metà resta "non verificata": la si sostituisce.
  const fattori = await client.auth.mfa.listFactors();
  if (fattori.error) throw converti(fattori.error);
  for (const vecchio of fattori.data.all.filter((f) => f.status === 'unverified')) {
    await client.auth.mfa.unenroll({ factorId: vecchio.id });
  }
  const { data, error } = await client.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Noxa moderazione',
  });
  if (error) throw converti(error);
  return { fattoreId: data.id, qr: data.totp.qr_code, segreto: data.totp.secret };
}

export async function verificaCodice(fattoreId: string, codice: string): Promise<void> {
  const { error } = await supabase().auth.mfa.challengeAndVerify({
    factorId: fattoreId,
    code: codice,
  });
  if (error) throw converti(error);
}

/** Ruoli di chi usa l'app: si leggono anche senza due fattori (R-06). */
export async function leggiMieiRuoli(utenteId: string): Promise<string[]> {
  const { data, error } = await supabase()
    .from('ruoli_utente')
    .select('ruolo')
    .eq('utente_id', utenteId);
  if (error) throw converti(error);
  return data.map((riga) => riga.ruolo);
}

export async function leggiMioNome(utenteId: string): Promise<string> {
  const { data, error } = await supabase()
    .from('profili')
    .select('nome_visualizzato')
    .eq('id', utenteId)
    .maybeSingle();
  if (error) throw converti(error);
  return data?.nome_visualizzato ?? '';
}

// ---------------------------------------------------------------------------------------------
// Contatori e registro
// ---------------------------------------------------------------------------------------------

const SchemaContatori = z.object({
  duplicati: z.number().int(),
  possibili_annullamenti: z.number().int(),
  candidati_locali: z.number().int(),
  flyer: z.number().int(),
  segnalazioni: z.number().int(),
  segnalazioni_urgenti: z.number().int(),
  scadenza_urgente: z.string().nullable(),
  reclami: z.number().int(),
});
export type Contatori = z.infer<typeof SchemaContatori>;

export async function leggiContatori(): Promise<Contatori> {
  const { data, error } = await supabase().rpc('contatori_moderazione');
  if (error) throw converti(error);
  return verifica(z.array(SchemaContatori).length(1), data)[0]!;
}

const SchemaRegistro = z.object({
  creata_il: z.string(),
  autore: z.string().nullable(),
  azione: z.string(),
  motivazione: z.string().nullable(),
});
export type VoceRegistro = z.infer<typeof SchemaRegistro>;
export type TipoRegistro = 'locale' | 'fonte' | 'evento' | 'candidato_locale';

export async function leggiRegistro(tipo: TipoRegistro, oggetto: string): Promise<VoceRegistro[]> {
  const { data, error } = await supabase().rpc('registro_moderazione', { tipo, oggetto });
  if (error) throw converti(error);
  return verifica(z.array(SchemaRegistro), data);
}

/**
 * Motivazione scritta dal moderatore accanto a una modifica che il database registra da sé
 * (per esempio la disattivazione di un locale).
 */
export async function registraMotivazione(
  tipo: 'locale' | 'fonte',
  oggetto: string,
  motivazione: string,
): Promise<void> {
  const client = supabase();
  const { data } = await client.auth.getUser();
  if (!data.user) throw converti(new Error('sessione assente'));
  const { error } = await client.from('azioni_moderazione').insert({
    moderatore_id: data.user.id,
    tipo_oggetto: tipo,
    oggetto_id: oggetto,
    azione: tipo === 'locale' ? 'modifica_locale' : 'modifica_fonte',
    motivazione,
  });
  if (error) throw converti(error);
}

// ---------------------------------------------------------------------------------------------
// Locali e candidati
// ---------------------------------------------------------------------------------------------

const SchemaProvincia = z.enum(['MI', 'MB']);
export type Provincia = z.infer<typeof SchemaProvincia>;

const SchemaLocaleElenco = z.object({
  id: z.uuid(),
  nome: z.string(),
  comune: z.string(),
  provincia: SchemaProvincia,
  attivo: z.boolean(),
  da_verificare: z.boolean(),
  immagine_path: z.string().nullable(),
  fonti_totali: z.number().int(),
  fonti_attive: z.number().int(),
  eventi_7_giorni: z.number().int(),
  aggiornato_il: z.string(),
});
export type LocaleElenco = z.infer<typeof SchemaLocaleElenco>;

export async function leggiLocali(): Promise<LocaleElenco[]> {
  const { data, error } = await supabase().rpc('locali_moderazione');
  if (error) throw converti(error);
  return verifica(z.array(SchemaLocaleElenco), data);
}

const SchemaFonteImmagine = z.enum(['autorizzazione_locale', 'noxa', 'licenza_libera']);
export type FonteImmagine = z.infer<typeof SchemaFonteImmagine>;

const SchemaLocale = z.object({
  id: z.uuid(),
  nome: z.string(),
  indirizzo: z.string(),
  comune: z.string(),
  provincia: SchemaProvincia,
  lat: z.number(),
  lon: z.number(),
  osm_id: z.string().nullable(),
  google_place_id: z.string().nullable(),
  sito_web: z.string().nullable(),
  instagram_username: z.string().nullable(),
  attivo: z.boolean(),
  immagine_path: z.string().nullable(),
  immagine_fonte: SchemaFonteImmagine.nullable(),
  immagine_attribuzione: z.string().nullable(),
  immagine_riferimento: z.string().nullable(),
  immagine_approvata_da: z.string().nullable(),
  immagine_approvata_il: z.string().nullable(),
  aggiornato_il: z.string(),
});
export type Locale = z.infer<typeof SchemaLocale>;

export async function leggiLocale(id: string): Promise<Locale | null> {
  const { data, error } = await supabase().rpc('locale_moderazione', { locale: id });
  if (error) throw converti(error);
  return verifica(z.array(SchemaLocale), data)[0] ?? null;
}

export type DatiLocale = {
  nome: string;
  indirizzo: string;
  comune: string;
  provincia: Provincia;
  lat: number;
  lon: number;
  sito_web: string | null;
  instagram_username: string | null;
  attivo: boolean;
};

function rigaLocale(dati: DatiLocale) {
  return {
    nome: dati.nome.trim(),
    indirizzo: dati.indirizzo.trim(),
    comune: dati.comune.trim(),
    provincia: dati.provincia,
    posizione: `SRID=4326;POINT(${dati.lon} ${dati.lat})`,
    sito_web: dati.sito_web?.trim() || null,
    instagram_username: dati.instagram_username?.trim().replace(/^@/, '') || null,
    attivo: dati.attivo,
  };
}

/** Crea o modifica un locale; il database registra la modifica nel registro. */
export async function salvaLocale(id: string | null, dati: DatiLocale): Promise<string> {
  const client = supabase();
  if (id) {
    const { error } = await client.from('locali').update(rigaLocale(dati)).eq('id', id);
    if (error) throw converti(error);
    return id;
  }
  const { data, error } = await client
    .from('locali')
    .insert(rigaLocale(dati))
    .select('id')
    .single();
  if (error) throw converti(error);
  return data.id;
}

/**
 * Foto già convertita in WebP sul dispositivo, caricata con un percorso nuovo
 * (`<id>-<versione>.webp`): finché `salvaFotoLocale` non la approva gli utenti non la vedono
 * (R-56). Restituisce il percorso.
 */
export async function caricaFotoLocale(id: string, foto: Blob): Promise<string> {
  const versione = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const percorso = `${id}-${versione}.webp`;
  const { error } = await supabase()
    .storage.from('immagini-locali')
    .upload(percorso, foto, { upsert: false, contentType: 'image/webp', cacheControl: '3600' });
  if (error) throw converti(error);
  return percorso;
}

export type DatiFoto = {
  fonte: FonteImmagine;
  attribuzione: string;
  riferimento: string;
  senzaPersone: boolean;
  senzaAlcol: boolean;
};

/** Approva la foto caricata ed elimina quella che sostituisce. */
export async function salvaFotoLocale(id: string, percorso: string, dati: DatiFoto): Promise<void> {
  const client = supabase();
  const { data: precedente, error } = await client.rpc('salva_foto_locale', {
    locale: id,
    percorso,
    fonte: dati.fonte,
    ...(dati.attribuzione.trim() ? { attribuzione: dati.attribuzione.trim() } : {}),
    ...(dati.riferimento.trim() ? { riferimento: dati.riferimento.trim() } : {}),
    senza_persone: dati.senzaPersone,
    senza_alcol: dati.senzaAlcol,
  });
  if (error) throw converti(error);
  if (typeof precedente === 'string' && precedente) {
    // La foto vecchia non è più leggibile dagli utenti; se l'eliminazione fallisce resta un
    // file orfano, invisibile, che non blocca il salvataggio.
    await client.storage.from('immagini-locali').remove([precedente]);
  }
}

export async function rimuoviFotoLocale(id: string, motivazione: string): Promise<void> {
  const client = supabase();
  const { data: percorso, error } = await client.rpc('rimuovi_foto_locale', {
    locale: id,
    motivazione,
  });
  if (error) throw converti(error);
  // Il file non è più leggibile dagli utenti (la policy richiede la foto approvata); lo si
  // elimina subito.
  if (typeof percorso === 'string' && percorso) {
    const rimozione = await client.storage.from('immagini-locali').remove([percorso]);
    if (rimozione.error) throw converti(rimozione.error);
  }
}

/** URL firmati delle foto dei locali, validi un'ora. */
export async function firmaFoto(percorsi: string[]): Promise<Record<string, string>> {
  if (percorsi.length === 0) return {};
  const { data, error } = await supabase()
    .storage.from('immagini-locali')
    .createSignedUrls(percorsi, 3600);
  if (error) throw converti(error);
  const risultato: Record<string, string> = {};
  for (const voce of data) {
    if (voce.path && voce.signedUrl) risultato[voce.path] = voce.signedUrl;
  }
  return risultato;
}

const SchemaCandidato = z.object({
  id: z.uuid(),
  origine: z.enum(['osm', 'google']),
  osm_id: z.string().nullable(),
  google_place_id: z.string().nullable(),
  nome: z.string().nullable(),
  indirizzo: z.string().nullable(),
  comune: z.string().nullable(),
  provincia: SchemaProvincia.nullable(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  sito_web: z.string().nullable(),
  doppione_id: z.uuid().nullable(),
  doppione_nome: z.string().nullable(),
});
export type Candidato = z.infer<typeof SchemaCandidato>;

export async function leggiCandidati(): Promise<Candidato[]> {
  const { data, error } = await supabase().rpc('candidati_da_verificare');
  if (error) throw converti(error);
  return verifica(z.array(SchemaCandidato), data);
}

export type EsitoCandidato = 'creato' | 'unito' | 'scartato';

export async function decidiCandidato(
  candidato: string,
  esito: EsitoCandidato,
  locale: string | null,
  motivazione: string,
): Promise<void> {
  const { error } = await supabase().rpc('decidi_candidato_locale', {
    candidato,
    esito,
    ...(locale ? { locale } : {}),
    motivazione,
  });
  if (error) throw converti(error);
}

// ---------------------------------------------------------------------------------------------
// Fonti
// ---------------------------------------------------------------------------------------------

const SchemaTipoFonte = z.enum(['sito_locale', 'instagram', 'resident_advisor', 'xceed', 'dice']);
export type TipoFonte = z.infer<typeof SchemaTipoFonte>;
const SchemaConformita = z.enum(['da_verificare', 'consentita', 'vietata']);
export type Conformita = z.infer<typeof SchemaConformita>;
const SchemaRobots = z.enum(['consentito', 'vietato', 'non_applicabile']);
export type EsitoRobots = z.infer<typeof SchemaRobots>;

const SchemaEsito = z
  .object({
    prova: z.boolean().optional(),
    pagine_lette: z.number().int().optional(),
    eventi_letti: z.number().int().optional(),
    eventi_nuovi: z.number().int().optional(),
    eventi_uniti: z.number().int().optional(),
    eventi_in_revisione: z.number().int().optional(),
    eventi_scartati: z.number().int().optional(),
    codice_errore: z.string().nullable().optional(),
  })
  .nullable();
export type EsitoFonte = z.infer<typeof SchemaEsito>;

const SchemaFonte = z.object({
  id: z.uuid(),
  locale_id: z.uuid(),
  tipo: SchemaTipoFonte,
  url: z.string(),
  adattatore: z.string().nullable(),
  frequenza_minuti: z.number().int(),
  pagine_massime: z.number().int(),
  stato_conformita: SchemaConformita,
  robots_esito: SchemaRobots.nullable(),
  termini_url: z.string().nullable(),
  termini_letti_il: z.string().nullable(),
  note_conformita: z.string().nullable(),
  verificata_il: z.string().nullable(),
  attiva: z.boolean(),
  ultima_esecuzione_il: z.string().nullable(),
  ultimo_esito: SchemaEsito,
  errori_consecutivi: z.number().int(),
  esecuzioni_senza_eventi: z.number().int(),
  ultimo_errore: z.string().nullable(),
  disattivata_automaticamente_il: z.string().nullable(),
  locale: z.object({ nome: z.string(), comune: z.string() }),
});
export type Fonte = z.infer<typeof SchemaFonte>;

const COLONNE_FONTE =
  'id, locale_id, tipo, url, adattatore, frequenza_minuti, pagine_massime, stato_conformita, robots_esito, termini_url, termini_letti_il, note_conformita, verificata_il, attiva, ultima_esecuzione_il, ultimo_esito, errori_consecutivi, esecuzioni_senza_eventi, ultimo_errore, disattivata_automaticamente_il, locale:locali!fonti_locale_id_fkey(nome, comune)';

export async function leggiFonti(locale?: string): Promise<Fonte[]> {
  let query = supabase().from('fonti').select(COLONNE_FONTE).order('creato_il');
  if (locale) query = query.eq('locale_id', locale);
  const { data, error } = await query;
  if (error) throw converti(error);
  return verifica(z.array(SchemaFonte), data);
}

export async function leggiFonte(id: string): Promise<Fonte | null> {
  const { data, error } = await supabase()
    .from('fonti')
    .select(COLONNE_FONTE)
    .eq('id', id)
    .maybeSingle();
  if (error) throw converti(error);
  return data ? verifica(SchemaFonte, data) : null;
}

export type DatiFonte = {
  locale_id: string;
  tipo: TipoFonte;
  url: string;
  adattatore: string | null;
  frequenza_minuti: number;
  pagine_massime: number;
  stato_conformita: Conformita;
  robots_esito: EsitoRobots | null;
  termini_url: string | null;
  termini_letti_il: string | null;
  note_conformita: string | null;
};

/** Crea o modifica una fonte; i vincoli di ADR-0008 sono nel database. */
export async function salvaFonte(id: string | null, dati: DatiFonte): Promise<string> {
  const client = supabase();
  if (id) {
    const { error } = await client.from('fonti').update(dati).eq('id', id);
    if (error) throw converti(error);
    return id;
  }
  const { data, error } = await client.from('fonti').insert(dati).select('id').single();
  if (error) throw converti(error);
  return data.id;
}

export async function impostaFonteAttiva(id: string, attiva: boolean): Promise<void> {
  const { error } = await supabase().from('fonti').update({ attiva }).eq('id', id);
  if (error) throw converti(error);
}

export async function segnaFonteVietata(id: string, nota: string): Promise<void> {
  const { error } = await supabase()
    .from('fonti')
    .update({ stato_conformita: 'vietata', attiva: false, note_conformita: nota })
    .eq('id', id);
  if (error) throw converti(error);
}

export async function eseguiOra(id: string): Promise<number> {
  const { data, error } = await supabase().rpc('esegui_fonte_ora', { fonte: id });
  if (error) throw converti(error);
  return verifica(z.number().int(), data);
}

const SchemaEsecuzione = z.object({
  id: z.number().int(),
  prova: z.boolean(),
  iniziata_il: z.string(),
  durata_ms: z.number().int(),
  pagine_lette: z.number().int(),
  eventi_letti: z.number().int(),
  eventi_nuovi: z.number().int(),
  eventi_uniti: z.number().int(),
  eventi_in_revisione: z.number().int(),
  eventi_scartati: z.number().int(),
  codice_errore: z.string().nullable(),
  messaggio_errore: z.string().nullable(),
});
export type Esecuzione = z.infer<typeof SchemaEsecuzione>;

export async function leggiEsecuzioni(fonte: string): Promise<Esecuzione[]> {
  const { data, error } = await supabase()
    .from('esecuzioni_fonte')
    .select(
      'id, prova, iniziata_il, durata_ms, pagine_lette, eventi_letti, eventi_nuovi, eventi_uniti, eventi_in_revisione, eventi_scartati, codice_errore, messaggio_errore',
    )
    .eq('fonte_id', fonte)
    .order('iniziata_il', { ascending: false })
    .limit(20);
  if (error) throw converti(error);
  return verifica(z.array(SchemaEsecuzione), data);
}

// ---------------------------------------------------------------------------------------------
// Duplicati
// ---------------------------------------------------------------------------------------------

const SchemaEventoConfronto = z.object({
  titolo: z.string(),
  locale_nome: z.string().nullish(),
  inizio: z.string(),
  fine: z.string().nullable(),
  eta_minima: z.number().int().nullable(),
  eta_minima_dichiarata: z.boolean().optional(),
  riferimenti_alcol: z.boolean(),
  generi: z.array(z.string()),
  artisti: z.array(z.string()),
  prezzo_min_centesimi: z.number().int().nullable(),
  url: z.string().nullable(),
});
export type EventoConfronto = z.infer<typeof SchemaEventoConfronto>;

const SchemaPayload = z.object({
  titolo: z.string(),
  inizio: z.string(),
  fine: z.string().nullable(),
  eta_minima: z.number().int().nullable(),
  riferimenti_alcol: z.boolean(),
  generi: z.array(z.string()),
  artisti: z.array(z.string()),
  prezzo_min_centesimi: z.number().int().nullable(),
  locale: z.object({ nome: z.string() }),
  origine: z.object({ url: z.string().nullable() }),
});

const SchemaCandidatoDuplicato = SchemaEventoConfronto.extend({ id: z.uuid() });

const SchemaDuplicato = z.object({
  grezzo_id: z.uuid(),
  punteggio: z.number().nullable(),
  nota_revisione: z.string().nullable(),
  creato_il: z.string(),
  payload: SchemaPayload,
  fonte_tipo: SchemaTipoFonte.nullable(),
  fonte_url: z.string().nullable(),
  candidato: SchemaCandidatoDuplicato.nullable(),
});

export type Duplicato = {
  id: string;
  punteggio: number | null;
  motivo: string | null;
  arrivatoIl: string;
  fonte: string | null;
  esistente: (EventoConfronto & { id: string }) | null;
  raccolto: EventoConfronto;
};

export async function leggiDuplicati(): Promise<Duplicato[]> {
  const { data, error } = await supabase().rpc('coda_duplicati');
  if (error) throw converti(error);
  return verifica(z.array(SchemaDuplicato), data).map((riga) => ({
    id: riga.grezzo_id,
    punteggio: riga.punteggio,
    motivo: riga.nota_revisione,
    arrivatoIl: riga.creato_il,
    fonte: riga.fonte_tipo === 'instagram' ? `@${riga.fonte_url ?? ''}` : (riga.fonte_url ?? null),
    esistente: riga.candidato,
    raccolto: {
      titolo: riga.payload.titolo,
      locale_nome: riga.payload.locale.nome,
      inizio: riga.payload.inizio,
      fine: riga.payload.fine,
      eta_minima: riga.payload.eta_minima,
      riferimenti_alcol: riga.payload.riferimenti_alcol,
      generi: riga.payload.generi,
      artisti: riga.payload.artisti,
      prezzo_min_centesimi: riga.payload.prezzo_min_centesimi,
      url: riga.payload.origine.url,
    },
  }));
}

export async function decidiDuplicato(grezzo: string, stessoEvento: boolean): Promise<void> {
  const { error } = await supabase().rpc('decidi_duplicato', {
    grezzo,
    stesso_evento: stessoEvento,
  });
  if (error) throw converti(error);
}

// ---------------------------------------------------------------------------------------------
// Eventi
// ---------------------------------------------------------------------------------------------

const SchemaStatoEvento = z.enum(['in_revisione', 'pubblicato', 'rifiutato', 'annullato']);
export type StatoEvento = z.infer<typeof SchemaStatoEvento>;

const SchemaEventoElenco = z.object({
  id: z.uuid(),
  titolo: z.string(),
  locale_id: z.uuid(),
  locale_nome: z.string(),
  locale_comune: z.string(),
  inizio: z.string(),
  data_serata: z.string(),
  eta_minima: z.number().int(),
  eta_minima_dichiarata: z.boolean(),
  riferimenti_alcol: z.boolean(),
  stato: SchemaStatoEvento,
  fonti: z.number().int(),
});
export type EventoElencoModerazione = z.infer<typeof SchemaEventoElenco>;

export type FiltriEventi = {
  testo: string;
  stati: StatoEvento[];
  dal: string | null;
  al: string | null;
  locale: string | null;
};

export async function leggiEventi(filtri: FiltriEventi): Promise<EventoElencoModerazione[]> {
  const { data, error } = await supabase().rpc('eventi_moderazione', {
    ...(filtri.testo.trim() ? { testo: filtri.testo.trim() } : {}),
    ...(filtri.stati.length > 0 ? { stati: filtri.stati } : {}),
    ...(filtri.dal ? { dal: filtri.dal } : {}),
    ...(filtri.al ? { al: filtri.al } : {}),
    ...(filtri.locale ? { locale: filtri.locale } : {}),
  });
  if (error) throw converti(error);
  return verifica(z.array(SchemaEventoElenco), data);
}

const SchemaEvento = z.object({
  id: z.uuid(),
  titolo: z.string(),
  descrizione: z.string().nullable(),
  inizio: z.string(),
  fine: z.string().nullable(),
  eta_minima: z.number().int(),
  eta_minima_dichiarata: z.boolean(),
  riferimenti_alcol: z.boolean(),
  artisti: z.array(z.string()),
  prezzo_min_centesimi: z.number().int().nullable(),
  url_biglietti: z.string().nullable(),
  stato: SchemaStatoEvento,
  locale_id: z.uuid(),
  generi: z.array(z.object({ genere_codice: z.string() })),
  fonti: z.array(z.object({ tipo_origine: z.string(), url_originale: z.string().nullable() })),
});
export type EventoModerazione = z.infer<typeof SchemaEvento>;

export async function leggiEvento(id: string): Promise<EventoModerazione | null> {
  const { data, error } = await supabase()
    .from('eventi')
    .select(
      'id, titolo, descrizione, inizio, fine, eta_minima, eta_minima_dichiarata, riferimenti_alcol, artisti, prezzo_min_centesimi, url_biglietti, stato, locale_id, generi:eventi_generi(genere_codice), fonti:eventi_fonti(tipo_origine, url_originale)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw converti(error);
  return data ? verifica(SchemaEvento, data) : null;
}

export type DatiEvento = {
  titolo: string;
  descrizione: string | null;
  inizio: string;
  fine: string | null;
  locale_id: string;
  prezzo_min_centesimi: number | null;
  url_biglietti: string | null;
  generi: string[];
};

/** Correzioni ordinarie (il database le registra da sé); età, alcol e stato hanno RPC. */
export async function salvaEvento(id: string, dati: DatiEvento, generiPrima: string[]) {
  const client = supabase();
  const { generi, ...campi } = dati;
  const { error } = await client.from('eventi').update(campi).eq('id', id);
  if (error) throw converti(error);
  const daTogliere = generiPrima.filter((g) => !generi.includes(g));
  const daAggiungere = generi.filter((g) => !generiPrima.includes(g));
  if (daTogliere.length > 0) {
    const rimozione = await client
      .from('eventi_generi')
      .delete()
      .eq('evento_id', id)
      .in('genere_codice', daTogliere);
    if (rimozione.error) throw converti(rimozione.error);
  }
  if (daAggiungere.length > 0) {
    const aggiunta = await client
      .from('eventi_generi')
      .insert(daAggiungere.map((genere_codice) => ({ evento_id: id, genere_codice })));
    if (aggiunta.error) throw converti(aggiunta.error);
  }
}

export async function correggiEtaAlcol(
  id: string,
  dati: { eta: number; dichiarata: boolean; alcol: boolean },
  motivazione: string,
): Promise<void> {
  const { error } = await supabase().rpc('correggi_eta_alcol_evento', {
    evento: id,
    eta_minima: dati.eta,
    eta_minima_dichiarata: dati.dichiarata,
    riferimenti_alcol: dati.alcol,
    motivazione,
  });
  if (error) throw converti(error);
}

export async function cambiaStatoEvento(
  id: string,
  stato: StatoEvento,
  motivazione: string,
): Promise<void> {
  const { error } = await supabase().rpc('cambia_stato_evento', { evento: id, stato, motivazione });
  if (error) throw converti(error);
}

const SchemaAnnullamento = z.object({
  evento_id: z.uuid(),
  titolo: z.string(),
  locale_nome: z.string(),
  locale_comune: z.string(),
  fonte_url: z.string().nullable(),
  inizio: z.string(),
  data_serata: z.string(),
  ultima_conferma_il: z.string(),
  ha_partecipanti: z.boolean(),
});
export type PossibileAnnullamento = z.infer<typeof SchemaAnnullamento>;

export async function leggiPossibiliAnnullamenti(): Promise<PossibileAnnullamento[]> {
  const { data, error } = await supabase().rpc('possibili_annullamenti');
  if (error) throw converti(error);
  return verifica(z.array(SchemaAnnullamento), data);
}

export async function decidiAnnullamento(
  id: string,
  annullato: boolean,
  motivazione: string,
): Promise<void> {
  const { error } = await supabase().rpc('decidi_possibile_annullamento', {
    evento: id,
    annullato,
    motivazione,
  });
  if (error) throw converti(error);
}

const SchemaGenere = z.object({ codice: z.string(), nome: z.string() });
export type Genere = z.infer<typeof SchemaGenere>;

export async function leggiGeneri(): Promise<Genere[]> {
  const { data, error } = await supabase()
    .from('generi_musicali')
    .select('codice, nome')
    .order('nome');
  if (error) throw converti(error);
  return verifica(z.array(SchemaGenere), data);
}

// ---------------------------------------------------------------------------------------------
// Coda dei flyer (R-51, R-69)
// ---------------------------------------------------------------------------------------------

const SchemaCodaFlyer = z.object({
  id: z.uuid(),
  stato: z.enum(['in_revisione', 'errore']),
  creato_il: z.string(),
  storage_path: z.string(),
  risultato_estrazione: z.record(z.string(), z.unknown()).nullable(),
  modello: z.string().nullable(),
  versione_prompt: z.string().nullable(),
  confidenza: z.number().nullable(),
  contenuto_sospetto: z.boolean(),
  nota_revisione: z.string().nullable(),
  evento: z.record(z.string(), z.unknown()).nullable(),
  candidato: z.record(z.string(), z.unknown()).nullable(),
});
export type FlyerCoda = z.infer<typeof SchemaCodaFlyer>;

export async function leggiCodaFlyer(): Promise<FlyerCoda[]> {
  const { data, error } = await supabase().rpc('coda_flyer');
  if (error) throw converti(error);
  return verifica(z.array(SchemaCodaFlyer), data);
}

export async function decidiFlyer(
  caricamentoId: string,
  esito: 'approva' | 'unisci' | 'rifiuta',
  opzioni: { dati?: Record<string, unknown>; motivazione?: string; eventoEsistente?: string },
): Promise<void> {
  const { error } = await supabase().rpc('decidi_flyer', {
    caricamento: caricamentoId,
    esito,
    ...(opzioni.dati !== undefined ? { dati: opzioni.dati as unknown as Json } : {}),
    ...(opzioni.motivazione !== undefined ? { motivazione: opzioni.motivazione } : {}),
    ...(opzioni.eventoEsistente !== undefined ? { evento_esistente: opzioni.eventoEsistente } : {}),
  });
  if (error) throw converti(error);
}

export async function escalationFlyer(caricamentoId: string, motivazione: string): Promise<void> {
  const { error } = await supabase().rpc('escalation_flyer', {
    caricamento: caricamentoId,
    motivazione,
    conferma: 'ESCALATION',
  });
  if (error) throw converti(error);
}

// ---------------------------------------------------------------------------------------------
// Coda delle segnalazioni (R-53, R-69)
// ---------------------------------------------------------------------------------------------

const SchemaCodaSegnalazione = z.object({
  id: z.uuid(),
  tipo_oggetto: z.string(),
  oggetto_id: z.uuid(),
  motivo: z.string(),
  priorita: z.number().int(),
  stato: z.enum(['aperta', 'in_lavorazione', 'chiusa']),
  creata_il: z.string(),
  scadenza: z.string(),
  chiusa_il: z.string().nullable(),
  presa_da_me: z.boolean(),
  presa_da: z.string().nullable(),
  stesso_oggetto: z.number().int(),
  in_escalation: z.boolean(),
});
export type SegnalazioneCoda = z.infer<typeof SchemaCodaSegnalazione>;

export async function leggiCodaSegnalazioni(): Promise<SegnalazioneCoda[]> {
  const { data, error } = await supabase().rpc('coda_segnalazioni');
  if (error) throw converti(error);
  return verifica(z.array(SchemaCodaSegnalazione), data);
}

const SchemaDettaglioSegnalazione = z.object({
  segnalazione_id: z.uuid(),
  tipo_oggetto: z.string(),
  oggetto_id: z.uuid(),
  motivo: z.string(),
  dettagli: z.string().nullable(),
  priorita: z.number().int(),
  stato: z.enum(['aperta', 'in_lavorazione', 'chiusa']),
  creata_il: z.string(),
  scadenza: z.string(),
  presa_da_me: z.boolean(),
  presa_da: z.string().nullable(),
  in_escalation: z.boolean(),
  occultato: z.boolean(),
  oggetto: z.record(z.string(), z.unknown()).nullable(),
  altre: z.array(z.record(z.string(), z.unknown())),
  registro: z.array(z.record(z.string(), z.unknown())),
});
export type DettaglioSegnalazione = z.infer<typeof SchemaDettaglioSegnalazione>;

export async function leggiDettaglioSegnalazione(
  id: string,
): Promise<DettaglioSegnalazione | null> {
  const { data, error } = await supabase().rpc('dettaglio_segnalazione', { id });
  if (error) throw converti(error);
  const righe = verifica(z.array(SchemaDettaglioSegnalazione), data);
  return righe[0] ?? null;
}

export async function prendiInCaricoSegnalazione(id: string): Promise<void> {
  const { error } = await supabase().rpc('prendi_in_carico_segnalazione', { segnalazione: id });
  if (error) throw converti(error);
}

export async function decidiSegnalazione(
  id: string,
  azione: 'nessuna_violazione' | 'rimuovi_contenuto' | 'modifica_evento' | 'sospendi_account',
  motivazione: string,
  contenuto?: string,
): Promise<void> {
  const { error } = await supabase().rpc('decidi_segnalazione', {
    segnalazione: id,
    azione,
    motivazione,
    ...(contenuto !== undefined ? { contenuto } : {}),
  });
  if (error) throw converti(error);
}

export async function escalationSegnalazione(id: string, motivazione: string): Promise<void> {
  const { error } = await supabase().rpc('escalation_segnalazione', {
    segnalazione: id,
    motivazione,
    conferma: 'ESCALATION',
  });
  if (error) throw converti(error);
}

// ---------------------------------------------------------------------------------------------
// Reclami (DSA art. 20)
// ---------------------------------------------------------------------------------------------

const SchemaReclamoModerazione = z.object({
  id: z.uuid(),
  stato: z.enum(['inviato', 'in_esame', 'deciso']),
  testo: z.string(),
  creato_il: z.string(),
  ruolo: z.string().nullable(),
  decisione_id: z.uuid(),
  decisione_azione: z.string(),
  decisione_motivazione: z.string().nullable(),
  decisione_il: z.string(),
  decisione_autore: z.string().nullable(),
  tipo_oggetto: z.string(),
  descrizione: z.string().nullable(),
  puo_decidere: z.boolean(),
  esito: z.string().nullable(),
  motivazione_esito: z.string().nullable(),
  deciso_il: z.string().nullable(),
});
export type ReclamoModerazione = z.infer<typeof SchemaReclamoModerazione>;

export async function leggiReclamiModerazione(): Promise<ReclamoModerazione[]> {
  const { data, error } = await supabase().rpc('reclami_moderazione');
  if (error) throw converti(error);
  return verifica(z.array(SchemaReclamoModerazione), data);
}

export async function esamiReclamo(reclamoId: string): Promise<void> {
  const { error } = await supabase().rpc('esamina_reclamo', { reclamo: reclamoId });
  if (error) throw converti(error);
}

export async function decidiReclamo(
  reclamoId: string,
  cambia: boolean,
  motivazione: string,
): Promise<void> {
  const { error } = await supabase().rpc('decidi_reclamo', {
    reclamo: reclamoId,
    cambia,
    motivazione,
  });
  if (error) throw converti(error);
}
