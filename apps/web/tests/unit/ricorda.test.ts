import { describe, expect, it, vi } from 'vitest';
import type { Salvataggio, Voce } from '@/features/ricorda/api';
import {
  accoda,
  leggiCoda,
  sincronizza,
  togliDallaCoda,
  unisciDiario,
  type Archivio,
  type Operazione,
} from '@/features/ricorda/coda';
import { conChi, euro, leggiImporto, totaleSpese } from '@/features/ricorda/formato';
import { ErroreRete } from '@/lib/errori';

// Diario delle serate (F-30): coda offline delle scritture e formati del modulo.

const IO = '00000000-0000-4000-8000-0000000000e2';
const id = (n: number) => `00000000-0000-4000-8000-00000000f${String(n).padStart(3, '0')}`;

function archivioInMemoria(): Archivio & { dati: Map<string, unknown> } {
  const dati = new Map<string, unknown>();
  return {
    dati,
    leggi: async (chiave) => structuredClone(dati.get(chiave)),
    scrivi: async (chiave, valore) => void dati.set(chiave, structuredClone(valore)),
    elimina: async (chiave) => void dati.delete(chiave),
  };
}

function voce(n: number, data: string, titolo = `Serata ${n}`): Voce {
  return {
    id: id(n),
    data_serata: data,
    evento: null,
    locale: null,
    nome_locale_libero: titolo,
    voto: null,
    note: null,
    spese: [],
    dj: [],
    amici: [],
    amici_altri: 0,
    creato_il: `${data}T23:00:00Z`,
    aggiornato_il: `${data}T23:00:00Z`,
  };
}

function salvataggio(n: number, data: string): Salvataggio {
  return {
    id: id(n),
    data_serata: data,
    evento_id: null,
    locale_id: null,
    nome_locale_libero: `Serata ${n}`,
    voto: null,
    note: null,
    spese: [],
    dj: [],
    amici: [],
  };
}

function salva(n: number, data: string, modificata: string): Operazione {
  return {
    tipo: 'salva',
    id: id(n),
    dati: salvataggio(n, data),
    anteprima: voce(n, data),
    modificata_il: modificata,
    errore: false,
  };
}

describe('coda offline del diario', () => {
  it('tiene una sola operazione per serata, l’ultima', async () => {
    const archivio = archivioInMemoria();
    await accoda(IO, salva(1, '2026-10-17', '2026-10-18T10:00:00Z'), {}, archivio);
    await accoda(IO, salva(1, '2026-10-16', '2026-10-18T10:05:00Z'), {}, archivio);
    const coda = await leggiCoda(IO, archivio);
    expect(coda).toHaveLength(1);
    expect(coda[0]?.tipo === 'salva' && coda[0].dati.data_serata).toBe('2026-10-16');
  });

  it('eliminare una serata mai sincronizzata la toglie senza inviare niente', async () => {
    const archivio = archivioInMemoria();
    await accoda(IO, salva(1, '2026-10-17', '2026-10-18T10:00:00Z'), {}, archivio);
    await accoda(
      IO,
      { tipo: 'elimina', id: id(1), modificata_il: '2026-10-18T10:01:00Z', errore: false },
      { soloLocale: true },
      archivio,
    );
    expect(await leggiCoda(IO, archivio)).toEqual([]);
    expect(archivio.dati.size).toBe(0);
  });

  it('una coda illeggibile non blocca il diario', async () => {
    const archivio = archivioInMemoria();
    archivio.dati.set(`coda:${IO}`, [{ tipo: 'sconosciuto' }]);
    expect(await leggiCoda(IO, archivio)).toEqual([]);
  });

  it('la coda è per utente', async () => {
    const archivio = archivioInMemoria();
    await accoda(IO, salva(1, '2026-10-17', '2026-10-18T10:00:00Z'), {}, archivio);
    expect(await leggiCoda(id(999), archivio)).toEqual([]);
    await togliDallaCoda(IO, id(1), archivio);
    expect(await leggiCoda(IO, archivio)).toEqual([]);
  });

  it('invia in ordine di modifica e svuota la coda', async () => {
    const archivio = archivioInMemoria();
    await accoda(IO, salva(2, '2026-10-10', '2026-10-18T10:05:00Z'), {}, archivio);
    await accoda(IO, salva(1, '2026-10-17', '2026-10-18T10:00:00Z'), {}, archivio);
    await accoda(
      IO,
      { tipo: 'elimina', id: id(3), modificata_il: '2026-10-18T10:10:00Z', errore: false },
      {},
      archivio,
    );
    const ordine: string[] = [];
    const esito = await sincronizza(
      IO,
      {
        salva: async (dati) => void ordine.push(`salva ${dati.id}`),
        elimina: async (voce) => void ordine.push(`elimina ${voce}`),
      },
      archivio,
    );
    expect(ordine).toEqual([`salva ${id(1)}`, `salva ${id(2)}`, `elimina ${id(3)}`]);
    expect(esito).toEqual({ inviate: 3, inErrore: 0, interrotta: false });
    expect(await leggiCoda(IO, archivio)).toEqual([]);
  });

  it('senza rete si ferma e lascia tutto in coda', async () => {
    const archivio = archivioInMemoria();
    await accoda(IO, salva(1, '2026-10-17', '2026-10-18T10:00:00Z'), {}, archivio);
    await accoda(IO, salva(2, '2026-10-10', '2026-10-18T10:05:00Z'), {}, archivio);
    const salvaSerata = vi.fn(async () => {
      throw new ErroreRete('rpc');
    });
    const esito = await sincronizza(IO, { salva: salvaSerata, elimina: vi.fn() }, archivio);
    expect(salvaSerata).toHaveBeenCalledTimes(1);
    expect(esito).toEqual({ inviate: 0, inErrore: 0, interrotta: true });
    expect(await leggiCoda(IO, archivio)).toHaveLength(2);
  });

  it('un rifiuto del database segna la serata e non la ripete', async () => {
    const archivio = archivioInMemoria();
    await accoda(IO, salva(1, '2026-10-17', '2026-10-18T10:00:00Z'), {}, archivio);
    const rifiuto = { code: '42501', message: 'Evento non disponibile.', details: '', hint: '' };
    const salvaSerata = vi.fn(async () => {
      throw rifiuto;
    });
    const esito = await sincronizza(IO, { salva: salvaSerata, elimina: vi.fn() }, archivio);
    expect(esito).toEqual({ inviate: 0, inErrore: 1, interrotta: false });
    expect((await leggiCoda(IO, archivio))[0]?.errore).toBe(true);

    await sincronizza(IO, { salva: salvaSerata, elimina: vi.fn() }, archivio);
    expect(salvaSerata).toHaveBeenCalledTimes(1);
  });

  it('una serata modificata durante l’invio resta per il giro successivo', async () => {
    const archivio = archivioInMemoria();
    await accoda(IO, salva(1, '2026-10-17', '2026-10-18T10:00:00Z'), {}, archivio);
    const esito = await sincronizza(
      IO,
      {
        salva: async () => {
          await accoda(IO, salva(1, '2026-10-16', '2026-10-18T10:02:00Z'), {}, archivio);
        },
        elimina: vi.fn(),
      },
      archivio,
    );
    expect(esito.inviate).toBe(0);
    const coda = await leggiCoda(IO, archivio);
    expect(coda).toHaveLength(1);
    expect(coda[0]?.modificata_il).toBe('2026-10-18T10:02:00Z');
  });
});

describe('diario mostrato', () => {
  it('mette sopra le modifiche in coda e nasconde le eliminazioni', () => {
    const server = [voce(1, '2026-10-17'), voce(2, '2026-10-10'), voce(3, '2026-10-03')];
    const coda: Operazione[] = [
      { ...salva(2, '2026-10-10', '2026-10-18T10:00:00Z'), errore: true },
      { tipo: 'elimina', id: id(3), modificata_il: '2026-10-18T10:01:00Z', errore: false },
      salva(4, '2026-10-24', '2026-10-25T09:00:00Z'),
    ];
    const voci = unisciDiario(server, coda);
    expect(voci.map((v) => [v.id, v.stato])).toEqual([
      [id(4), 'in_coda'],
      [id(1), 'sincronizzata'],
      [id(2), 'errore'],
    ]);
  });
});

describe('formati del diario', () => {
  it('legge gli importi scritti in italiano', () => {
    expect(leggiImporto('15')).toBe(1500);
    expect(leggiImporto('15,5')).toBe(1550);
    expect(leggiImporto(' € 15,50 ')).toBe(1550);
    expect(leggiImporto('15.50')).toBe(1550);
    expect(leggiImporto('1.000,00')).toBe(100_000);
    expect(leggiImporto('0,01')).toBe(1);
  });

  it('rifiuta importi vuoti, nulli, oltre 1.000 € o scritti male', () => {
    for (const testo of ['', '0', '0,00', '1000,01', '1.500', '15,555', '-3', 'dieci']) {
      expect(leggiImporto(testo)).toBeNull();
    }
  });

  it('scrive euro e totale', () => {
    expect(euro(1550)).toBe('€ 15,50');
    expect(euro(100_000)).toBe('€ 1.000,00');
    expect(
      totaleSpese([
        { categoria: 'ingresso', importo_centesimi: 1500 },
        { categoria: 'trasporto', importo_centesimi: 450 },
      ]),
    ).toBe(1950);
  });

  it('riassume con chi eri, contando chi non si vede più', () => {
    expect(conChi([], 0)).toBeNull();
    expect(conChi(['Marco B.'], 0)).toBe('con Marco B.');
    expect(conChi(['Marco B.', 'Sara C.'], 0)).toBe('con Marco B. e Sara C.');
    expect(conChi(['Elena V.', 'Marco B.'], 1)).toBe('con Elena V. e altri 2');
    expect(conChi([], 2)).toBe('con 2 persone');
  });
});
