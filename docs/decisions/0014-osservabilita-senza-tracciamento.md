# ADR-0014: Osservabilità senza tracciamento degli utenti

- **Stato**: Accettato
- **Data**: 2026-10-12

## Contesto
Servono errori, log e metriche di prodotto, ma gli utenti sono in parte minorenni e non si
vuole alcuna profilazione (R-61, R-62).

## Decisione
- Sentry (regione UE) per errori e prestazioni di app e worker, con `beforeSend` che rimuove
  email, coordinate e testi liberi; identificativo utente pseudonimo.
- Log JSON strutturati senza dati personali.
- Metriche di prodotto come aggregati SQL (`private.metriche_settimanali`) leggibili solo
  dagli amministratori.
- Nessun SDK di analytics o di attribuzione di terze parti.

## Alternative considerate
- **Strumenti di product analytics (Mixpanel, Amplitude, PostHog)**: tracciano eventi per
  utente e richiederebbero consenso e valutazioni aggiuntive per i minorenni.

## Conseguenze
- Analisi di prodotto meno granulari; gli esperimenti A/B, se servono, richiederanno un ADR.
