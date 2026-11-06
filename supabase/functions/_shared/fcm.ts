// Notifiche native Android con Firebase Cloud Messaging, API HTTP v1 (ADR-0027). Il token di
// accesso si ottiene dall'account di servizio del progetto Firebase gratuito, firmando un JWT
// RS256 con WebCrypto (nessuna libreria esterna). Il messaggio contiene solo il testo di sistema
// del tipo e gli identificativi della notifica, come il Web Push (ADR-0026).

import type { TestoPush } from './testi_push.ts';

export type AccountServizio = { client_email: string; private_key: string; project_id: string };

const AMBITO = 'https://www.googleapis.com/auth/firebase.messaging';
const URL_TOKEN = 'https://oauth2.googleapis.com/token';

const base64Url = (byte: Uint8Array): string => {
  let binario = '';
  for (const b of byte) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const testoBase64Url = (testo: string) => base64Url(new TextEncoder().encode(testo));

/** Legge l'account di servizio dal segreto `FCM_ACCOUNT_SERVIZIO` (JSON), o null se non valido. */
export function leggiAccountServizio(json: string | undefined): AccountServizio | null {
  if (!json) return null;
  try {
    const dati = JSON.parse(json) as Partial<AccountServizio>;
    if (
      typeof dati.client_email === 'string' &&
      typeof dati.private_key === 'string' &&
      typeof dati.project_id === 'string' &&
      /^[a-z0-9-]{4,40}$/.test(dati.project_id)
    ) {
      return { client_email: dati.client_email, private_key: dati.private_key, project_id: dati.project_id };
    }
  } catch {
    return null;
  }
  return null;
}

async function chiavePrivata(pem: string): Promise<CryptoKey> {
  const corpo = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\\n/g, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(corpo), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

/** JWT dell'account di servizio per lo scambio con un token di accesso (RFC 7523). */
export async function firmaJwt(account: AccountServizio, adessoSecondi: number): Promise<string> {
  const intestazione = testoBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const richieste = testoBase64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: AMBITO,
      aud: URL_TOKEN,
      iat: adessoSecondi,
      exp: adessoSecondi + 3600,
    }),
  );
  const daFirmare = `${intestazione}.${richieste}`;
  const firma = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    await chiavePrivata(account.private_key),
    new TextEncoder().encode(daFirmare),
  );
  return `${daFirmare}.${base64Url(new Uint8Array(firma))}`;
}

/** Token di accesso per FCM, valido un'ora. */
export async function tokenAccesso(account: AccountServizio): Promise<string> {
  const jwt = await firmaJwt(account, Math.floor(Date.now() / 1000));
  const esito = await fetch(URL_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!esito.ok) {
    await esito.body?.cancel();
    throw new Error(`token_fcm_${esito.status}`);
  }
  const { access_token: token } = (await esito.json()) as { access_token?: unknown };
  if (typeof token !== 'string') throw new Error('token_fcm_assente');
  return token;
}

/** Corpo del messaggio FCM per un dispositivo: testo di sistema e identificativi. */
export function corpoMessaggio(
  token: string,
  testo: TestoPush,
  dati: { notifica: string; tipo: string },
  opzioni: { ttlSecondi: number; urgenza: 'normal' | 'high' },
): Record<string, unknown> {
  return {
    message: {
      token,
      notification: { title: testo.titolo, body: testo.testo },
      data: { notifica: dati.notifica, tipo: dati.tipo },
      android: {
        priority: opzioni.urgenza === 'high' ? 'HIGH' : 'NORMAL',
        ttl: `${opzioni.ttlSecondi}s`,
        notification: { channel_id: dati.tipo.startsWith('ritorno_') ? 'ritorno' : 'noxa' },
      },
    },
  };
}

export type EsitoFcm = 'inviata' | 'scaduto' | 'errore';

/** Invia un messaggio; `scaduto` se il token non è più registrato (va tolto). */
export async function inviaFcm(
  progetto: string,
  accesso: string,
  corpo: Record<string, unknown>,
): Promise<{ esito: EsitoFcm; stato: number }> {
  const esito = await fetch(`https://fcm.googleapis.com/v1/projects/${progetto}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accesso}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(10_000),
  });
  if (esito.ok) {
    await esito.body?.cancel();
    return { esito: 'inviata', stato: esito.status };
  }
  const testo = await esito.text();
  // FCM risponde 404 UNREGISTERED (o 400 con il token non valido) per un'app disinstallata.
  const scaduto =
    esito.status === 404 || (esito.status === 400 && /UNREGISTERED|registration token/i.test(testo));
  return { esito: scaduto ? 'scaduto' : 'errore', stato: esito.status };
}
