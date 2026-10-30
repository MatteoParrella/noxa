import { createStore, del, get, set, type UseStore } from 'idb-keyval';
import { z } from 'zod';
import { ErroreRete, converti } from '@/lib/errori';
import { registraErrore } from '@/lib/registro';
import { SchemaSalvataggio, SchemaVoce, type Salvataggio, type Voce } from './api';

/**
 * Coda delle scritture del diario fatte senza rete (ARCHITECTURE.md §5.5, PRD §5 Offline).
 * Ogni serata ha al massimo un'operazione in attesa, l'ultima: un salvataggio (con l'anteprima
 * da mostrare nel diario) oppure un'eliminazione. La coda è per utente, sul solo dispositivo,
 * e si cancella all'uscita dall'account e all'eliminazione dell'account.
 */

const SchemaOperazione = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('salva'),
    id: z.uuid(),
    dati: SchemaSalvataggio,
    anteprima: SchemaVoce,
    modificata_il: z.string(),
    errore: z.boolean(),
  }),
  z.object({
    tipo: z.literal('elimina'),
    id: z.uuid(),
    modificata_il: z.string(),
    errore: z.boolean(),
  }),
]);
export type Operazione = z.infer<typeof SchemaOperazione>;

/** Archivio chiave-valore: IndexedDB nell'app, in memoria nei test. */
export type Archivio = {
  leggi: (chiave: string) => Promise<unknown>;
  scrivi: (chiave: string, valore: unknown) => Promise<void>;
  elimina: (chiave: string) => Promise<void>;
};

let store: UseStore | undefined;
function negozio(): UseStore {
  store ??= createStore('noxa-diario', 'coda');
  return store;
}

export const archivioIndexedDb: Archivio = {
  leggi: (chiave) => get(chiave, negozio()),
  scrivi: (chiave, valore) => set(chiave, valore, negozio()),
  elimina: (chiave) => del(chiave, negozio()),
};

const chiave = (io: string) => `coda:${io}`;

export async function leggiCoda(io: string, archivio: Archivio = archivioIndexedDb) {
  const grezza = await archivio.leggi(chiave(io));
  const esito = z.array(SchemaOperazione).safeParse(grezza ?? []);
  // Una coda illeggibile (versione vecchia o dati corrotti) non deve bloccare il diario.
  if (!esito.success) {
    registraErrore('coda del diario non leggibile', esito.error);
    return [];
  }
  return esito.data;
}

async function scriviCoda(io: string, coda: Operazione[], archivio: Archivio) {
  if (coda.length === 0) await archivio.elimina(chiave(io));
  else await archivio.scrivi(chiave(io), coda);
}

/**
 * Mette in coda un'operazione: sostituisce quella in attesa per la stessa serata. Con
 * `soloLocale` l'eliminazione riguarda una serata mai arrivata al server, che quindi sparisce
 * dalla coda senza partire.
 */
export async function accoda(
  io: string,
  operazione: Operazione,
  opzioni: { soloLocale?: boolean } = {},
  archivio: Archivio = archivioIndexedDb,
): Promise<void> {
  const coda = await leggiCoda(io, archivio);
  const altre = coda.filter((op) => op.id !== operazione.id);
  if (operazione.tipo === 'elimina' && opzioni.soloLocale) {
    await scriviCoda(io, altre, archivio);
    return;
  }
  await scriviCoda(io, [...altre, operazione], archivio);
}

/** Toglie dalla coda l'operazione di una serata, se c'è (dopo un invio riuscito). */
export async function togliDallaCoda(
  io: string,
  id: string,
  archivio: Archivio = archivioIndexedDb,
) {
  const coda = await leggiCoda(io, archivio);
  if (coda.some((op) => op.id === id)) {
    await scriviCoda(
      io,
      coda.filter((op) => op.id !== id),
      archivio,
    );
  }
}

/** Svuota la coda di un utente (uscita o eliminazione dell'account). */
export async function svuotaCoda(io: string, archivio: Archivio = archivioIndexedDb) {
  await archivio.elimina(chiave(io));
}

export type EsitoSincronizzazione = { inviate: number; inErrore: number; interrotta: boolean };

type Esecutori = {
  salva: (dati: Salvataggio) => Promise<void>;
  elimina: (id: string) => Promise<void>;
};

/**
 * Invia le operazioni in ordine di modifica. Senza rete si ferma e riprova al prossimo
 * ritorno della connessione; un rifiuto del database (per esempio un evento non più
 * visibile) segna l'operazione, che resta sul telefono finché la persona non la corregge.
 * Un'operazione cambiata durante l'invio resta in coda per il giro successivo.
 */
export async function sincronizza(
  io: string,
  esecutori: Esecutori,
  archivio: Archivio = archivioIndexedDb,
): Promise<EsitoSincronizzazione> {
  const esito: EsitoSincronizzazione = { inviate: 0, inErrore: 0, interrotta: false };
  const iniziale = (await leggiCoda(io, archivio)).filter((op) => !op.errore);
  iniziale.sort((a, b) => a.modificata_il.localeCompare(b.modificata_il));

  for (const operazione of iniziale) {
    let fallita = false;
    try {
      if (operazione.tipo === 'salva') await esecutori.salva(operazione.dati);
      else await esecutori.elimina(operazione.id);
    } catch (errore) {
      const dominio = converti(errore);
      if (dominio instanceof ErroreRete) {
        esito.interrotta = true;
        break;
      }
      registraErrore('sincronizzazione del diario rifiutata', dominio);
      fallita = true;
    }
    const attuale = await leggiCoda(io, archivio);
    const stessa = attuale.find(
      (op) => op.id === operazione.id && op.modificata_il === operazione.modificata_il,
    );
    if (!stessa) continue;
    if (fallita) {
      esito.inErrore += 1;
      await scriviCoda(
        io,
        attuale.map((op) => (op === stessa ? { ...op, errore: true } : op)),
        archivio,
      );
    } else {
      esito.inviate += 1;
      await scriviCoda(
        io,
        attuale.filter((op) => op !== stessa),
        archivio,
      );
    }
  }
  return esito;
}

/** Stato di una serata mostrata nel diario. */
export type StatoVoce = 'sincronizzata' | 'in_coda' | 'errore';
export type VoceMostrata = Voce & { stato: StatoVoce; modificata_il: string | null };

/**
 * Diario del server con sopra le operazioni in attesa: le serate salvate offline compaiono
 * (nuove o aggiornate) con lo stato "Da sincronizzare", quelle eliminate offline spariscono.
 */
export function unisciDiario(server: readonly Voce[], coda: readonly Operazione[]): VoceMostrata[] {
  const perId = new Map(coda.map((op) => [op.id, op]));
  const voci: VoceMostrata[] = [];
  for (const voce of server) {
    const op = perId.get(voce.id);
    if (op?.tipo === 'elimina') continue;
    if (op?.tipo === 'salva') {
      voci.push({
        ...op.anteprima,
        stato: op.errore ? 'errore' : 'in_coda',
        modificata_il: op.modificata_il,
      });
    } else {
      voci.push({ ...voce, stato: 'sincronizzata', modificata_il: null });
    }
    perId.delete(voce.id);
  }
  for (const op of perId.values()) {
    if (op.tipo === 'salva') {
      voci.push({
        ...op.anteprima,
        stato: op.errore ? 'errore' : 'in_coda',
        modificata_il: op.modificata_il,
      });
    }
  }
  return voci.sort(
    (a, b) => b.data_serata.localeCompare(a.data_serata) || b.creato_il.localeCompare(a.creato_il),
  );
}

/** Serate raggruppate per mese ("2026-10"), dalla più recente. */
export function perMese<T extends { data_serata: string }>(voci: readonly T[]) {
  const gruppi: { mese: string; voci: T[] }[] = [];
  for (const voce of voci) {
    const mese = voce.data_serata.slice(0, 7);
    const ultimo = gruppi.at(-1);
    if (ultimo?.mese === mese) ultimo.voci.push(voce);
    else gruppi.push({ mese, voci: [voce] });
  }
  return gruppi;
}
