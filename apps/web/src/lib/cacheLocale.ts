import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Query } from '@tanstack/react-query';
import { createStore, del, get, set, type UseStore } from 'idb-keyval';

/**
 * Dati in sola lettura salvati in IndexedDB per l'uso offline (ARCHITECTURE.md §5.5): eventi
 * già visti, serate di gruppo proprie, diario e amici (per indicarli nel diario). Restano solo
 * sul dispositivo, al massimo 7 giorni, e si cancellano all'uscita dall'account e alla sua
 * eliminazione. Le copertine (link firmati che scadono) non si salvano.
 */

const PREFISSI_SALVATI = new Set(['eventi', 'gruppi', 'diario', 'relazioni']);
export const DURATA_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

let store: UseStore | undefined;
function negozio(): UseStore {
  store ??= createStore('noxa-cache', 'query');
  return store;
}

export const persistenza = createAsyncStoragePersister({
  key: 'noxa-query',
  storage: {
    getItem: (chiave) => get<string>(chiave, negozio()).then((valore) => valore ?? null),
    setItem: (chiave, valore: string) => set(chiave, valore, negozio()),
    removeItem: (chiave) => del(chiave, negozio()),
  },
  throttleTime: 2000,
});

/** Solo le letture riuscite delle aree previste; la coda del diario ha il suo archivio. */
export function daSalvare(query: Query): boolean {
  const [prefisso, sotto] = query.queryKey;
  if (query.state.status !== 'success' || typeof prefisso !== 'string') return false;
  if (!PREFISSI_SALVATI.has(prefisso)) return false;
  if (prefisso === 'diario' && sotto === 'coda') return false;
  if (prefisso === 'relazioni' && sotto !== 'amici') return false;
  return true;
}

/** Cancella la cache salvata sul dispositivo (uscita o eliminazione dell'account). */
export async function cancellaCacheLocale(): Promise<void> {
  await persistenza.removeClient();
}
