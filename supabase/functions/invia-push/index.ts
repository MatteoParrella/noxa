// Edge Function `invia-push` (F-22, ARCHITECTURE.md §5.4, ADR-0026, ADR-0027): invia una notifica
// ai dispositivi della persona, con il Web Push ai browser e con FCM all'app Android.
//
// La chiama solo il trigger `private.invia_push` con `pg_net`, con il segreto condiviso
// nell'intestazione `x-noxa-segreto` (la verifica del JWT è spenta in config.toml). Il corpo
// contiene solo `notifica_id`: la funzione rilegge la notifica con la chiave service_role, usata
// solo qui e solo per leggere la notifica e i dispositivi, togliere quelli scaduti e segnare
// l'invio. Il testo è quello di sistema del tipo (`_shared/testi_push.ts`), mai nomi, username o
// testi di altre persone; il contenuto è cifrato per il browser e il servizio push non lo legge.
// FCM riceve lo stesso testo di sistema: senza il segreto `FCM_ACCOUNT_SERVIZIO` i dispositivi
// Android si saltano (in locale e finché il progetto Firebase non esiste).
//
// I log contengono solo esiti e conteggi, mai identificativi o endpoint (R-62).
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { corpoMessaggio, inviaFcm, leggiAccountServizio, tokenAccesso } from '../_shared/fcm.ts';
import { durataPush, testoPush, urgenzaPush } from '../_shared/testi_push.ts';
import { preparaRichiesta, type ChiaviVapid } from '../_shared/webpush.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function risposta(stato: number, corpo: Record<string, unknown>): Response {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function registra(evento: string, dati: Record<string, string | number> = {}): void {
  console.log(JSON.stringify({ funzione: 'invia-push', evento, ...dati }));
}

/** Confronto a tempo costante del segreto condiviso. */
function uguali(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diversi = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diversi |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diversi === 0;
}

Deno.serve(async (richiesta) => {
  if (richiesta.method !== 'POST') return risposta(405, { errore: 'metodo_non_ammesso' });

  const segreto = Deno.env.get('NOXA_PUSH_SEGRETO') ?? '';
  const url = Deno.env.get('SUPABASE_URL');
  const chiaveServizio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapid: ChiaviVapid = {
    pubblica: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
    privata: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
    soggetto: Deno.env.get('VAPID_SUBJECT') ?? '',
  };
  if (!segreto || !url || !chiaveServizio || !vapid.pubblica || !vapid.privata || !vapid.soggetto) {
    registra('configurazione_mancante');
    return risposta(500, { errore: 'configurazione_mancante' });
  }
  if (!uguali(richiesta.headers.get('x-noxa-segreto') ?? '', segreto)) {
    return risposta(401, { errore: 'non_autorizzato' });
  }

  let notificaId: unknown;
  try {
    ({ notifica_id: notificaId } = (await richiesta.json()) as { notifica_id?: unknown });
  } catch {
    return risposta(400, { errore: 'richiesta_non_valida' });
  }
  if (typeof notificaId !== 'string' || !UUID.test(notificaId)) {
    return risposta(400, { errore: 'richiesta_non_valida' });
  }

  const db = createClient(url, chiaveServizio, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: notifica, error: erroreNotifica } = await db
    .from('notifiche')
    .select('id, utente_id, tipo, dati, inviata_push_il')
    .eq('id', notificaId)
    .maybeSingle();
  if (erroreNotifica) {
    registra('errore_database', { codice: erroreNotifica.code ?? 'sconosciuto' });
    return risposta(500, { errore: 'non_riuscita' });
  }
  // Già inviata, oppure tolta nel frattempo (richiesta annullata, blocco, destinatario tolto).
  if (!notifica || notifica.inviata_push_il) return risposta(200, { esito: 'saltata' });

  const testo = testoPush(notifica.tipo, (notifica.dati ?? {}) as Record<string, unknown>);
  if (!testo) {
    registra('tipo_senza_testo', { tipo: notifica.tipo });
    return risposta(200, { esito: 'saltata' });
  }

  const { data: dispositivi, error: erroreDispositivi } = await db
    .from('dispositivi_push')
    .select('id, piattaforma, token, chiave_p256dh, chiave_auth')
    .eq('utente_id', notifica.utente_id)
    .in('piattaforma', ['web', 'android']);
  if (erroreDispositivi) {
    registra('errore_database', { codice: erroreDispositivi.code ?? 'sconosciuto' });
    return risposta(500, { errore: 'non_riuscita' });
  }

  const contenuto = { ...testo, notifica: notifica.id, tipo: notifica.tipo };
  const opzioni = { ttlSecondi: durataPush(notifica.tipo), urgenza: urgenzaPush(notifica.tipo) };
  const scaduti: string[] = [];
  let inviate = 0;
  let fallite = 0;
  const web = (dispositivi ?? []).filter((d) => d.piattaforma === 'web');
  const android = (dispositivi ?? []).filter((d) => d.piattaforma === 'android');
  await Promise.all(
    web.map(async (dispositivo) => {
      if (!dispositivo.chiave_p256dh || !dispositivo.chiave_auth) return;
      try {
        const invio = await preparaRichiesta(
          { endpoint: dispositivo.token, p256dh: dispositivo.chiave_p256dh, auth: dispositivo.chiave_auth },
          contenuto,
          vapid,
          opzioni,
        );
        const esito = await fetch(invio.url, {
          method: 'POST',
          headers: invio.headers,
          body: invio.body,
          signal: AbortSignal.timeout(10_000),
        });
        await esito.body?.cancel();
        if (esito.status === 404 || esito.status === 410) scaduti.push(dispositivo.id);
        else if (esito.ok) inviate++;
        else {
          fallite++;
          registra('servizio_push_errore', { stato: esito.status });
        }
      } catch (errore) {
        fallite++;
        registra('invio_non_riuscito', { errore: errore instanceof Error ? errore.name : 'sconosciuto' });
      }
    }),
  );

  if (android.length > 0) {
    const account = leggiAccountServizio(Deno.env.get('FCM_ACCOUNT_SERVIZIO'));
    if (!account) {
      registra('fcm_non_configurato', { dispositivi: android.length });
    } else {
      try {
        const accesso = await tokenAccesso(account);
        await Promise.all(
          android.map(async (dispositivo) => {
            try {
              const { esito, stato } = await inviaFcm(
                account.project_id,
                accesso,
                corpoMessaggio(dispositivo.token, testo, { notifica: notifica.id, tipo: notifica.tipo }, opzioni),
              );
              if (esito === 'scaduto') scaduti.push(dispositivo.id);
              else if (esito === 'inviata') inviate++;
              else {
                fallite++;
                registra('fcm_errore', { stato });
              }
            } catch (errore) {
              fallite++;
              registra('invio_non_riuscito', { errore: errore instanceof Error ? errore.name : 'sconosciuto' });
            }
          }),
        );
      } catch (errore) {
        fallite += android.length;
        registra('fcm_token_non_riuscito', { errore: errore instanceof Error ? errore.message : 'sconosciuto' });
      }
    }
  }

  if (scaduti.length > 0) await db.from('dispositivi_push').delete().in('id', scaduti);
  if (inviate > 0) {
    await db.from('notifiche').update({ inviata_push_il: new Date().toISOString() }).eq('id', notifica.id);
  }
  registra('completata', { inviate, fallite, scaduti: scaduti.length });
  return risposta(200, { esito: 'completata', inviate, fallite, scaduti: scaduti.length });
});
