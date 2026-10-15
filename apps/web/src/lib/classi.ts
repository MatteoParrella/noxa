/** Unisce i nomi di classe validi, ignorando i valori falsi. */
export function classi(...valori: Array<string | false | null | undefined>): string {
  return valori.filter(Boolean).join(' ');
}
