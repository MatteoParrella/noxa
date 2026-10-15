'use client';

import type { Map as MappaMaplibre } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { leggiColori, stileMappa } from '@/lib/mappa/stile';
import { EVENTO_TEMA, temaAttivo } from '@/lib/tema';
import { Avviso } from './Avviso';
import 'maplibre-gl/dist/maplibre-gl.css';

/** Centro e zoom iniziali: Milano, con la Brianza a nord. */
const CENTRO: [number, number] = [9.19, 45.5];
const LIMITI: [[number, number], [number, number]] = [
  [8.65, 45.15],
  [9.6, 45.8],
];

type Props = {
  /** URL del file PMTiles nel bucket `mappe` (NEXT_PUBLIC_MAPPA_PMTILES_URL). */
  urlPmtiles: string | undefined;
  etichetta?: string;
};

type Stato = 'caricamento' | 'pronta' | 'errore';

/**
 * Mappa MapLibre con la basemap Protomaps auto-ospitata (ADR-0016): tutte le richieste vanno
 * al bucket `mappe`, nessuna a servizi di mappe esterni. Ogni informazione della mappa è
 * anche nell'elenco (DESIGN.md §4).
 */
export function Mappa({ urlPmtiles, etichetta = 'Mappa di Milano e Brianza' }: Props) {
  const contenitore = useRef<HTMLDivElement>(null);
  const [stato, setStato] = useState<Stato>('caricamento');

  useEffect(() => {
    const elemento = contenitore.current;
    if (!elemento || !urlPmtiles) return;
    let mappa: MappaMaplibre | null = null;
    let annullato = false;

    async function crea(url: string, nodo: HTMLDivElement) {
      const [maplibre, { Protocol }] = await Promise.all([
        import('maplibre-gl'),
        import('pmtiles'),
      ]);
      if (annullato) return;
      const protocollo = new Protocol();
      maplibre.addProtocol('pmtiles', protocollo.tile);
      const ridotto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      mappa = new maplibre.Map({
        container: nodo,
        style: stileMappa(url, temaAttivo(), leggiColori(document.documentElement)),
        center: CENTRO,
        zoom: 11,
        minZoom: 9,
        maxZoom: 15,
        maxBounds: LIMITI,
        attributionControl: false,
        fadeDuration: ridotto ? 0 : 300,
        cooperativeGestures: false,
      });
      mappa.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
      mappa.on('load', () => setStato('pronta'));
      mappa.on('error', () => setStato((attuale) => (attuale === 'pronta' ? attuale : 'errore')));
    }

    function cambiaTema() {
      mappa?.setStyle(
        stileMappa(urlPmtiles ?? '', temaAttivo(), leggiColori(document.documentElement)),
      );
    }

    crea(urlPmtiles, elemento).catch(() => setStato('errore'));
    window.addEventListener(EVENTO_TEMA, cambiaTema);
    return () => {
      annullato = true;
      window.removeEventListener(EVENTO_TEMA, cambiaTema);
      mappa?.remove();
    };
  }, [urlPmtiles]);

  if (!urlPmtiles) {
    return (
      <Avviso tipo="avviso" titolo="Mappa non disponibile">
        La mappa non è configurata in questa versione dell’app. Gli eventi restano nell’elenco.
      </Avviso>
    );
  }

  return (
    <div className="mappa">
      <div
        ref={contenitore}
        className="mappa-tela"
        role="region"
        aria-label={`${etichetta}. Le stesse informazioni sono nell’elenco.`}
        aria-busy={stato === 'caricamento'}
        data-stato={stato}
      />
      {stato === 'errore' && (
        <div className="mappa-errore">
          <Avviso tipo="errore" titolo="La mappa non si è caricata">
            Controlla la connessione e riapri la mappa. Gli eventi restano nell’elenco.
          </Avviso>
        </div>
      )}
      <p className="mappa-attribuzione">
        ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap
        </a>{' '}
        contributors ·{' '}
        <a href="https://protomaps.com" target="_blank" rel="noreferrer">
          Protomaps
        </a>
      </p>
    </div>
  );
}
