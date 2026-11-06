// Ritorno sicuro (F-21): orari dell'avvio, aree di arrivo solo sul telefono (R-32), stato visto
// da chi riceve, link delle notifiche e testi senza parole di controllo (R-43).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { linkNotifica } from '@/features/notifiche/testo';
import type { RitornoAmico } from '@/features/ritorno/api';
import {
  aggiungiArea,
  areaRaggiunta,
  eliminaArea,
  leggiAree,
  leggiSessioneLocale,
  MASSIMO_AREE,
  salvaSessioneLocale,
} from '@/features/ritorno/dispositivo';
import { arrivoValido, prossimoOrario } from '@/features/ritorno/FoglioAvvia';
import { metri, posizioneVecchia, quantoFa, statoAmico } from '@/features/ritorno/formato';
import { distanzaMetri } from '@/features/ritorno/posizione';
import { converti, ErroreValidazione } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';

// Ora locale del dispositivo (l'orario scelto nel foglio è locale): vale con ogni fuso orario.
const ORA = new Date(2026, 10, 7, 23, 40).getTime();
const MIN = 60_000;

describe('arrivo previsto (R-31: da 10 minuti a 4 ore)', () => {
  it('accetta solo orari tra 10 minuti e 4 ore da adesso', () => {
    expect(arrivoValido(ORA + 30 * MIN, ORA)).toBe(true);
    expect(arrivoValido(ORA + 4 * 60 * MIN - MIN, ORA)).toBe(true);
    expect(arrivoValido(ORA + 9 * MIN, ORA)).toBe(false);
    expect(arrivoValido(ORA + 4 * 60 * MIN + MIN, ORA)).toBe(false);
    expect(arrivoValido(null, ORA)).toBe(false);
  });

  it('un orario già passato oggi vale per domani (le notti passano la mezzanotte)', () => {
    const arrivo = prossimoOrario('01:30', ORA);
    expect(arrivo).not.toBeNull();
    expect(new Date(arrivo!).getDate()).toBe(new Date(ORA).getDate() + 1);
    expect(arrivoValido(arrivo, ORA)).toBe(true);
    expect(prossimoOrario('23:00', ORA)! - ORA).toBeGreaterThan(20 * 60 * MIN);
    expect(prossimoOrario('25:99', ORA)).toBeNull();
  });
});

describe('aree di arrivo solo sul telefono (R-32)', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('si salvano nel localStorage senza nessuna richiesta di rete', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    expect(aggiungiArea({ nome: ' Casa ', lat: 45.58, lon: 9.27, raggio: 150 })).toBe(true);
    const aree = leggiAree();
    expect(aree).toHaveLength(1);
    expect(aree[0]).toMatchObject({ nome: 'Casa', raggio: 150 });
    expect(fetch).not.toHaveBeenCalled();
    eliminaArea(aree[0]!.id);
    expect(leggiAree()).toEqual([]);
  });

  it('al massimo 10 aree, con un nome e un raggio ammesso', () => {
    for (let i = 0; i < MASSIMO_AREE; i++)
      expect(aggiungiArea({ nome: `Area ${i}`, lat: 45.5, lon: 9.2, raggio: 100 })).toBe(true);
    expect(aggiungiArea({ nome: 'Troppe', lat: 45.5, lon: 9.2, raggio: 100 })).toBe(false);
    window.localStorage.clear();
    expect(aggiungiArea({ nome: '   ', lat: 45.5, lon: 9.2, raggio: 100 })).toBe(false);
    expect(aggiungiArea({ nome: 'X', lat: 45.5, lon: 9.2, raggio: 999 as unknown as 100 })).toBe(
      false,
    );
  });

  it('dati rovinati nello storage si ignorano', () => {
    window.localStorage.setItem('noxa-aree-arrivo', '{non json');
    expect(leggiAree()).toEqual([]);
    window.localStorage.setItem('noxa-aree-arrivo', JSON.stringify([{ nome: 'senza centro' }]));
    expect(leggiAree()).toEqual([]);
  });

  it('l’arrivo considera raggio e precisione (al massimo 100 m di tolleranza)', () => {
    const area = { id: 'a', nome: 'Casa', lat: 45.58, lon: 9.27, raggio: 150 as const };
    const vicino = { lat: 45.581, lon: 9.27, precisione: 20 };
    const lontano = { lat: 45.59, lon: 9.27, precisione: 20 };
    expect(distanzaMetri(area, vicino)).toBeGreaterThan(100);
    expect(areaRaggiunta(area, vicino)).toBe(true);
    expect(areaRaggiunta(area, lontano)).toBe(false);
    expect(areaRaggiunta(area, { ...lontano, precisione: 5000 })).toBe(false);
  });

  it('la sessione locale ricorda solo id, partenza e area', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    salvaSessioneLocale({ ritornoId: id, partenza: 'Binario 7', areaId: null });
    expect(leggiSessioneLocale()).toEqual({ ritornoId: id, partenza: 'Binario 7', areaId: null });
    salvaSessioneLocale(null);
    expect(leggiSessioneLocale()).toBeNull();
  });
});

describe('ritorno visto da chi riceve', () => {
  const base: RitornoAmico = {
    id: '00000000-0000-4000-8000-000000000002',
    stato: 'attivo',
    avviatoIl: new Date(ORA - 30 * MIN).toISOString(),
    arrivoPrevisto: new Date(ORA + 30 * MIN).toISOString(),
    allertaInviataIl: null,
    conclusoIl: null,
    posizione: null,
    persona: { id: 'x', username: 'sara.c', nome_visualizzato: 'Sara C.', avatar_path: null },
  };

  it('in viaggio, in ritardo dopo l’arrivo previsto, arrivato o terminato', () => {
    expect(statoAmico(base, ORA)).toBe('in_viaggio');
    expect(statoAmico(base, ORA + 31 * MIN)).toBe('in_ritardo');
    expect(statoAmico({ ...base, allertaInviataIl: new Date(ORA).toISOString() }, ORA)).toBe(
      'in_ritardo',
    );
    expect(statoAmico({ ...base, stato: 'arrivato' }, ORA)).toBe('arrivato');
    expect(statoAmico({ ...base, stato: 'annullato' }, ORA)).toBe('terminato');
    expect(statoAmico({ ...base, stato: 'scaduto' }, ORA)).toBe('terminato');
  });

  it('orari relativi, posizione vecchia dopo 5 minuti e metri arrotondati', () => {
    expect(quantoFa(ORA - 20_000, ORA)).toBe('adesso');
    expect(quantoFa(ORA - 3 * MIN, ORA)).toBe('3 min fa');
    expect(quantoFa(ORA - 90 * MIN, ORA)).toBe('più di un’ora fa');
    expect(posizioneVecchia(ORA - 4 * MIN, ORA)).toBe(false);
    expect(posizioneVecchia(ORA - 6 * MIN, ORA)).toBe(true);
    expect(posizioneVecchia(null, ORA)).toBe(true);
    expect(metri(37)).toBe(35);
    expect(metri(312)).toBe(310);
    expect(metri(1)).toBe(5);
  });
});

describe('notifiche e errori del ritorno', () => {
  it('le notifiche portano al ritorno dell’amico, che decide con la RLS se si vede', () => {
    const id = '00000000-0000-4000-8000-000000000003';
    expect(linkNotifica('ritorno_allerta', { ritorno_id: id })).toBe(
      `/vivi/ritorno-amico/?id=${id}`,
    );
    expect(linkNotifica('ritorno_avviato', { ritorno_id: 'non un uuid' })).toBe('/vivi/');
  });

  it('i codici NX055…NX061 diventano errori di dominio', () => {
    const casi = {
      NX055: 'ritorno_gia_attivo',
      NX056: 'ritorno_senza_destinatari',
      NX057: 'ritorno_troppi_destinatari',
      NX058: 'arrivo_fuori_limiti',
      NX059: 'ritorno_non_attivo',
      NX060: 'posizione_troppo_frequente',
      NX061: 'troppi_ritorni_oggi',
    } as const;
    for (const [code, codice] of Object.entries(casi)) {
      const errore = converti({ code, message: 'x' });
      expect(errore).toBeInstanceOf(ErroreValidazione);
      expect((errore as ErroreValidazione).codice).toBe(codice);
    }
  });

  it('nessuna parola di controllo né pressione sociale nei testi (brief, R-43)', () => {
    const testi = JSON.stringify(messaggi.ritorno, (_, valore: unknown) =>
      typeof valore === 'function'
        ? String((valore as (...a: string[]) => string)('X', 'Y'))
        : valore,
    );
    expect(testi).not.toMatch(/tracci|\bsegu[io]|localizz|monitor|non hai avviato/i);
  });
});
