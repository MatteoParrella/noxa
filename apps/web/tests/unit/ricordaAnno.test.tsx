import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  SchemaDatiRiepilogo,
  SchemaStatistiche,
  type DatiRiepilogo,
} from '@/features/ricorda/api-anno';
import { criterio } from '@/features/ricorda/Bacheca';
import { schedeDi, nomeFile, dataEstesa } from '@/features/ricorda/schede';
import { Classifica, Grafico, annoDiRoma } from '@/features/ricorda/Statistiche';
import { annoAggiornabile } from '@/features/ricorda/Wrapped';
import { linkNotifica, testoNotifica } from '@/features/notifiche/testo';

const pieno: DatiRiepilogo = {
  anno: 2026,
  serate: 16,
  per_mese: [1, 2, 0, 3, 2, 1, 0, 0, 4, 2, 1, 0],
  mese_top: { mese: 9, serate: 4 },
  locali_diversi: 7,
  locali_top: [
    { nome: 'Binario 7', serate: 6 },
    { nome: 'Sala Ventuno', serate: 4 },
  ],
  genere_top: { codice: 'techno', nome: 'Techno', serate: 7 },
  dj_top: [{ nome: 'DJ Lumen', serate: 4 }],
  serate_con_amici: 11,
  amici_diversi: 7,
  badge: ['prima_pagina', 'di_casa'],
  voto_top: { data_serata: '2026-09-26', locale: 'Sala Ventuno', voto: 5 },
};
const nomi = new Map([
  ['prima_pagina', 'Prima pagina'],
  ['di_casa', 'Di casa'],
]);

describe('Schede del riepilogo (F-33)', () => {
  it('con tutti i dati mostra le otto schede nell’ordine del design', () => {
    expect(schedeDi(pieno, nomi).map((s) => s.tipo)).toEqual([
      'copertina',
      'serate',
      'locali',
      'musica',
      'compagnia',
      'badge',
      'voto',
      'chiusura',
    ]);
  });

  it('salta le schede senza dati', () => {
    const minimo: DatiRiepilogo = {
      ...pieno,
      genere_top: null,
      dj_top: [],
      serate_con_amici: 0,
      amici_diversi: 0,
      badge: [],
      voto_top: null,
    };
    expect(schedeDi(minimo, nomi).map((s) => s.tipo)).toEqual([
      'copertina',
      'serate',
      'locali',
      'chiusura',
    ]);
  });

  it('R-42: gli amici sono solo numeri nel testo alternativo', () => {
    const compagnia = schedeDi(pieno, nomi).find((s) => s.tipo === 'compagnia');
    expect(compagnia?.alt).toBe('11 serate in compagnia, con 7 amici diversi.');
  });

  it('R-43: nessuna spesa e nessun confronto nei testi', () => {
    const testo = schedeDi(pieno, nomi)
      .map((s) => s.alt)
      .join(' ');
    expect(testo).not.toMatch(/€|spes|record|più di|meno di|alcol/i);
  });

  it('testi alternativi completi: mese più pieno, voto e badge', () => {
    const schede = schedeDi(pieno, nomi);
    expect(schede.find((s) => s.tipo === 'serate')?.alt).toContain('settembre, con 4 serate');
    expect(schede.find((s) => s.tipo === 'voto')?.alt).toContain('sabato 26 settembre 2026');
    expect(schede.find((s) => s.tipo === 'badge')?.alt).toContain('Prima pagina e Di casa');
  });

  it('nome del file senza nomi di persone', () => {
    expect(nomeFile(2026, 'locali')).toBe('noxa-2026-locali.png');
    expect(dataEstesa('2026-01-03')).toBe('sabato 3 gennaio 2026');
  });

  it('valida i dati del riepilogo e rifiuta un formato sconosciuto', () => {
    expect(SchemaDatiRiepilogo.safeParse(pieno).success).toBe(true);
    expect(SchemaDatiRiepilogo.safeParse({ ...pieno, per_mese: [1, 2] }).success).toBe(false);
  });
});

describe('Anno del riepilogo e delle statistiche', () => {
  it('a dicembre si aggiorna l’anno in corso, a gennaio quello chiuso, poi nessuno', () => {
    expect(annoAggiornabile(new Date('2026-12-01T00:30:00+01:00'))).toBe(2026);
    expect(annoAggiornabile(new Date('2027-01-31T23:30:00+01:00'))).toBe(2026);
    expect(annoAggiornabile(new Date('2027-02-01T00:30:00+01:00'))).toBeNull();
    expect(annoAggiornabile(new Date('2026-11-30T22:59:00Z'))).toBeNull();
    expect(annoAggiornabile(new Date('2026-11-30T23:30:00Z'))).toBe(2026);
  });

  it('l’anno di oggi è quello di Roma', () => {
    expect(annoDiRoma(new Date('2026-12-31T23:30:00Z'))).toBe(2027);
  });
});

describe('Statistiche (F-31)', () => {
  it('il grafico ha un’alternativa testuale e un elenco che si apre', () => {
    render(
      <Grafico
        valori={[1, 0, 2]}
        etichette={['G', 'F', 'M']}
        nomi={['Gennaio', 'Febbraio', 'Marzo']}
      />,
    );
    expect(
      screen.getByRole('img', {
        name: 'Serate: Gennaio: 1 serata, Febbraio: 0 serate, Marzo: 2 serate',
      }),
    ).toBeInTheDocument();
    const pulsante = screen.getByRole('button', { name: 'Vedi come elenco' });
    expect(pulsante).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(pulsante);
    expect(screen.getByRole('button', { name: 'Nascondi l’elenco' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('Marzo')).toBeVisible();
  });

  it('una classifica vuota dice «Ancora niente qui»', () => {
    render(<Classifica righe={[]} />);
    expect(screen.getByText('Ancora niente qui')).toBeInTheDocument();
  });

  it('valida la risposta di mie_statistiche', () => {
    expect(
      SchemaStatistiche.safeParse({
        anno: null,
        serate: 3,
        per_mese: null,
        per_anno: [{ anno: 2025, serate: 3 }],
        locali: [],
        generi: [],
        dj: [],
        spese: { totale_centesimi: 0, per_categoria: [] },
      }).success,
    ).toBe(true);
  });
});

describe('Badge (F-32) e notifiche', () => {
  it('il criterio si scrive dal tipo e dalla soglia, senza percentuali', () => {
    expect(criterio({ criterio: { tipo: 'locali_diversi', soglia: 10 } })).toBe(
      '10 locali diversi',
    );
    expect(criterio({ criterio: { tipo: 'serate', soglia: 1 } })).toBe(
      'La prima serata nel diario',
    );
  });

  it('la notifica dice il nome del badge nell’app e porta al dettaglio', () => {
    const dati = { badge_codice: 'esploratore_2', nome: 'Esploratore II', quanti: 1 };
    expect(testoNotifica('badge_ottenuto', dati).titolo).toBe(
      'Hai un nuovo badge in Ricorda: Esploratore II.',
    );
    expect(linkNotifica('badge_ottenuto', dati)).toBe('/ricorda/badge/?badge=esploratore_2');
    expect(testoNotifica('badge_ottenuto', { ...dati, quanti: 3 }).titolo).toBe(
      'Hai 3 nuovi badge in Ricorda.',
    );
  });

  it('un codice non valido non entra nel link', () => {
    expect(linkNotifica('badge_ottenuto', { badge_codice: '../x' })).toBe('/ricorda/badge/');
  });

  it('il riepilogo pronto apre l’anno giusto', () => {
    expect(linkNotifica('riepilogo_pronto', { anno: 2026 })).toBe('/ricorda/wrapped/?anno=2026');
    expect(testoNotifica('riepilogo_pronto', { anno: 2026 }).titolo).toBe(
      'Il tuo riepilogo del 2026 è pronto in Ricorda.',
    );
  });
});
