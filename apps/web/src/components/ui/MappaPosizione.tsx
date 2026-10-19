'use client';

import type { Map as MappaMaplibre, Marker } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { LIMITI, caricaMaplibre } from '@/lib/mappa/maplibre';
import { leggiColori, stileMappa } from '@/lib/mappa/stile';
import { EVENTO_TEMA, temaAttivo } from '@/lib/tema';
import 'maplibre-gl/dist/maplibre-gl.css';

type Props = {
  urlPmtiles: string | undefined;
  lat: number;
  lon: number;
  /** Chiamata alla fine del trascinamento del segnaposto. */
  onCambia: (lat: number, lon: number) => void;
  etichetta: string;
  etichettaSegnaposto: string;
};

/** Coordinate dentro i limiti della mappa di Milano e Brianza. */
export function dentroLimiti(lat: number, lon: number): boolean {
  const [[ovest, sud], [est, nord]] = LIMITI;
  return lat >= sud && lat <= nord && lon >= ovest && lon <= est;
}

/**
 * Mappa piccola con il segnaposto trascinabile per la posizione di un locale
 * (design/F-40-moderazione-fonti, scheda del locale). Trascinare non è l'unico modo: accanto
 * ci sono i campi delle coordinate (WCAG 2.5.7).
 */
export function MappaPosizione({
  urlPmtiles,
  lat,
  lon,
  onCambia,
  etichetta,
  etichettaSegnaposto,
}: Props) {
  const contenitore = useRef<HTMLDivElement>(null);
  const mappaRef = useRef<MappaMaplibre | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onCambiaRef = useRef(onCambia);
  const [pronta, setPronta] = useState(false);
  useEffect(() => {
    onCambiaRef.current = onCambia;
  });
  const iniziale = useRef({ lat, lon });

  useEffect(() => {
    const elemento = contenitore.current;
    if (!elemento || !urlPmtiles) return;
    let mappa: MappaMaplibre | null = null;
    let annullato = false;

    async function crea(url: string, nodo: HTMLDivElement) {
      const maplibre = await caricaMaplibre();
      if (annullato) return;
      const centro: [number, number] = [iniziale.current.lon, iniziale.current.lat];
      mappa = new maplibre.Map({
        container: nodo,
        style: stileMappa(url, temaAttivo(), leggiColori(document.documentElement)),
        center: centro,
        zoom: 15,
        minZoom: 9,
        maxZoom: 15,
        maxBounds: LIMITI,
        attributionControl: false,
      });
      mappaRef.current = mappa;
      const segnaposto = document.createElement('span');
      segnaposto.className = 'marker-posizione';
      segnaposto.setAttribute('aria-hidden', 'true');
      segnaposto.textContent = etichettaSegnaposto;
      const marker = new maplibre.Marker({ element: segnaposto, draggable: true, anchor: 'bottom' })
        .setLngLat(centro)
        .addTo(mappa);
      marker.on('dragend', () => {
        const { lat: nuovaLat, lng } = marker.getLngLat();
        onCambiaRef.current(Number(nuovaLat.toFixed(6)), Number(lng.toFixed(6)));
      });
      markerRef.current = marker;
      mappa.on('load', () => setPronta(true));
    }

    function cambiaTema() {
      mappa?.setStyle(
        stileMappa(urlPmtiles ?? '', temaAttivo(), leggiColori(document.documentElement)),
      );
    }

    crea(urlPmtiles, elemento).catch(() => setPronta(false));
    window.addEventListener(EVENTO_TEMA, cambiaTema);
    return () => {
      annullato = true;
      window.removeEventListener(EVENTO_TEMA, cambiaTema);
      markerRef.current?.remove();
      mappa?.remove();
      mappaRef.current = null;
    };
  }, [urlPmtiles, etichettaSegnaposto]);

  // Coordinate scritte nei campi: il segnaposto e la mappa le seguono.
  useEffect(() => {
    if (!dentroLimiti(lat, lon)) return;
    markerRef.current?.setLngLat([lon, lat]);
    mappaRef.current?.setCenter([lon, lat]);
  }, [lat, lon]);

  return (
    <div className="mappa-mini">
      <div
        ref={contenitore}
        className="absolute inset-0"
        role="region"
        aria-label={etichetta}
        aria-busy={!pronta}
        data-stato={pronta ? 'pronta' : 'caricamento'}
      />
      <p className="mappa-attribuzione">
        ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap
        </a>{' '}
        contributors
      </p>
    </div>
  );
}
