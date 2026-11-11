import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Copertina, type DatiCopertina } from '@/components/ui/Copertina';
import {
  corpoTitolo,
  elementiMotivo,
  famigliaDaGeneri,
  MOTIVI,
  parametri,
  SchemaColoriCopertina,
  semeCopertina,
  titoloCorto,
  titoloManifesto,
} from '@/lib/copertinaGenerata';

describe('copertina generata: seme e testi (ALGORITMO §1, §5)', () => {
  it('stesso seme per la stessa serata in settimane diverse', () => {
    expect(semeCopertina('ONE TWO', 'The Club')).toBe('one two|the club');
    expect(semeCopertina('ONE TWO 25.11', 'The Club')).toBe('one two|the club');
    expect(semeCopertina('One Two - 12/11/2026', 'The Club')).toBe('one two|the club');
    expect(semeCopertina('Città — Notte #3', 'Cascina Torretta')).toBe(
      'citta notte 3|cascina torretta',
    );
  });

  it('titolo da manifesto senza data, corpo e titolo corto', () => {
    expect(titoloManifesto('ONE TWO 25.11')).toBe('ONE TWO');
    expect(titoloManifesto('PERREO 21 novembre')).toBe('PERREO');
    expect(corpoTitolo('ONE TWO')).toBe('xl');
    expect(corpoTitolo('GIRLS REPUBLIC')).toBe('l');
    expect(corpoTitolo('Schranz Movement: Obscure')).toBe('s');
    expect(titoloCorto('GIRLS REPUBLIC')).toBe('GIRLS REPUBLIC');
    expect(titoloCorto('DOCTOR MÜCKE ALL NIGHT LONG')).toBe('DOCTOR MÜCKE…');
  });

  it('famiglia dal primo genere, accento senza genere', () => {
    expect(famigliaDaGeneri(['hip_hop', 'techno'])).toBe('hiphop');
    expect(famigliaDaGeneri(['drum_and_bass'])).toBe('dnb');
    expect(famigliaDaGeneri(['polka'])).toBe('altro');
    expect(famigliaDaGeneri([])).toBe('accento');
  });
});

describe('copertina generata: motivi (ALGORITMO §2, §3)', () => {
  it('deterministica: stesso seme, stessi elementi', () => {
    const a = parametri('one two|the club');
    expect(parametri('one two|the club')).toEqual(a);
    expect(elementiMotivo(a)).toEqual(elementiMotivo(parametri('one two|the club')));
  });

  it('su 5.000 semi tutti i motivi compaiono e restano sotto i 34 nodi', () => {
    const visti = new Set<string>();
    for (let i = 0; i < 5000; i += 1) {
      const p = parametri(`serata ${i}|locale ${i % 37}`);
      visti.add(p.motivo);
      const elementi = elementiMotivo(p);
      expect(elementi.length + 2).toBeLessThanOrEqual(34);
      for (const elemento of elementi) {
        const colori = [elemento.stile.fill, elemento.stile.stroke].filter(
          (c) => c && c !== 'none',
        );
        // Nessun colore fisso nei motivi: solo le variabili della famiglia.
        for (const colore of colori) expect(colore).toMatch(/^var\(--cg-[12]\)$/);
      }
      expect([18, 50, 82, 26, 74]).toContain(p.bagliore.x);
      expect([-18, -9, 0, 9, 18]).toContain(p.angolo);
    }
    expect(visti.size).toBe(MOTIVI.length);
  });

  it('colori della fonte validi o null (ADR-0030)', () => {
    const tavolozza = { fondo: '#181A0C', 1: '#D8F368', 2: '#647425', bagliore: '#505C1E' };
    const valido = { scuro: tavolozza, chiaro: tavolozza, calcolata_il: '2026-11-11T10:00:00Z' };
    expect(SchemaColoriCopertina.parse(valido)).toEqual(valido);
    expect(SchemaColoriCopertina.parse({ ...valido, scuro: { fondo: 'red' } })).toBeNull();
    expect(SchemaColoriCopertina.parse(undefined)).toBeNull();
  });
});

describe('Copertina', () => {
  const base: DatiCopertina = {
    tipo: 'tipografica',
    alt: 'Foto di The Club',
    generata: { seme: 'one two|the club', famiglia: 'hiphop' },
  };

  it('senza foto né flyer disegna la copertina della serata, nascosta ai lettori di schermo', () => {
    const { container } = render(
      <Copertina copertina={base} forma="miniatura" ora="23:30" titolo="ONE TWO 25.11" />,
    );
    const copertina = container.querySelector('.cg');
    expect(copertina).toHaveClass('cg-hiphop');
    expect(copertina?.getAttribute('data-motivo')).toBe(parametri('one two|the club').motivo);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.cg-mini')).toHaveTextContent('23:30ONE TWO');
  });

  it('con i colori della fonte usa le variabili dei due temi', () => {
    const tavolozza = { fondo: '#181A0C', 1: '#D8F368', 2: '#647425', bagliore: '#505C1E' };
    const { container } = render(
      <Copertina
        copertina={{
          ...base,
          generata: {
            ...base.generata!,
            colori: { scuro: tavolozza, chiaro: tavolozza, calcolata_il: '2026-11-11T10:00:00Z' },
          },
        }}
        forma="dettaglio"
        ora="23:30"
        titolo="ONE TWO"
        sopra="Mercoledì · Milano"
      />,
    );
    const copertina = container.querySelector<HTMLElement>('.cg');
    expect(copertina).toHaveClass('cg-dati');
    expect(copertina?.style.getPropertyValue('--cgs-1')).toBe('#D8F368');
    expect(container.querySelector('.cg-det')).toHaveTextContent('Mercoledì · Milano23:30ONE TWO');
  });

  it('la foto del locale ha la precedenza (ADR-0018)', () => {
    const { container } = render(
      <Copertina
        copertina={{ ...base, tipo: 'locale', url: 'https://x.example/foto.webp' }}
        forma="evidenza"
        ora="23:30"
        titolo="ONE TWO"
      />,
    );
    expect(container.querySelector('.cg')).toBeNull();
    expect(container.querySelector('img')).not.toBeNull();
  });
});
