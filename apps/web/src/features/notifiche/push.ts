import { Capacitor } from '@capacitor/core';
import { z } from 'zod';
import { chiaveVapidPubblica } from '@/lib/ambiente';
import { converti } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import { registraErrore } from '@/lib/registro';
import { supabase } from '@/lib/supabase';
import {
  attivaNativo,
  disattivaNativo,
  fcmDisponibile,
  permessoNativo,
  tokenRinnovato,
  tokenSalvato,
} from './pushNativo';

/**
 * Notifiche sul telefono con il Web Push della PWA (F-22, ADR-0026). Il permesso del sistema
 * si chiede solo dopo il tocco su "Attiva" nel foglio di Noxa; l'iscrizione del browser si
 * registra con la RPC `registra_dispositivo_push`. Nell'app Android le notifiche passano da FCM
 * (ADR-0027, `pushNativo.ts`) con gli stessi testi di sistema.
 */

const testi = messaggi.push.dispositivo;

/** Cosa si può fare su questo dispositivo, prima di qualsiasi richiesta. */
export type StatoPush =
  'non_compatibile' | 'iphone_da_installare' | 'negato' | 'da_chiedere' | 'concesso';

function eIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function eInstallata(): boolean {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || window.matchMedia('(display-mode: standalone)').matches;
}

export function statoPush(): StatoPush {
  if (typeof window === 'undefined') return 'non_compatibile';
  if (Capacitor.isNativePlatform()) return fcmDisponibile() ? permessoNativo() : 'non_compatibile';
  // Su iPhone il Web Push esiste solo nell'app aggiunta alla schermata Home.
  if (eIos() && !eInstallata()) return 'iphone_da_installare';
  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window) ||
    !chiaveVapidPubblica()
  )
    return 'non_compatibile';
  if (Notification.permission === 'denied') return 'negato';
  return Notification.permission === 'granted' ? 'concesso' : 'da_chiedere';
}

/**
 * Etichetta generica del dispositivo (R-66, dati minimi): sistema e browser, mai modello né
 * versione.
 */
export function descrizioneDispositivo(ua: string, installata: boolean): string {
  const mobile = /Android|iPhone|iPad|iPod|Mobile/.test(ua);
  if (installata && mobile) return testi.home;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /SamsungBrowser/.test(ua)
      ? 'Samsung Internet'
      : /OPR\//.test(ua)
        ? 'Opera'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Chrome\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : null;
  if (!browser) return testi.generico;
  if (/Android/.test(ua)) return testi.browser('Android', browser);
  if (/iPhone|iPad|iPod/.test(ua)) return testi.browser('iPhone', browser);
  return testi.computer(browser);
}

/** Il service worker che riceve le notifiche: quello della PWA, o solo il gestore in sviluppo. */
async function registrazioneServiceWorker(): Promise<ServiceWorkerRegistration> {
  const esistente = await navigator.serviceWorker.getRegistration();
  if (!esistente) {
    await navigator.serviceWorker.register(
      process.env.NODE_ENV === 'production' ? '/sw.js' : '/sw-push.js',
    );
  }
  return navigator.serviceWorker.ready;
}

function chiaveApplicazione(): Uint8Array<ArrayBuffer> {
  const base64 = (chiaveVapidPubblica() ?? '').replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binario, (carattere) => carattere.charCodeAt(0));
}

/** Iscrizione Web Push già presente su questo dispositivo, o null. */
export async function iscrizioneCorrente(): Promise<PushSubscription | null> {
  if (Capacitor.isNativePlatform()) return null;
  if (statoPush() === 'non_compatibile' || statoPush() === 'iphone_da_installare') return null;
  const registrazione = await navigator.serviceWorker.getRegistration();
  return (await registrazione?.pushManager.getSubscription()) ?? null;
}

async function registra(iscrizione: PushSubscription): Promise<void> {
  const dati = iscrizione.toJSON();
  const { error } = await supabase().rpc('registra_dispositivo_push', {
    piattaforma: 'web',
    token: iscrizione.endpoint,
    chiave_p256dh: dati.keys?.p256dh ?? '',
    chiave_auth: dati.keys?.auth ?? '',
    descrizione: descrizioneDispositivo(navigator.userAgent, eInstallata()),
  });
  if (error) throw converti(error);
}

export type EsitoAttivazione = 'attivate' | 'negato' | 'non_compatibile' | 'iphone_da_installare';

/**
 * Chiede il permesso (solo dopo il tocco su "Attiva"), iscrive il browser e registra il
 * dispositivo. Un errore della registrazione arriva come eccezione, per il "Riprova".
 */
async function registraNativo(token: string): Promise<void> {
  const { error } = await supabase().rpc('registra_dispositivo_push', {
    piattaforma: 'android',
    token,
    // Le chiavi servono solo al Web Push: la RPC accetta null, il tipo generato non lo dice.
    chiave_p256dh: null as unknown as string,
    chiave_auth: null as unknown as string,
    descrizione: testi.app,
  });
  if (error) throw converti(error);
}

export async function attivaPush(): Promise<EsitoAttivazione> {
  if (Capacitor.isNativePlatform()) {
    if (!fcmDisponibile()) return 'non_compatibile';
    const token = await attivaNativo();
    if (!token) return 'negato';
    await registraNativo(token);
    return 'attivate';
  }
  const stato = statoPush();
  if (stato === 'non_compatibile' || stato === 'iphone_da_installare') return stato;
  if (stato === 'negato') return 'negato';
  const permesso = await Notification.requestPermission();
  if (permesso !== 'granted') return permesso === 'denied' ? 'negato' : 'non_compatibile';
  const registrazione = await registrazioneServiceWorker();
  const iscrizione =
    (await registrazione.pushManager.getSubscription()) ??
    (await registrazione.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chiaveApplicazione(),
    }));
  await registra(iscrizione);
  return 'attivate';
}

/** Spegne le notifiche su questo dispositivo: toglie la riga e annulla l'iscrizione. */
export async function disattivaPushQui(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const token = tokenSalvato();
    if (!token) return;
    const { error } = await supabase().from('dispositivi_push').delete().eq('token', token);
    if (error) throw converti(error);
    await disattivaNativo();
    return;
  }
  const iscrizione = await iscrizioneCorrente();
  if (!iscrizione) return;
  const { error } = await supabase()
    .from('dispositivi_push')
    .delete()
    .eq('token', iscrizione.endpoint);
  if (error) throw converti(error);
  await iscrizione.unsubscribe();
}

/**
 * All'uscita dall'account le notifiche di questa persona non devono più arrivare qui: si
 * toglie il dispositivo prima di chiudere la sessione. Un errore non blocca l'uscita.
 */
export async function scollegaDispositivoAllUscita(): Promise<void> {
  try {
    await disattivaPushQui();
  } catch (errore) {
    registraErrore('dispositivo push all’uscita', errore);
  }
}

/**
 * All'apertura dell'app rinnova il dispositivo (ultimo uso, chiavi cambiate dal browser): i
 * dispositivi non usati da 90 giorni si tolgono da soli (SAFETY_PRIVACY.md §10).
 */
export async function rinnovaDispositivo(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    if (!fcmDisponibile()) return;
    const token = await tokenRinnovato();
    if (token) await registraNativo(token);
    return;
  }
  if (statoPush() !== 'concesso') return;
  const iscrizione = await iscrizioneCorrente();
  if (iscrizione) await registra(iscrizione);
}

const SchemaDispositivo = z.object({
  id: z.uuid(),
  token: z.string(),
  descrizione: z.string().nullable(),
  ultimo_uso_il: z.string(),
});
export type Dispositivo = z.infer<typeof SchemaDispositivo> & { questo: boolean };

/** I propri dispositivi con le notifiche attive, "Questo dispositivo" in cima. */
export async function leggiDispositivi(): Promise<Dispositivo[]> {
  const [{ data, error }, iscrizione] = await Promise.all([
    supabase()
      .from('dispositivi_push')
      .select('id, token, descrizione, ultimo_uso_il')
      .order('ultimo_uso_il', { ascending: false }),
    iscrizioneCorrente().catch(() => null),
  ]);
  if (error) throw converti(error);
  const righe = z.array(SchemaDispositivo).safeParse(data);
  if (!righe.success) throw converti(righe.error);
  const questo = Capacitor.isNativePlatform() ? tokenSalvato() : (iscrizione?.endpoint ?? null);
  return righe.data
    .map((riga) => ({ ...riga, questo: riga.token === questo }))
    .sort((a, b) => Number(b.questo) - Number(a.questo));
}

/** Toglie un dispositivo; se è questo, annulla anche l'iscrizione del browser. */
export async function togliDispositivo(dispositivo: Dispositivo): Promise<void> {
  const { error } = await supabase().from('dispositivi_push').delete().eq('id', dispositivo.id);
  if (error) throw converti(error);
  if (dispositivo.questo && Capacitor.isNativePlatform()) await disattivaNativo();
  else if (dispositivo.questo) await (await iscrizioneCorrente())?.unsubscribe();
}
