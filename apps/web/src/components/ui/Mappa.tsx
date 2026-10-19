'use client';

import type { GeoJSONSource, Map as MappaMaplibre, Marker } from 'maplibre-gl';
import type { Protocol } from 'pmtiles';
import { Map as MapIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { classi } from '@/lib/classi';
import { leggiColori, stileMappa } from '@/lib/mappa/stile';
import { messaggi } from '@/lib/messaggi/it';
import { EVENTO_TEMA, temaAttivo } from '@/lib/tema';
import { Avviso } from './Avviso';
import { Icona } from './Icona';
import { Pulsante } from './Pulsante';
import 'maplibre-gl/dist/maplibre-gl.css';

/** Worker di MapLibre copiato tra i file statici (scripts/copia-maplibre-worker.mjs). */
const URL_WORKER = '/vendor/maplibre/maplibre-gl-worker.mjs';

/** Centro e zoom iniziali: Milano, con la Brianza a nord. */
const CENTRO: [number, number] = [9.19, 45.5];
const LIMITI: [[number, number], [number, number]] = [
  [8.65, 45.15],
  [9.6, 45.8],
];

const SORGENTE = 'locali';

let protocolloPmtiles: Protocol | null = null;

/** Un locale sulla mappa con il numero dei suoi eventi nei filtri attuali. */
export type LuogoMappa = { id: string; nome: string; lat: number; lon: number; eventi: number };

type Props = {
  /** URL del file PMTiles nel bucket `mappe` (NEXT_PUBLIC_MAPPA_PMTILES_URL). */
  urlPmtiles: string | undefined;
  etichetta?: string;
  /** Locali da segnare; vicini tra loro si raggruppano in un cerchio con il numero. */
  luoghi?: LuogoMappa[];
  selezionato?: string | null;
  onSeleziona?: (id: string) => void;
  /** Avvisa quando nell'area visibile non c'è nessun locale. */
  onAreaVuota?: (vuota: boolean) => void;
  /** Azione per tornare all'elenco, l'alternativa accessibile della mappa. */
  onVaiAllElenco?: () => void;
  /** Elementi sopra la mappa (pulsanti, avvisi). */
  children?: ReactNode;
};

type Stato = 'caricamento' | 'pronta' | 'errore';

type RaccoltaLuoghi = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: { id: string; nome: string; eventi: number };
  }>;
};

function geojson(luoghi: LuogoMappa[]): RaccoltaLuoghi {
  return {
    type: 'FeatureCollection',
    features: luoghi.map((luogo) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [luogo.lon, luogo.lat] },
      properties: { id: luogo.id, nome: luogo.nome, eventi: luogo.eventi },
    })),
  };
}

/**
 * Mappa MapLibre con la basemap Protomaps auto-ospitata (ADR-0016): tutte le richieste vanno
 * al bucket `mappe`, nessuna a servizi di mappe esterni. I segnaposto sono pulsanti con un
 * nome ("Officina Lambro, 2 eventi") e ogni informazione è anche nell'elenco (DESIGN.md §4).
 * I segnaposto non pulsano e non seguono il dito (ADR-0019).
 */
export function Mappa({
  urlPmtiles,
  etichetta = 'Mappa di Milano e Brianza',
  luoghi,
  selezionato = null,
  onSeleziona,
  onAreaVuota,
  onVaiAllElenco,
  children,
}: Props) {
  const testi = messaggi.scopri.mappaVista;
  const contenitore = useRef<HTMLDivElement>(null);
  const mappaRef = useRef<MappaMaplibre | null>(null);
  const sincronizzaRef = useRef<() => void>(() => undefined);
  const [stato, setStato] = useState<Stato>('caricamento');

  // Valori più recenti letti dai gestori degli eventi della mappa, creati una volta sola.
  const attuali = useRef({ luoghi, selezionato, onSeleziona, onAreaVuota });
  useEffect(() => {
    attuali.current = { luoghi, selezionato, onSeleziona, onAreaVuota };
  });

  useEffect(() => {
    const elemento = contenitore.current;
    if (!elemento || !urlPmtiles) return;
    let mappa: MappaMaplibre | null = null;
    let annullato = false;
    const segnaposto = new Map<string, Marker>();

    async function crea(url: string, nodo: HTMLDivElement) {
      const [maplibre, { Protocol: ProtocolloPmtiles }] = await Promise.all([
        import('maplibre-gl'),
        import('pmtiles'),
      ]);
      if (annullato) return;
      maplibre.setWorkerUrl(URL_WORKER);
      // Un solo protocollo per tutta l'app: intestazione e indici del file PMTiles restano in
      // memoria tra un'apertura e l'altra della mappa, senza riscaricarli.
      if (!protocolloPmtiles) {
        protocolloPmtiles = new ProtocolloPmtiles();
        maplibre.addProtocol('pmtiles', protocolloPmtiles.tile);
      }
      const ridotto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const creata = new maplibre.Map({
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
      mappa = creata;
      mappaRef.current = creata;
      creata.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');

      // Sorgente dei locali con il raggruppamento; lo strato invisibile serve a MapLibre per
      // calcolare i gruppi, i segnaposto visibili sono pulsanti HTML.
      const aggiungiLocali = () => {
        if (creata.getSource(SORGENTE)) return;
        creata.addSource(SORGENTE, {
          type: 'geojson',
          data: geojson(attuali.current.luoghi ?? []),
          cluster: true,
          clusterRadius: 56,
          clusterMaxZoom: 14,
        });
        creata.addLayer({
          id: `${SORGENTE}-calcolo`,
          type: 'circle',
          source: SORGENTE,
          paint: { 'circle-radius': 1, 'circle-opacity': 0 },
        });
      };

      const pulsanteGruppo = (id: number, locali: number, centro: [number, number]) => {
        const pulsante = document.createElement('button');
        pulsante.type = 'button';
        pulsante.className = 'marker-gruppo';
        pulsante.textContent = String(locali);
        pulsante.setAttribute('aria-label', testi.gruppo(locali));
        pulsante.addEventListener('click', (evento) => {
          evento.stopPropagation();
          const sorgente = creata.getSource<GeoJSONSource>(SORGENTE);
          void sorgente?.getClusterExpansionZoom(id).then((zoom) => {
            creata.easeTo({ center: centro, zoom, duration: ridotto ? 0 : 400 });
          });
        });
        return pulsante;
      };

      const pulsanteLocale = (id: string, nome: string, eventi: number) => {
        const pulsante = document.createElement('button');
        pulsante.type = 'button';
        pulsante.className = 'marker-locale';
        pulsante.dataset.locale = id;
        pulsante.setAttribute('aria-label', testi.locale(nome, eventi));
        const numero = document.createElement('span');
        numero.className = 'n';
        numero.setAttribute('aria-hidden', 'true');
        numero.textContent = String(eventi);
        const testo = document.createElement('span');
        testo.setAttribute('aria-hidden', 'true');
        testo.textContent = nome;
        pulsante.append(numero, testo);
        pulsante.addEventListener('click', (evento) => {
          evento.stopPropagation();
          attuali.current.onSeleziona?.(id);
        });
        return pulsante;
      };

      const sincronizza = () => {
        if (!creata.getSource(SORGENTE) || !creata.isSourceLoaded(SORGENTE)) return;
        const visti = new Set<string>();
        for (const elemento of creata.querySourceFeatures(SORGENTE)) {
          if (elemento.geometry.type !== 'Point') continue;
          const [lon, lat] = elemento.geometry.coordinates as [number, number];
          const proprieta = elemento.properties as Record<string, unknown>;
          const gruppo = proprieta['cluster'] === true;
          const chiave = gruppo
            ? `g${String(proprieta['cluster_id'])}`
            : `l${String(proprieta['id'])}`;
          if (visti.has(chiave)) continue;
          visti.add(chiave);
          if (segnaposto.has(chiave)) continue;
          const nodoMarker = gruppo
            ? pulsanteGruppo(Number(proprieta['cluster_id']), Number(proprieta['point_count']), [
                lon,
                lat,
              ])
            : pulsanteLocale(
                String(proprieta['id']),
                String(proprieta['nome']),
                Number(proprieta['eventi']),
              );
          segnaposto.set(
            chiave,
            new maplibre.Marker({
              element: nodoMarker,
              anchor: gruppo ? 'center' : 'bottom',
              offset: gruppo ? [0, 0] : [0, -6],
            })
              .setLngLat([lon, lat])
              .addTo(creata),
          );
        }
        for (const [chiave, marker] of segnaposto) {
          if (!visti.has(chiave)) {
            marker.remove();
            segnaposto.delete(chiave);
          }
        }
        for (const marker of segnaposto.values()) {
          const nodoMarker = marker.getElement();
          const scelto = nodoMarker.dataset.locale === attuali.current.selezionato;
          nodoMarker.classList.toggle('is-on', scelto);
          if (nodoMarker.dataset.locale) nodoMarker.setAttribute('aria-pressed', String(scelto));
        }
        const limiti = creata.getBounds();
        attuali.current.onAreaVuota?.(
          !(attuali.current.luoghi ?? []).some((luogo) => limiti.contains([luogo.lon, luogo.lat])),
        );
      };
      sincronizzaRef.current = sincronizza;

      creata.on('load', () => {
        aggiungiLocali();
        setStato('pronta');
      });
      creata.on('style.load', aggiungiLocali);
      creata.on('sourcedata', (evento) => {
        if (evento.sourceId === SORGENTE && evento.isSourceLoaded) sincronizza();
      });
      creata.on('moveend', sincronizza);
      creata.on('error', () => setStato((attuale) => (attuale === 'pronta' ? attuale : 'errore')));
    }

    function cambiaTema() {
      mappa?.setStyle(
        stileMappa(urlPmtiles ?? '', temaAttivo(), leggiColori(document.documentElement)),
      );
    }

    crea(urlPmtiles, elemento).catch(() => setStato('errore'));
    window.addEventListener(EVENTO_TEMA, cambiaTema);
    // La mappa può restare montata ma nascosta (Scopri in elenco): quando torna visibile
    // riprende le misure del contenitore.
    const osservatore = new ResizeObserver(() => mappa?.resize());
    osservatore.observe(elemento);
    return () => {
      annullato = true;
      osservatore.disconnect();
      window.removeEventListener(EVENTO_TEMA, cambiaTema);
      for (const marker of segnaposto.values()) marker.remove();
      mappa?.remove();
      mappaRef.current = null;
    };
  }, [urlPmtiles, testi]);

  // Nuovi locali (filtri cambiati): dati aggiornati e inquadratura su tutti i locali.
  useEffect(() => {
    const mappa = mappaRef.current;
    if (stato !== 'pronta' || !mappa) return;
    const sorgente = mappa.getSource<GeoJSONSource>(SORGENTE);
    if (!sorgente) return;
    const elenco = luoghi ?? [];
    sorgente.setData(geojson(elenco));
    if (elenco.length > 0) {
      const lon = elenco.map((luogo) => luogo.lon);
      const lat = elenco.map((luogo) => luogo.lat);
      const ridotto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      mappa.fitBounds(
        [
          [Math.min(...lon), Math.min(...lat)],
          [Math.max(...lon), Math.max(...lat)],
        ],
        { padding: 72, maxZoom: 14, duration: ridotto ? 0 : 400 },
      );
    }
  }, [luoghi, stato]);

  // Il segnaposto selezionato è l'unico arancio.
  useEffect(() => {
    sincronizzaRef.current();
  }, [selezionato]);

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
      {stato === 'pronta' && children}
      {stato === 'caricamento' && (
        <div className="mappa-spenta" aria-hidden="true">
          <span className="scheletro h-3.5 w-40" />
          <span className="t-corpo-s c-2">{testi.caricamento}</span>
        </div>
      )}
      {stato === 'errore' && (
        <MappaSpenta
          titolo={testi.errore.titolo}
          testo={testi.errore.testo}
          {...(onVaiAllElenco ? { onVaiAllElenco } : {})}
        />
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

type PropsSpenta = {
  titolo: string;
  testo: string;
  onVaiAllElenco?: () => void;
  className?: string;
};

/** Mappa non disponibile (errore o offline), con il passaggio all'elenco. */
export function MappaSpenta({ titolo, testo, onVaiAllElenco, className }: PropsSpenta) {
  return (
    <div className={classi('mappa-spenta', className)} role="alert">
      <span className="cornice-icona">
        <Icona icona={MapIcon} />
      </span>
      <span className="t-titolo-3">{titolo}</span>
      <span className="t-corpo-s c-2">{testo}</span>
      {onVaiAllElenco && (
        <Pulsante variante="secondario" dimensione="s" onClick={onVaiAllElenco}>
          {messaggi.scopri.mappaVista.vediElenco}
        </Pulsante>
      )}
    </div>
  );
}
