import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FAMIGLIE } from '@/lib/copertinaGenerata';
import { FOTO_LIBERE, fotoDiUnElenco, fotoSerata, type FotoLibera } from '@/lib/fotoSerata';

const PROVA: FotoLibera[] = [
  { file: 'club-01.webp', tema: 'club', autore: 'A', licenza: 'cc0', fonte: 'https://a.example/1' },
  { file: 'club-02.webp', tema: 'club', autore: 'B', licenza: 'pdm', fonte: 'https://a.example/2' },
  {
    file: 'palco-01.webp',
    tema: 'palco',
    autore: 'C',
    licenza: 'cc0',
    fonte: 'https://a.example/3',
  },
];

describe('foto d’atmosfera delle copertine (ADR-0032)', () => {
  it('ogni foto della libreria ha licenza libera, autore, fonte e file presente', () => {
    expect(FOTO_LIBERE.length).toBeGreaterThan(0);
    const nomi = new Set<string>();
    for (const foto of FOTO_LIBERE) {
      expect(['cc0', 'pdm']).toContain(foto.licenza);
      expect(['club', 'disco', 'folla', 'palco']).toContain(foto.tema);
      expect(foto.autore.trim()).not.toBe('');
      expect(foto.fonte).toMatch(/^https:\/\//);
      expect(foto.file).toMatch(/^[a-z]+-\d{2}\.webp$/);
      expect(existsSync(path.join('public', 'copertine', foto.file))).toBe(true);
      nomi.add(foto.file);
    }
    expect(nomi.size).toBe(FOTO_LIBERE.length);
  });

  it('ogni famiglia di generi trova una foto nella libreria', () => {
    for (const famiglia of FAMIGLIE) {
      expect(fotoSerata('Serata · Locale', famiglia)).not.toBeNull();
    }
  });

  it('la stessa serata ha sempre la stessa foto e la stessa inquadratura', () => {
    const prima = fotoSerata('Notte Ferrovia · Club Binario 7', 'techno', PROVA);
    expect(fotoSerata('Notte Ferrovia · Club Binario 7', 'techno', PROVA)).toEqual(prima);
    expect(prima?.src).toMatch(/^\/copertine\/club-0[12]\.webp$/);
  });

  it('serate diverse si distinguono per foto, inquadratura o verso', () => {
    const viste = new Set(
      Array.from({ length: 40 }, (_, numero) =>
        JSON.stringify(fotoSerata(`Serata ${numero} · Locale`, 'techno', PROVA)),
      ),
    );
    expect(viste.size).toBeGreaterThan(10);
  });

  it('sceglie solo tra i temi della famiglia e senza foto adatte non ne mostra', () => {
    expect(fotoSerata('Concerto · Sala', 'live', PROVA)?.src).toBe('/copertine/palco-01.webp');
    expect(fotoSerata('Concerto · Sala', 'live', PROVA.slice(0, 2))).toBeNull();
  });

  it('nello stesso elenco nessuna foto si ripete finché la libreria ne ha', () => {
    const serate = Array.from({ length: 10 }, (_, numero) => ({
      seme: `Techno ${numero} · Locale`,
      famiglia: 'techno' as const,
    }));
    const foto = [...fotoDiUnElenco(serate).values()].map((scelta) => scelta.src);
    expect(foto).toHaveLength(10);
    expect(new Set(foto).size).toBe(
      Math.min(10, FOTO_LIBERE.filter((f) => f.tema === 'club').length),
    );
  });

  it('il dettaglio mostra la foto che la serata aveva nell’elenco', () => {
    const serate = [
      { seme: 'Prima · Locale', famiglia: 'techno' as const },
      { seme: 'Seconda · Locale', famiglia: 'techno' as const },
    ];
    const elenco = fotoDiUnElenco(serate);
    expect(fotoSerata('Seconda · Locale', 'techno')).toEqual(elenco.get('Seconda · Locale'));
  });

  it('con più serate che foto le foto tornano, ma una per giro', () => {
    const serate = Array.from({ length: 5 }, (_, numero) => ({
      seme: `Live ${numero} · Sala`,
      famiglia: 'live' as const,
    }));
    const scelte = [...fotoDiUnElenco(serate, PROVA).values()].map((scelta) => scelta.src);
    expect(scelte).toHaveLength(5);
    expect(new Set(scelte.slice(0, 1)).size).toBe(1);
  });
});
