import { verificaLink } from './api';

/**
 * Un token_hash si può usare una sola volta: in sviluppo React esegue due volte gli effetti,
 * quindi la seconda chiamata riusa la prima invece di consumare di nuovo il token.
 */
const inCorso = new Map<string, Promise<void>>();

export function verificaLinkUnaVolta(tokenHash: string, tipo: 'email' | 'recovery'): Promise<void> {
  const chiave = `${tipo}:${tokenHash}`;
  let promessa = inCorso.get(chiave);
  if (!promessa) {
    promessa = verificaLink(tokenHash, tipo);
    inCorso.set(chiave, promessa);
    // Dopo un errore di rete si deve poter riprovare.
    promessa.catch(() => inCorso.delete(chiave));
  }
  return promessa;
}
