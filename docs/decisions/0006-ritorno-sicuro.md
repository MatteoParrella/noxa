# ADR-0006: Ritorno sicuro: posizione nativa in background e allerta lato server

- **Stato**: Accettato
- **Data**: 2026-10-12

## Contesto
Il ritorno sicuro deve funzionare anche con il telefono in tasca e lo schermo bloccato, e
l'allerta deve partire anche se il telefono è scarico o spento.

## Decisione
- Posizione in background tramite plugin Capacitor (scelta definitiva D-04), solo durante una
  sessione avviata esplicitamente, con notifica di sistema permanente (R-31).
- Posizioni trasmesse su un canale Realtime Broadcast privato e salvate al massimo ogni 30
  secondi in `posizioni_ritorno`.
- **L'allerta parte dal server**: `pg_cron` esegue ogni minuto
  `private.verifica_ritorni_scaduti()`, che crea le notifiche inviate da `invia-push`.
- Nessun indirizzo di casa sul server; l'arrivo automatico usa un'area salvata solo sul
  dispositivo (R-32).
- Nella PWA la funzione è disponibile solo in primo piano e lo dice chiaramente.

## Alternative considerate
- **Solo PWA con timer**: senza posizione in background il valore per la sicurezza sarebbe
  basso e ingannevole.
- **Allerta generata dal dispositivo**: non partirebbe con il telefono spento o senza rete.

## Conseguenze
- Servono permessi di posizione "sempre" con una spiegazione chiara e la revisione degli
  store per l'uso in background.
- Test su dispositivi reali obbligatori (criteri della Fase 2).
