/**
 * Anteprima di un'immagine scelta dall'utente sul dispositivo: un indirizzo `blob:` creato dal
 * browser per quel file, mai un testo che arriva da fuori. Va liberata con
 * `URL.revokeObjectURL` quando non serve più.
 */
export function anteprimaDelFile(file: Blob): string {
  const indirizzo = URL.createObjectURL(file);
  if (!indirizzo.startsWith('blob:')) {
    URL.revokeObjectURL(indirizzo);
    throw new Error('Anteprima non valida.');
  }
  return indirizzo;
}
