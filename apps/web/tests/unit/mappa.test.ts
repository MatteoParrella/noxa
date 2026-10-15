import { describe, expect, it } from 'vitest';
import { flavorNoxa, stileMappa, urlRisorse, type ColoriMappa } from '@/lib/mappa/stile';

const COLORI: ColoriMappa = {
  terra: '#12161C',
  acqua: '#0A1219',
  parchi: '#141B19',
  edifici: '#191E26',
  stradeSecondarie: '#1F252E',
  stradePrincipali: '#2B323D',
  stradeScorrimento: '#384150',
  binari: '#2B323D',
  etichette: '#8D95A2',
  alone: '#0E1116',
};

describe('stile della mappa', () => {
  it('usa i colori dei token e nessuna icona dei punti di interesse', () => {
    const flavor = flavorNoxa('scuro', COLORI);
    expect(flavor.water).toBe('#0A1219');
    expect(flavor.highway).toBe('#384150');
    expect(flavor.city_label).toBe('#8D95A2');
    expect(flavor.pois).toBeUndefined();
  });

  it('prende font e file dallo stesso bucket, senza servizi esterni (ADR-0016)', () => {
    const url =
      'https://progetto.supabase.co/storage/v1/object/public/mappe/milano-brianza.pmtiles';
    const stile = stileMappa(url, 'chiaro', COLORI);
    expect(urlRisorse(url)).toBe(
      'https://progetto.supabase.co/storage/v1/object/public/mappe/assets',
    );
    expect(stile.glyphs).toBe(`${urlRisorse(url)}/fonts/{fontstack}/{range}.pbf`);
    expect(stile.sources.protomaps).toMatchObject({ type: 'vector', url: `pmtiles://${url}` });
    expect(stile.sprite).toBeUndefined();
    expect(stile.layers.length).toBeGreaterThan(20);
  });
});
