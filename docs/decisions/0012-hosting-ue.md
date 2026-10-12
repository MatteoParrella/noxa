# ADR-0012: Hosting nell'Unione Europea

- **Stato**: Accettato
- **Data**: 2026-10-12

## Contesto
I dati personali, compresi quelli di minorenni e posizioni, devono restare nell'UE (R-66).

## Decisione
- Supabase gestito, regione `eu-central-1` (Francoforte), progetti separati per staging e
  produzione, piano con Point-in-Time Recovery in produzione.
- PWA statica su Vercel con funzioni disattivate (solo file statici, distribuiti da CDN).
- Worker su Fly.io, regione `fra`.
- Sentry nella regione UE.

## Alternative considerate
- **Self-hosting su VPS UE**: costi più bassi ma più lavoro operativo e responsabilità di
  sicurezza, sproporzionati per il team iniziale.

## Conseguenze
- Restano trasferimenti extra-UE per Anthropic, Meta e Google (FCM), da coprire con accordi e
  garanzie (D-07, D-12).
