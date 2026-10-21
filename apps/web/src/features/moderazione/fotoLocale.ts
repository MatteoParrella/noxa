/**
 * Conversione della foto di un locale sul dispositivo (ADR-0018, R-56): ritaglio centrato
 * 16:10 come nella scheda in evidenza di Scopri, WebP fino a 1 MB. Ridisegnare l'immagine su
 * una tela toglie i dati EXIF (posizione, dispositivo, data).
 */

export const TIPI_AMMESSI = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PESO_MASSIMO = 1024 * 1024;
const LARGHEZZA = 1600;
const ALTEZZA = 1000;

export type FotoConvertita = {
  blob: Blob;
  larghezza: number;
  altezza: number;
  /** Peso della prima conversione, se superava 1 MB ed è stata ridotta. */
  pesoPrimaDellaRiduzione: number | null;
};

export class ErroreFoto extends Error {
  constructor(readonly motivo: 'formato' | 'illeggibile') {
    super(motivo);
  }
}

export function formatoAmmesso(file: File): boolean {
  return (TIPI_AMMESSI as readonly string[]).includes(file.type);
}

function tela(larghezza: number, altezza: number): HTMLCanvasElement {
  const elemento = document.createElement('canvas');
  elemento.width = larghezza;
  elemento.height = altezza;
  return elemento;
}

function comeBlob(elemento: HTMLCanvasElement, qualita: number): Promise<Blob> {
  return new Promise((risolvi, rifiuta) => {
    elemento.toBlob(
      (blob) => (blob ? risolvi(blob) : rifiuta(new ErroreFoto('illeggibile'))),
      'image/webp',
      qualita,
    );
  });
}

export async function convertiFoto(file: File): Promise<FotoConvertita> {
  if (!formatoAmmesso(file)) throw new ErroreFoto('formato');
  let immagine: ImageBitmap;
  try {
    immagine = await createImageBitmap(file);
  } catch {
    throw new ErroreFoto('illeggibile');
  }
  // Ritaglio centrato 16:10, senza ingrandire le foto piccole.
  const rapporto = LARGHEZZA / ALTEZZA;
  const larghezzaTaglio = Math.min(immagine.width, immagine.height * rapporto);
  const altezzaTaglio = larghezzaTaglio / rapporto;
  const x = (immagine.width - larghezzaTaglio) / 2;
  const y = (immagine.height - altezzaTaglio) / 2;
  let larghezza = Math.round(Math.min(LARGHEZZA, larghezzaTaglio));
  let altezza = Math.round(larghezza / rapporto);

  let pesoPrima: number | null = null;
  let qualita = 0.86;
  for (let tentativo = 0; tentativo < 6; tentativo += 1) {
    const elemento = tela(larghezza, altezza);
    const contesto = elemento.getContext('2d');
    if (!contesto) throw new ErroreFoto('illeggibile');
    contesto.drawImage(immagine, x, y, larghezzaTaglio, altezzaTaglio, 0, 0, larghezza, altezza);
    const blob = await comeBlob(elemento, qualita);
    if (blob.size <= PESO_MASSIMO) {
      immagine.close();
      return { blob, larghezza, altezza, pesoPrimaDellaRiduzione: pesoPrima };
    }
    pesoPrima ??= blob.size;
    // Oltre 1 MB: prima si abbassa la qualità, poi la risoluzione.
    if (qualita > 0.7) qualita -= 0.08;
    else {
      larghezza = Math.round(larghezza * 0.85);
      altezza = Math.round(larghezza / rapporto);
    }
  }
  immagine.close();
  throw new ErroreFoto('illeggibile');
}

export function peso(byte: number): string {
  if (byte >= 1024 * 1024) {
    return `${(byte / (1024 * 1024)).toLocaleString('it-IT', { maximumFractionDigits: 1 })} MB`;
  }
  return `${Math.round(byte / 1024)} KB`;
}
