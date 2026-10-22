import { z } from 'zod';
import { converti } from '@/lib/errori';
import { supabase } from '@/lib/supabase';

/**
 * Caricamento e gestione dei flyer dell'utente (F-06, R-51, R-54, R-55).
 * Upload verso storage bucket `flyer-caricati` + riga in `caricamenti_flyer`.
 */

export const STATI_CARICAMENTO = [
  'caricato',
  'in_analisi',
  'in_revisione',
  'approvato',
  'unito',
  'rifiutato',
  'errore',
] as const;
export type StatoCaricamento = (typeof STATI_CARICAMENTO)[number];

const SchemaFlyer = z.object({
  id: z.string().uuid(),
  storage_path: z.string(),
  stato: z.enum(STATI_CARICAMENTO),
  evento_id: z.string().uuid().nullable(),
  motivo_rifiuto: z.string().nullable(),
  creato_il: z.string(),
});
export type Flyer = z.infer<typeof SchemaFlyer>;

/** Rimozione dell'EXIF tramite canvas, che ridisegna il pixel data senza metadati. */
async function rimuoviExif(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas non disponibile');
  ctx.drawImage(img, 0, 0);
  img.close();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('conversione canvas fallita'))),
      'image/jpeg',
      0.92,
    );
  });
}

/**
 * Carica un flyer: rimuove l'EXIF, manda il blob al bucket, inserisce la riga nel DB.
 * Restituisce l'id del caricamento.
 */
export async function caricaFlyer(utenteId: string, file: File): Promise<string> {
  const TIPI_ACCETTATI = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!TIPI_ACCETTATI.has(file.type)) {
    throw Object.assign(new Error('tipo_non_valido'), { codice: 'tipo_non_valido' as const });
  }
  if (file.size > 10 * 1024 * 1024) {
    throw Object.assign(new Error('troppo_grande'), { codice: 'troppo_grande' as const });
  }

  const blob = await rimuoviExif(file);
  const id = crypto.randomUUID();
  const percorso = `${utenteId}/${id}.jpg`;

  const { error: erroreStorage } = await supabase()
    .storage.from('flyer-caricati')
    .upload(percorso, blob, { contentType: 'image/jpeg', upsert: false });
  if (erroreStorage) throw converti(erroreStorage);

  const { error: erroreDb } = await supabase()
    .from('caricamenti_flyer')
    .insert({ id, utente_id: utenteId, storage_path: percorso });
  if (erroreDb) {
    // Pulizia del file se l'insert fallisce.
    void supabase().storage.from('flyer-caricati').remove([percorso]);
    throw converti(erroreDb);
  }

  return id;
}

/** I flyer caricati dall'utente, dal più recente. */
export async function leggiMieiFlyer(): Promise<Flyer[]> {
  const { data, error } = await supabase()
    .from('caricamenti_flyer')
    .select('id, storage_path, stato, evento_id, motivo_rifiuto, creato_il')
    .order('creato_il', { ascending: false });
  if (error) throw converti(error);
  const esito = z.array(SchemaFlyer).safeParse(data);
  if (!esito.success) throw converti(esito.error);
  return esito.data;
}

/** Crea URL firmato valido 1 ora per mostrare un'immagine del bucket privato. */
export async function urlFlyer(percorso: string): Promise<string> {
  const { data, error } = await supabase()
    .storage.from('flyer-caricati')
    .createSignedUrl(percorso, 3600);
  if (error) throw converti(error);
  return data.signedUrl;
}

/** Elimina la richiesta di caricamento (non conservata come prova legale, R-55). */
export async function eliminaFlyer(id: string, percorso: string): Promise<void> {
  const { error } = await supabase().from('caricamenti_flyer').delete().eq('id', id);
  if (error) throw converti(error);
  await supabase().storage.from('flyer-caricati').remove([percorso]);
}
