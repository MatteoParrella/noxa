import { converti } from '@/lib/errori';
import { supabase } from '@/lib/supabase';

const MAX_BYTES = 2 * 1024 * 1024;
const LATO = 400;

async function ritaglia(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const lato = Math.min(bitmap.width, bitmap.height);
  const ox = (bitmap.width - lato) / 2;
  const oy = (bitmap.height - lato) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = LATO;
  canvas.height = LATO;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d non disponibile');
  ctx.drawImage(bitmap, ox, oy, lato, lato, 0, 0, LATO, LATO);
  bitmap.close();
  return new Promise((risolvi, rifiuta) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          rifiuta(new Error('canvas.toBlob null'));
          return;
        }
        risolvi(new File([blob], 'avatar.webp', { type: 'image/webp' }));
      },
      'image/webp',
      0.9,
    );
  });
}

/** Legge il percorso dell'avatar attuale dell'utente da profili. */
export async function leggiAvatarPath(utenteId: string): Promise<string | null> {
  const { data, error } = await supabase()
    .from('profili')
    .select('avatar_path')
    .eq('id', utenteId)
    .single();
  if (error) throw converti(error);
  return data.avatar_path ?? null;
}

/**
 * Ritaglia al quadrato 400×400 px, converte in WebP (rimuove EXIF via canvas), carica nel
 * bucket avatar e aggiorna profili.avatar_path (R-52). Se vecchioPercorso è fornito, il
 * vecchio file viene rimosso dallo storage dopo il salvataggio.
 */
export async function caricaAvatar(
  utenteId: string,
  file: File,
  vecchioPercorso?: string | null,
): Promise<string> {
  const elaborato = await ritaglia(file);
  if (elaborato.size > MAX_BYTES) {
    const e = Object.assign(new Error('NX030: avatar troppo grande'), { codice: 'troppo_grande' });
    throw e;
  }
  const id = crypto.randomUUID();
  const percorso = `${utenteId}/${id}.webp`;

  const { error: erroreUp } = await supabase()
    .storage.from('avatar')
    .upload(percorso, elaborato, { contentType: 'image/webp', upsert: false });
  if (erroreUp) throw converti(erroreUp);

  const { error: erroreDB } = await supabase()
    .from('profili')
    .update({ avatar_path: percorso })
    .eq('id', utenteId);
  if (erroreDB) {
    void supabase().storage.from('avatar').remove([percorso]);
    throw converti(erroreDB);
  }

  if (vecchioPercorso) {
    void supabase().storage.from('avatar').remove([vecchioPercorso]);
  }

  return percorso;
}

/** Rimuove la foto profilo: azzera profili.avatar_path e cancella il file dallo storage. */
export async function eliminaAvatar(utenteId: string, percorso: string): Promise<void> {
  const { error } = await supabase()
    .from('profili')
    .update({ avatar_path: null })
    .eq('id', utenteId);
  if (error) throw converti(error);
  void supabase().storage.from('avatar').remove([percorso]);
}
