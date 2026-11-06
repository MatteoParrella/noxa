// @vitest-environment node
// Web Push dell'Edge Function invia-push (ADR-0026): cifratura aes128gcm verificata decifrando
// con un'implementazione indipendente di node:crypto (RFC 8291), firma VAPID verificata con la
// chiave pubblica, testi sulla schermata di blocco senza nomi né username (F-22).
import {
  createDecipheriv,
  createECDH,
  createHmac,
  generateKeyPairSync,
  randomBytes,
  verify,
} from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  corpoMessaggio,
  firmaJwt,
  leggiAccountServizio,
} from '../../../../supabase/functions/_shared/fcm';
import {
  TUTTI_I_TESTI,
  durataPush,
  testoPush,
  urgenzaPush,
} from '../../../../supabase/functions/_shared/testi_push';
import {
  aBase64Url,
  autorizzazioneVapid,
  cifra,
  daBase64Url,
  preparaRichiesta,
} from '../../../../supabase/functions/_shared/webpush';

const b64 = (buffer: Buffer) => buffer.toString('base64url');

function hkdf(sale: Buffer, ikm: Buffer, info: Buffer, lunghezza: number): Buffer {
  const prk = createHmac('sha256', sale).update(ikm).digest();
  return createHmac('sha256', prk)
    .update(Buffer.concat([info, Buffer.from([1])]))
    .digest()
    .subarray(0, lunghezza);
}

/** Decifratura del browser secondo la RFC 8291, scritta da zero con node:crypto. */
function decifra(corpo: Uint8Array, browser: ReturnType<typeof createECDH>, auth: Buffer): string {
  const dati = Buffer.from(corpo);
  const sale = dati.subarray(0, 16);
  const lunghezzaChiave = dati.readUInt8(20);
  const pubblicaServer = dati.subarray(21, 21 + lunghezzaChiave);
  const cifrato = dati.subarray(21 + lunghezzaChiave);
  const ecdh = browser.computeSecret(pubblicaServer);
  const info = Buffer.concat([
    Buffer.from('WebPush: info\0'),
    browser.getPublicKey(),
    pubblicaServer,
  ]);
  const ikm = hkdf(auth, ecdh, info, 32);
  const cek = hkdf(sale, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(sale, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
  const decifratore = createDecipheriv('aes-128-gcm', cek, nonce);
  decifratore.setAuthTag(cifrato.subarray(cifrato.length - 16));
  const chiaro = Buffer.concat([
    decifratore.update(cifrato.subarray(0, cifrato.length - 16)),
    decifratore.final(),
  ]);
  expect(chiaro[chiaro.length - 1]).toBe(2);
  return chiaro.subarray(0, chiaro.length - 1).toString('utf8');
}

function iscrizione() {
  const browser = createECDH('prime256v1');
  browser.generateKeys();
  const auth = randomBytes(16);
  return {
    browser,
    auth,
    dati: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/prova',
      p256dh: b64(browser.getPublicKey()),
      auth: b64(auth),
    },
  };
}

function chiaviVapid() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = privateKey.export({ format: 'jwk' });
  const pubblica = Buffer.concat([
    Buffer.from([4]),
    Buffer.from(jwk.x ?? '', 'base64url'),
    Buffer.from(jwk.y ?? '', 'base64url'),
  ]);
  return {
    chiavePubblica: publicKey,
    chiavi: { pubblica: b64(pubblica), privata: jwk.d ?? '', soggetto: 'mailto:prova@example.com' },
  };
}

describe('Web Push', () => {
  it('base64url va e torna', () => {
    const byte = new Uint8Array([0, 250, 251, 252, 253, 254, 255]);
    expect(daBase64Url(aBase64Url(byte))).toEqual(byte);
  });

  it('cifra il contenuto in modo che solo il browser lo legga', async () => {
    const { browser, auth, dati } = iscrizione();
    const testo = JSON.stringify({ titolo: 'Un amico ha fatto check-in' });
    const corpo = await cifra(new TextEncoder().encode(testo), dati);
    expect(Buffer.from(corpo).readUInt32BE(16)).toBe(4096);
    expect(Buffer.from(corpo).includes(Buffer.from('check-in'))).toBe(false);
    expect(decifra(corpo, browser, auth)).toBe(testo);
  });

  it('rifiuta chiavi di iscrizione non valide', async () => {
    const { dati } = iscrizione();
    await expect(cifra(new Uint8Array([1]), { ...dati, auth: 'AAAA' })).rejects.toThrow(
      'chiavi_iscrizione_non_valide',
    );
  });

  it('firma il JWT VAPID per l’origine dell’endpoint', async () => {
    const { chiavePubblica, chiavi } = chiaviVapid();
    const adesso = Date.UTC(2026, 10, 5, 22, 0, 0);
    const intestazione = await autorizzazioneVapid(
      'https://fcm.googleapis.com/fcm/send/abc',
      chiavi,
      adesso,
    );
    const [, jwt = '', k = ''] = /^vapid t=([^,]+), k=(.+)$/.exec(intestazione) ?? [];
    expect(k).toBe(chiavi.pubblica);
    const [testata = '', carico = '', firma = ''] = jwt.split('.');
    expect(JSON.parse(Buffer.from(carico, 'base64url').toString())).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: adesso / 1000 + 12 * 3600,
      sub: 'mailto:prova@example.com',
    });
    const valida = verify(
      'sha256',
      Buffer.from(`${testata}.${carico}`),
      { key: chiavePubblica, dsaEncoding: 'ieee-p1363' },
      Buffer.from(firma, 'base64url'),
    );
    expect(valida).toBe(true);
  });

  it('prepara la richiesta con le intestazioni del protocollo', async () => {
    const { browser, auth, dati } = iscrizione();
    const { chiavi } = chiaviVapid();
    const invio = await preparaRichiesta(dati, { titolo: 'Prova' }, chiavi, {
      ttlSecondi: 21600,
      urgenza: 'normal',
    });
    expect(invio.url).toBe(dati.endpoint);
    expect(invio.headers).toMatchObject({
      'Content-Encoding': 'aes128gcm',
      TTL: '21600',
      Urgency: 'normal',
    });
    expect(JSON.parse(decifra(invio.body, browser, auth))).toEqual({ titolo: 'Prova' });
  });
});

describe('Testi sulla schermata di blocco (F-22)', () => {
  const tipi = [
    'richiesta_amicizia',
    'amicizia_accettata',
    'invito_gruppo',
    'nuova_serata',
    'aggiornamento_serata',
    'checkin_amico',
    'ritorno_avviato',
    'ritorno_allerta',
    'ritorno_arrivato',
    'esito_moderazione',
    'rimozione_gruppo',
    'badge_ottenuto',
    'riepilogo_pronto',
  ];
  // Dati come quelli delle notifiche, con nomi e testi che non devono mai uscire.
  const dati = {
    utente_id: '00000000-0000-4000-8000-000000000015',
    username: 'giulia.r',
    nome_visualizzato: 'Giulia R.',
    nome_gruppo: 'Sabato al Binario 7',
    locale: 'Binario 7',
    motivazione: 'Il flyer di Marco B. non era leggibile',
    esito: 'flyer_rifiutato',
  };

  it('ogni tipo ha un testo di sistema', () => {
    for (const tipo of tipi) expect(testoPush(tipo, dati), tipo).not.toBeNull();
    expect(testoPush('tipo_sconosciuto', {})).toBeNull();
  });

  it('nessun nome, username, locale o testo di altri finisce nel testo', () => {
    for (const tipo of tipi) {
      const risultato = JSON.stringify(testoPush(tipo, dati));
      for (const valore of Object.values(dati).filter((v) => v !== 'flyer_rifiutato'))
        expect(risultato, tipo).not.toContain(valore);
      expect(risultato, tipo).not.toMatch(/@/);
    }
    for (const t of TUTTI_I_TESTI) expect(`${t.titolo} ${t.testo}`).not.toMatch(/@|\{|\}/);
  });

  it('gli esiti di moderazione hanno un titolo per esito, con un ripiego generico', () => {
    expect(testoPush('esito_moderazione', { esito: 'flyer_pubblicato' })?.titolo).toBe(
      'Il tuo flyer è stato pubblicato',
    );
    expect(testoPush('esito_moderazione', { esito: 'Testo scritto da qualcuno' })?.titolo).toBe(
      'Novità dalla moderazione',
    );
  });

  it('nessuna pressione sociale né richiami (R-43)', () => {
    for (const t of TUTTI_I_TESTI)
      expect(`${t.titolo} ${t.testo}`).not.toMatch(/tutti i tuoi amici|non ti vediamo|e tu\?/i);
  });

  it('durata e urgenza dipendono dal tipo', () => {
    expect(durataPush('checkin_amico')).toBe(6 * 3600);
    expect(durataPush('richiesta_amicizia')).toBe(24 * 3600);
    expect(urgenzaPush('ritorno_allerta')).toBe('high');
    expect(urgenzaPush('checkin_amico')).toBe('normal');
  });
});

describe('FCM per l’app Android (ADR-0027)', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const account = {
    client_email: 'noxa@noxa-prova.iam.gserviceaccount.com',
    private_key: pem,
    project_id: 'noxa-prova',
  };

  it('legge l’account di servizio solo se completo', () => {
    expect(leggiAccountServizio(JSON.stringify(account))).toEqual(account);
    expect(leggiAccountServizio(undefined)).toBeNull();
    expect(leggiAccountServizio('non è json')).toBeNull();
    expect(leggiAccountServizio(JSON.stringify({ ...account, project_id: '../altro' }))).toBeNull();
  });

  it('firma il JWT RS256 con l’ambito di FCM e una scadenza di un’ora', async () => {
    const jwt = await firmaJwt(account, 1_800_000_000);
    const [intestazione, richieste, firma] = jwt.split('.') as [string, string, string];
    expect(JSON.parse(Buffer.from(intestazione, 'base64url').toString())).toEqual({
      alg: 'RS256',
      typ: 'JWT',
    });
    expect(JSON.parse(Buffer.from(richieste, 'base64url').toString())).toEqual({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1_800_000_000,
      exp: 1_800_003_600,
    });
    expect(
      verify(
        'sha256',
        Buffer.from(`${intestazione}.${richieste}`),
        publicKey,
        Buffer.from(firma, 'base64url'),
      ),
    ).toBe(true);
  });

  it('il messaggio contiene solo il testo di sistema e gli identificativi', () => {
    const testo = testoPush('ritorno_allerta', { utente_id: 'x' });
    expect(testo).not.toBeNull();
    const corpo = corpoMessaggio(
      'token-del-telefono',
      testo!,
      { notifica: '00000000-0000-4000-8000-000000000001', tipo: 'ritorno_allerta' },
      { ttlSecondi: 21600, urgenza: urgenzaPush('ritorno_allerta') },
    );
    expect(corpo).toEqual({
      message: {
        token: 'token-del-telefono',
        notification: { title: testo!.titolo, body: testo!.testo },
        data: { notifica: '00000000-0000-4000-8000-000000000001', tipo: 'ritorno_allerta' },
        android: { priority: 'HIGH', ttl: '21600s', notification: { channel_id: 'ritorno' } },
      },
    });
  });
});
