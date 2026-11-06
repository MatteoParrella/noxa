import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Coordinate } from './api';

/**
 * Posizione del telefono durante il ritorno sicuro (ADR-0006, ADR-0027, ADR-0028). Si chiede
 * solo dopo "Avvia" e solo finché il ritorno è attivo (R-31). Nell'app Android il plugin
 * `@capacitor-community/background-geolocation` avvia un servizio in primo piano con la
 * notifica di sistema fissa, così la posizione arriva anche con lo schermo bloccato; nella PWA
 * si usa `watchPosition`, che il browser ferma quando Noxa non è in primo piano.
 */

export type ModoPosizione = 'nativo' | 'primo_piano';

/** `nativo` solo nell'app Android; iPhone e browser usano la PWA (D-13). */
export function modoPosizione(): ModoPosizione {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
    ? 'nativo'
    : 'primo_piano';
}

export type Dispositivo = 'app' | 'iphone' | 'android_browser' | 'computer';

/**
 * Dove gira Noxa, per la nota sulla posizione a schermo bloccato: nell'app Android la
 * posizione arriva sempre e la nota non serve; nel browser del telefono (iPhone o Android) si
 * ferma quando lo blocchi; da computer non si torna a casa, quindi nessuna nota.
 */
export function dispositivo(): Dispositivo {
  if (modoPosizione() === 'nativo') return 'app';
  if (typeof navigator === 'undefined') return 'computer';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1))
    return 'iphone';
  if (/Android/.test(ua)) return 'android_browser';
  return 'computer';
}

/** Mostrare la nota "la posizione si ferma quando blocchi il telefono". */
export function serveNotaSchermo(): boolean {
  const qui = dispositivo();
  return qui === 'iphone' || qui === 'android_browser';
}

export type ErrorePosizione = 'negata' | 'spenta' | 'tempo_scaduto' | 'non_supportata';

export class ErroreDiPosizione extends Error {
  constructor(readonly motivo: ErrorePosizione) {
    super(motivo);
  }
}

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

function daErroreBrowser(errore: GeolocationPositionError): ErrorePosizione {
  if (errore.code === errore.PERMISSION_DENIED) return 'negata';
  if (errore.code === errore.TIMEOUT) return 'tempo_scaduto';
  return 'spenta';
}

function daErroreNativo(codice: string | undefined): ErrorePosizione {
  return codice === 'NOT_AUTHORIZED' ? 'negata' : 'spenta';
}

/** Stato del permesso nel browser, senza chiederlo; `sconosciuto` nell'app o senza API. */
export async function permessoPosizione(): Promise<
  'concesso' | 'negato' | 'da_chiedere' | 'sconosciuto'
> {
  if (modoPosizione() === 'nativo') return 'sconosciuto';
  try {
    const stato = await navigator.permissions.query({ name: 'geolocation' });
    return stato.state === 'granted'
      ? 'concesso'
      : stato.state === 'denied'
        ? 'negato'
        : 'da_chiedere';
  } catch {
    return 'sconosciuto';
  }
}

export type Ascolto = {
  onPosizione: (coordinate: Coordinate) => void;
  onErrore: (motivo: ErrorePosizione) => void;
  /** Testi della notifica di sistema fissa (solo Android, R-31). */
  notifica: { titolo: string; testo: string };
};

/** Avvia l'ascolto della posizione; restituisce la funzione che lo ferma. */
export async function ascoltaPosizione({
  onPosizione,
  onErrore,
  notifica,
}: Ascolto): Promise<() => void> {
  if (modoPosizione() === 'nativo') {
    const id = await BackgroundGeolocation.addWatcher(
      {
        backgroundTitle: notifica.titolo,
        backgroundMessage: notifica.testo,
        requestPermissions: true,
        stale: false,
        // Nessun filtro di distanza: chi aspetta fermo deve risultare aggiornato; l'invio
        // resta limitato a una posizione ogni 30 secondi (R-31).
        distanceFilter: 0,
      },
      (posizione, errore) => {
        if (errore) onErrore(daErroreNativo(errore.code));
        else if (posizione)
          onPosizione({
            lat: posizione.latitude,
            lon: posizione.longitude,
            precisione: posizione.accuracy,
          });
      },
    );
    return () => void BackgroundGeolocation.removeWatcher({ id });
  }
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    onErrore('non_supportata');
    return () => undefined;
  }
  const id = navigator.geolocation.watchPosition(
    (posizione) =>
      onPosizione({
        lat: posizione.coords.latitude,
        lon: posizione.coords.longitude,
        precisione: posizione.coords.accuracy,
      }),
    (errore) => onErrore(daErroreBrowser(errore)),
    { enableHighAccuracy: true, maximumAge: 15_000, timeout: 60_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** Una posizione sola, per l'avvio e per le aree di arrivo. */
export function posizioneAttuale(): Promise<Coordinate> {
  if (modoPosizione() === 'nativo') {
    return new Promise((risolvi, rifiuta) => {
      let id: string | null = null;
      let fatto = false;
      const fine = () => {
        fatto = true;
        if (id) void BackgroundGeolocation.removeWatcher({ id });
      };
      const timer = window.setTimeout(() => {
        if (!fatto) {
          fine();
          rifiuta(new ErroreDiPosizione('tempo_scaduto'));
        }
      }, 20_000);
      void BackgroundGeolocation.addWatcher(
        { requestPermissions: true, stale: false },
        (posizione, errore) => {
          if (fatto) return;
          window.clearTimeout(timer);
          fine();
          if (errore || !posizione) rifiuta(new ErroreDiPosizione(daErroreNativo(errore?.code)));
          else
            risolvi({
              lat: posizione.latitude,
              lon: posizione.longitude,
              precisione: posizione.accuracy,
            });
        },
      ).then((nuovo) => {
        id = nuovo;
        if (fatto) void BackgroundGeolocation.removeWatcher({ id: nuovo });
      });
    });
  }
  return new Promise((risolvi, rifiuta) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      rifiuta(new ErroreDiPosizione('non_supportata'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posizione) =>
        risolvi({
          lat: posizione.coords.latitude,
          lon: posizione.coords.longitude,
          precisione: posizione.coords.accuracy,
        }),
      (errore) => rifiuta(new ErroreDiPosizione(daErroreBrowser(errore))),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    );
  });
}

/** Apre le impostazioni dell'app nel telefono (solo Android). */
export function apriImpostazioni(): void {
  if (modoPosizione() === 'nativo') void BackgroundGeolocation.openSettings();
}

/** Distanza in metri tra due punti (formula dell'emisenoverso). */
export function distanzaMetri(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const raggio = 6_371_000;
  const rad = (gradi: number) => (gradi * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * raggio * Math.asin(Math.min(1, Math.sqrt(h)));
}
