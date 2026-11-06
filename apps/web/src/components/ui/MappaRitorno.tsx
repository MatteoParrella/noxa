'use client';

import type { Map as MappaMaplibre, Marker } from 'maplibre-gl';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LIMITI, caricaMaplibre } from '@/lib/mappa/maplibre';
import { leggiColori, stileMappa } from '@/lib/mappa/stile';
import { EVENTO_TEMA, temaAttivo } from '@/lib/tema';
import { classi } from '@/lib/classi';
import 'maplibre-gl/dist/maplibre-gl.css';

type Props = {
  lat: number;
  lon: number;
  /** Raggio del cerchio in metri: la precisione della posizione o il raggio di un'area. */
  raggio: number;
  /** Etichetta della regione (la mappa non è l'unico modo di leggere lo stato). */
  etichetta: string;
  /** Posizione più vecchia di 5 minuti: cerchio tratteggiato e punto grigio (design §4). */
  vecchia?: boolean;
  /** Iniziali dell'amico al posto del punto (design §5). */
  iniziali?: string;
  /** Centro trascinabile (aree di arrivo): chiamata alla fine del trascinamento. */
  onCambia?: (lat: number, lon: number) => void;
  alta?: boolean;
  area?: boolean;
  children?: ReactNode;
};

/** Metri per pixel di MapLibre (tasselli di 512 px) a una latitudine e a uno zoom. */
function metriPerPixel(lat: number, zoom: number): number {
  return (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
}

/**
 * Mappa del ritorno sicuro (design/F-21-ritorno-sicuro): una sola posizione con il cerchio di
 * precisione, mai la scia del percorso (R-31). Le tessere sono quelle auto-ospitate di
 * ADR-0016: nessuna richiesta a servizi di mappe esterni.
 */
export function MappaRitorno({
  lat,
  lon,
  raggio,
  etichetta,
  vecchia = false,
  iniziali,
  onCambia,
  alta = false,
  area = false,
  children,
}: Props) {
  const url = process.env.NEXT_PUBLIC_MAPPA_PMTILES_URL;
  const contenitore = useRef<HTMLDivElement>(null);
  const mappaRef = useRef<MappaMaplibre | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const cerchioRef = useRef<HTMLSpanElement | null>(null);
  const puntoRef = useRef<HTMLSpanElement | null>(null);
  const raggioRef = useRef(raggio);
  const onCambiaRef = useRef(onCambia);
  const iniziale = useRef({ lat, lon });
  const trascinabile = onCambia !== undefined;
  const [pronta, setPronta] = useState(false);
  useEffect(() => {
    onCambiaRef.current = onCambia;
    raggioRef.current = raggio;
  });

  useEffect(() => {
    const elemento = contenitore.current;
    if (!elemento || !url) return;
    let mappa: MappaMaplibre | null = null;
    let annullato = false;

    function ridimensiona() {
      const cerchio = cerchioRef.current;
      if (!mappa || !cerchio) return;
      const centro = markerRef.current?.getLngLat();
      const diametro = Math.max(
        16,
        Math.min(
          2000,
          (2 * raggioRef.current) / metriPerPixel(centro?.lat ?? 45.5, mappa.getZoom()),
        ),
      );
      cerchio.style.width = `${diametro}px`;
      cerchio.style.height = `${diametro}px`;
    }

    async function crea(indirizzo: string, nodo: HTMLDivElement) {
      const maplibre = await caricaMaplibre();
      if (annullato) return;
      const centro: [number, number] = [iniziale.current.lon, iniziale.current.lat];
      mappa = new maplibre.Map({
        container: nodo,
        style: stileMappa(indirizzo, temaAttivo(), leggiColori(document.documentElement)),
        center: centro,
        zoom: 15,
        minZoom: 9,
        maxZoom: 16,
        maxBounds: LIMITI,
        attributionControl: false,
        interactive: true,
      });
      mappaRef.current = mappa;
      const segnaposto = document.createElement('span');
      segnaposto.className = 'rt-segnaposto';
      segnaposto.setAttribute('aria-hidden', 'true');
      const cerchio = document.createElement('span');
      cerchio.className = 'rt-precisione';
      const punto = document.createElement('span');
      punto.className = 'rt-marcatore';
      segnaposto.append(cerchio, punto);
      cerchioRef.current = cerchio;
      puntoRef.current = punto;
      const marker = new maplibre.Marker({
        element: segnaposto,
        draggable: trascinabile,
        anchor: 'center',
      })
        .setLngLat(centro)
        .addTo(mappa);
      marker.on('dragend', () => {
        const { lat: nuovaLat, lng } = marker.getLngLat();
        onCambiaRef.current?.(Number(nuovaLat.toFixed(6)), Number(lng.toFixed(6)));
      });
      markerRef.current = marker;
      mappa.on('zoom', ridimensiona);
      mappa.on('load', () => {
        ridimensiona();
        setPronta(true);
      });
      ridimensiona();
    }

    function cambiaTema() {
      mappa?.setStyle(stileMappa(url ?? '', temaAttivo(), leggiColori(document.documentElement)));
    }

    crea(url, elemento).catch(() => setPronta(false));
    window.addEventListener(EVENTO_TEMA, cambiaTema);
    return () => {
      annullato = true;
      window.removeEventListener(EVENTO_TEMA, cambiaTema);
      markerRef.current?.remove();
      mappa?.remove();
      mappaRef.current = null;
    };
  }, [url, trascinabile]);

  // Posizione nuova: il segnaposto si sposta e la mappa lo segue (senza scia).
  useEffect(() => {
    markerRef.current?.setLngLat([lon, lat]);
    mappaRef.current?.easeTo({ center: [lon, lat], duration: 0 });
  }, [lat, lon]);

  // Stato del segnaposto e raggio del cerchio.
  useEffect(() => {
    const cerchio = cerchioRef.current;
    const punto = puntoRef.current;
    if (cerchio) cerchio.className = classi('rt-precisione', vecchia && 'is-vecchia');
    if (punto) {
      punto.className = classi('rt-marcatore', vecchia && 'is-vecchia', iniziali && 'avatar-m');
      punto.textContent = iniziali ?? '';
    }
    const mappa = mappaRef.current;
    if (mappa && cerchio) {
      const diametro = Math.max(
        16,
        Math.min(2000, (2 * raggio) / metriPerPixel(lat, mappa.getZoom())),
      );
      cerchio.style.width = `${diametro}px`;
      cerchio.style.height = `${diametro}px`;
    }
  }, [vecchia, iniziali, raggio, lat, pronta]);

  return (
    <div className={classi('rt-mappa', alta && 'alta', area && 'area')}>
      <div
        ref={contenitore}
        className="absolute inset-0"
        role="region"
        aria-label={etichetta}
        aria-busy={!pronta}
        data-stato={pronta ? 'pronta' : 'caricamento'}
      />
      {children}
      <p className="mappa-attribuzione">
        ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap
        </a>
      </p>
    </div>
  );
}
