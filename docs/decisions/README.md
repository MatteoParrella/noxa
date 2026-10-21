# Architecture Decision Records

Ogni decisione tecnica importante ha un ADR breve: contesto, decisione, alternative,
conseguenze. Per crearne uno nuovo si copia [0000-modello-adr.md](0000-modello-adr.md) con il
numero successivo. Un ADR accettato non si modifica: si scrive un nuovo ADR che lo sostituisce
e si aggiorna lo stato del precedente in "Sostituito da ADR-NNNN".

Le decisioni ancora aperte sono in [../DECISIONI_APERTE.md](../DECISIONI_APERTE.md).

| ADR | Titolo | Stato |
|---|---|---|
| [0001](0001-export-statico-nextjs-capacitor.md) | Next.js in export statico con Capacitor | Accettato |
| [0002](0002-supabase-rls-autorizzazione.md) | Supabase con Row Level Security come unico punto di autorizzazione | Accettato |
| [0003](0003-worker-python-coda-postgres.md) | Worker Python separato con coda su Postgres | Accettato |
| [0004](0004-mappe-maplibre-pmtiles.md) | Mappe con MapLibre e PMTiles | Sostituito da ADR-0016 |
| [0005](0005-eta-minima-numerica-data-nascita.md) | Età minima numerica per evento e data di nascita | Accettato |
| [0006](0006-ritorno-sicuro.md) | Ritorno sicuro: posizione nativa in background e allerta lato server | Accettato |
| [0007](0007-estrazione-flyer-claude-api.md) | Estrazione dei flyer con Claude API e output strutturato | Accettato |
| [0008](0008-politica-fonti-eventi.md) | Politica sulle fonti degli eventi | Accettato |
| [0009](0009-deduplicazione-rapidfuzz.md) | Deduplicazione con blocchi per locale e data e confronto fuzzy | Accettato |
| [0010](0010-identificatori-in-italiano.md) | Identificatori e documentazione in italiano | Accettato |
| [0011](0011-claude-design-design-token.md) | Claude Design come fonte del design e token in Tailwind | Accettato |
| [0012](0012-hosting-ue.md) | Hosting nell'Unione Europea | Sostituito da ADR-0021 |
| [0013](0013-strategia-di-test.md) | Strategia di test | Accettato |
| [0014](0014-osservabilita-senza-tracciamento.md) | Osservabilità senza tracciamento degli utenti | Accettato |
| [0015](0015-monorepo-pnpm-uv.md) | Monorepo con pnpm e uv | Accettato |
| [0016](0016-mappe-protomaps-autospitate.md) | Mappe gratuite con Protomaps auto-ospitato | Accettato (hosting sostituito da ADR-0021) |
| [0017](0017-fascia-unica-minorenni.md) | Un'unica fascia per i minorenni dai 14 ai 17 anni | Accettato |
| [0018](0018-foto-dei-locali.md) | Foto dei locali come immagine degli eventi | Accettato |
| [0019](0019-movimento-espressivo.md) | Movimento espressivo | Accettato |
| [0020](0020-captcha-cloudflare-turnstile.md) | CAPTCHA con Cloudflare Turnstile | Accettato |
| [0021](0021-infrastruttura-a-costo-minimo.md) | Infrastruttura a costo minimo | Accettato |
