import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

/**
 * Notifiche native dell'app Android con FCM (ADR-0027): stessi testi di sistema del Web Push
 * (ADR-0026). Funzionano solo nella build con il file `google-services.json` del progetto
 * Firebase gratuito, segnalata da `NEXT_PUBLIC_FCM_ATTIVO=true`: senza, `register()` farebbe
 * chiudere l'app, quindi non si chiama. Il token resta anche sul telefono per riconoscere
 * "Questo dispositivo" e toglierlo all'uscita dall'account.
 */

const CHIAVE_TOKEN = 'noxa-token-fcm';
/** Evento con l'id della notifica toccata: lo ascolta `RinnovaDispositivo`, che naviga. */
export const EVENTO_APRI_NOTIFICA = 'noxa:apri-notifica';

export function fcmDisponibile(): boolean {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'android' &&
    process.env.NEXT_PUBLIC_FCM_ATTIVO === 'true'
  );
}

export function tokenSalvato(): string | null {
  try {
    return window.localStorage.getItem(CHIAVE_TOKEN);
  } catch {
    return null;
  }
}

function salvaToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(CHIAVE_TOKEN, token);
    else window.localStorage.removeItem(CHIAVE_TOKEN);
  } catch {
    // Senza storage "Questo dispositivo" non si riconosce: le notifiche arrivano lo stesso.
  }
}

let permesso: 'concesso' | 'negato' | 'da_chiedere' = 'da_chiedere';

/** Ultimo stato noto del permesso (aggiornato da `aggiornaPermessoNativo`). */
export function permessoNativo(): 'concesso' | 'negato' | 'da_chiedere' {
  return permesso;
}

export async function aggiornaPermessoNativo(): Promise<void> {
  if (!fcmDisponibile()) return;
  const { receive } = await PushNotifications.checkPermissions();
  permesso = receive === 'granted' ? 'concesso' : receive === 'denied' ? 'negato' : 'da_chiedere';
}

/** Token FCM di questo telefono: chiede la registrazione e aspetta l'evento (al massimo 15 s). */
async function ottieniToken(): Promise<string> {
  return await new Promise<string>((risolvi, rifiuta) => {
    const timer = window.setTimeout(() => rifiuta(new Error('token_fcm_tempo_scaduto')), 15_000);
    void Promise.all([
      PushNotifications.addListener('registration', ({ value }) => {
        window.clearTimeout(timer);
        risolvi(value);
      }),
      PushNotifications.addListener('registrationError', () => {
        window.clearTimeout(timer);
        rifiuta(new Error('token_fcm_non_ottenuto'));
      }),
    ]).then(() => PushNotifications.register());
  }).finally(() => {
    void PushNotifications.removeAllListeners().then(ascoltaTocchi);
  });
}

/** Chiede il permesso (dopo il tocco su "Attiva") e restituisce il token, o null se negato. */
export async function attivaNativo(): Promise<string | null> {
  const { receive } = await PushNotifications.requestPermissions();
  permesso = receive === 'granted' ? 'concesso' : receive === 'denied' ? 'negato' : 'da_chiedere';
  if (receive !== 'granted') return null;
  const token = await ottieniToken();
  salvaToken(token);
  return token;
}

/** Rinnovo all'apertura: il token può cambiare, l'ultimo uso si aggiorna. */
export async function tokenRinnovato(): Promise<string | null> {
  await aggiornaPermessoNativo();
  if (permesso !== 'concesso') return null;
  const token = await ottieniToken();
  salvaToken(token);
  return token;
}

export async function disattivaNativo(): Promise<void> {
  salvaToken(null);
  await PushNotifications.unregister().catch(() => undefined);
}

/** Toccando una notifica si apre l'elenco con quella notifica (come il Web Push). */
export async function ascoltaTocchi(): Promise<void> {
  if (!fcmDisponibile()) return;
  await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const id = (notification.data as Record<string, unknown> | undefined)?.notifica;
    if (typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id))
      window.dispatchEvent(new CustomEvent(EVENTO_APRI_NOTIFICA, { detail: id }));
  });
}
