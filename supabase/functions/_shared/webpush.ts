// Web Push senza dipendenze, solo con WebCrypto (ADR-0026): cifratura del contenuto con
// aes128gcm (RFC 8291 e RFC 8188) e autenticazione VAPID con un JWT ES256 (RFC 8292). Lo usa
// l'Edge Function `invia-push`; non dipende da Deno, così i test girano anche con Vitest.

export type IscrizioneWeb = {
  /** Endpoint del servizio push del browser. */
  endpoint: string;
  /** Chiave pubblica P-256 del browser, non compressa, in base64url. */
  p256dh: string;
  /** Segreto di autenticazione del browser (16 byte) in base64url. */
  auth: string;
};

export type ChiaviVapid = {
  /** Chiave pubblica P-256 non compressa (65 byte) in base64url, la stessa dell'app. */
  pubblica: string;
  /** Parte privata `d` (32 byte) in base64url. */
  privata: string;
  /** Contatto dell'operatore, `mailto:` o `https:`. */
  soggetto: string;
};

/** Byte su un ArrayBuffer ordinario, come li vuole WebCrypto. */
export type Byte = Uint8Array<ArrayBuffer>;

export type Richiesta = { url: string; headers: Record<string, string>; body: Byte };

const testo = new TextEncoder();

export function daBase64Url(valore: string): Byte {
  const base64 = valore.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const binario = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binario, (carattere) => carattere.charCodeAt(0));
}

export function aBase64Url(byte: Byte): string {
  let binario = '';
  for (const b of byte) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unisci(...parti: Byte[]): Byte {
  const risultato = new Uint8Array(parti.reduce((totale, parte) => totale + parte.length, 0));
  let posizione = 0;
  for (const parte of parti) {
    risultato.set(parte, posizione);
    posizione += parte.length;
  }
  return risultato;
}

async function hmac(chiave: Byte, dati: Byte): Promise<Byte> {
  const k = await crypto.subtle.importKey('raw', chiave, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, dati));
}

/** Prima uscita di HKDF-SHA256 (al massimo 32 byte), come nelle RFC 8188 e 8291. */
async function hkdf(sale: Byte, ikm: Byte, info: Byte, lunghezza: number) {
  const prk = await hmac(sale, ikm);
  return (await hmac(prk, unisci(info, new Uint8Array([1])))).slice(0, lunghezza);
}

const DIMENSIONE_RECORD = 4096;

/**
 * Cifra il contenuto per un'iscrizione (RFC 8291 §3.4): un solo record, con la chiave
 * effimera del server nell'intestazione. Il servizio push vede solo il testo cifrato.
 */
export async function cifra(contenuto: Byte, iscrizione: IscrizioneWeb): Promise<Byte> {
  const pubblicaBrowser = daBase64Url(iscrizione.p256dh);
  const segretoAuth = daBase64Url(iscrizione.auth);
  if (pubblicaBrowser.length !== 65 || segretoAuth.length !== 16) {
    throw new Error('chiavi_iscrizione_non_valide');
  }
  if (contenuto.length + 17 + 86 > DIMENSIONE_RECORD) throw new Error('contenuto_troppo_lungo');

  const chiaveBrowser = await crypto.subtle.importKey(
    'raw',
    pubblicaBrowser,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const effimere = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair;
  const pubblicaServer = new Uint8Array(await crypto.subtle.exportKey('raw', effimere.publicKey));
  const segretoEcdh = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: chiaveBrowser }, effimere.privateKey, 256),
  );

  const infoChiave = unisci(testo.encode('WebPush: info\0'), pubblicaBrowser, pubblicaServer);
  const ikm = await hkdf(segretoAuth, segretoEcdh, infoChiave, 32);
  const sale = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sale, ikm, testo.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sale, ikm, testo.encode('Content-Encoding: nonce\0'), 12);

  const chiaveContenuto = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // Delimitatore dell'ultimo record (0x02), senza riempimento.
  const cifrato = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      chiaveContenuto,
      unisci(contenuto, new Uint8Array([2])),
    ),
  );

  const intestazione = new Uint8Array(16 + 4 + 1);
  intestazione.set(sale, 0);
  new DataView(intestazione.buffer).setUint32(16, DIMENSIONE_RECORD);
  intestazione[20] = pubblicaServer.length;
  return unisci(intestazione, pubblicaServer, cifrato);
}

/** Intestazione `Authorization` VAPID per l'origine dell'endpoint, valida 12 ore. */
export async function autorizzazioneVapid(
  endpoint: string,
  chiavi: ChiaviVapid,
  adesso: number = Date.now(),
): Promise<string> {
  const pubblica = daBase64Url(chiavi.pubblica);
  if (pubblica.length !== 65 || pubblica[0] !== 4) throw new Error('chiave_vapid_non_valida');
  const privata = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      d: chiavi.privata,
      x: aBase64Url(pubblica.slice(1, 33)),
      y: aBase64Url(pubblica.slice(33, 65)),
      ext: true,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const json = (oggetto: unknown) => aBase64Url(testo.encode(JSON.stringify(oggetto)));
  const daFirmare = `${json({ typ: 'JWT', alg: 'ES256' })}.${json({
    aud: new URL(endpoint).origin,
    exp: Math.floor(adesso / 1000) + 12 * 60 * 60,
    sub: chiavi.soggetto,
  })}`;
  // WebCrypto restituisce la firma come r || s, il formato del JWT.
  const firma = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privata, testo.encode(daFirmare)),
  );
  return `vapid t=${daFirmare}.${aBase64Url(firma)}, k=${chiavi.pubblica}`;
}

/** Richiesta HTTP completa da inviare al servizio push. */
export async function preparaRichiesta(
  iscrizione: IscrizioneWeb,
  contenuto: unknown,
  chiavi: ChiaviVapid,
  opzioni: { ttlSecondi: number; urgenza: 'normal' | 'high' },
): Promise<Richiesta> {
  const body = await cifra(testo.encode(JSON.stringify(contenuto)), iscrizione);
  return {
    url: iscrizione.endpoint,
    body,
    headers: {
      Authorization: await autorizzazioneVapid(iscrizione.endpoint, chiavi),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(opzioni.ttlSecondi),
      Urgency: opzioni.urgenza,
    },
  };
}
