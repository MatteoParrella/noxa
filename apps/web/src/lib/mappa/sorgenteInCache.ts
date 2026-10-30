import { FetchSource, type RangeResponse, type Source } from 'pmtiles';

/**
 * Sorgente PMTiles che conserva nella Cache Storage del browser gli intervalli di byte già
 * scaricati (ADR-0016, ARCHITECTURE.md §5.5): le zone della mappa già viste si riaprono
 * senza rete. Le richieste a intervalli (Range) non passano dal service worker, quindi la cache
 * sta qui. Ogni intervallo è salvato con l'ETag del file: quando la mappa viene aggiornata,
 * PMTiles chiede gli stessi intervalli con il nuovo ETag e la copia vecchia si sostituisce.
 * Nessun dato personale: solo pezzi del file pubblico della mappa.
 */

export const NOME_CACHE = 'noxa-mappa-tile-v1';
/** Circa 2.000 intervalli (tile e indici) bastano per le zone di una città. */
const MASSIMO_VOCI = 2000;
const CONTROLLO_OGNI = 50;

/** Archivio minimo: la Cache Storage nel browser, una mappa in memoria nei test. */
export type ArchivioIntervalli = {
  leggi: (chiave: string) => Promise<{ dati: ArrayBuffer; etag: string | undefined } | null>;
  scrivi: (chiave: string, dati: ArrayBuffer, etag: string | undefined) => Promise<void>;
  conta: () => Promise<number>;
  eliminaPiuVecchie: (quante: number) => Promise<void>;
};

function archivioCacheStorage(): ArchivioIntervalli | null {
  if (typeof caches === 'undefined') return null;
  const apri = () => caches.open(NOME_CACHE);
  return {
    async leggi(chiave) {
      const risposta = await (await apri()).match(chiave);
      if (!risposta) return null;
      return {
        dati: await risposta.arrayBuffer(),
        etag: risposta.headers.get('x-noxa-etag') ?? undefined,
      };
    },
    async scrivi(chiave, dati, etag) {
      const intestazioni = new Headers({ 'Content-Type': 'application/octet-stream' });
      if (etag) intestazioni.set('x-noxa-etag', etag);
      await (await apri()).put(chiave, new Response(dati, { headers: intestazioni }));
    },
    async conta() {
      return (await (await apri()).keys()).length;
    },
    async eliminaPiuVecchie(quante) {
      const cache = await apri();
      // Le chiavi tornano nell'ordine di inserimento: le prime sono le più vecchie.
      for (const richiesta of (await cache.keys()).slice(0, quante)) await cache.delete(richiesta);
    },
  };
}

export class SorgenteInCache implements Source {
  private readonly rete: Source;
  private scritture = 0;

  constructor(
    private readonly url: string,
    private readonly archivio: ArchivioIntervalli | null = archivioCacheStorage(),
    rete?: Source,
  ) {
    this.rete = rete ?? new FetchSource(url);
  }

  getKey(): string {
    return this.url;
  }

  /** Chiave della cache: un URL valido, diverso per ogni intervallo. */
  private chiave(offset: number, length: number): string {
    const separatore = this.url.includes('?') ? '&' : '?';
    return `${this.url}${separatore}noxa-intervallo=${offset}-${length}`;
  }

  async getBytes(
    offset: number,
    length: number,
    signal?: AbortSignal,
    etag?: string,
  ): Promise<RangeResponse> {
    const chiave = this.chiave(offset, length);
    if (this.archivio) {
      try {
        const salvata = await this.archivio.leggi(chiave);
        if (salvata && (!etag || !salvata.etag || salvata.etag === etag)) {
          return { data: salvata.dati, ...(salvata.etag ? { etag: salvata.etag } : {}) };
        }
      } catch {
        // Una cache illeggibile (spazio pieno, modalità privata) non deve fermare la mappa.
      }
    }
    const risposta = await this.rete.getBytes(offset, length, signal, etag);
    if (this.archivio) void this.salva(chiave, risposta);
    return risposta;
  }

  private async salva(chiave: string, risposta: RangeResponse): Promise<void> {
    if (!this.archivio) return;
    try {
      await this.archivio.scrivi(chiave, risposta.data, risposta.etag);
      this.scritture += 1;
      if (this.scritture % CONTROLLO_OGNI === 0) {
        const totale = await this.archivio.conta();
        if (totale > MASSIMO_VOCI) await this.archivio.eliminaPiuVecchie(totale - MASSIMO_VOCI);
      }
    } catch {
      // Senza spazio si continua a usare la rete.
    }
  }
}
