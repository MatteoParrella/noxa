# packages/schemas

Contratti JSON Schema condivisi tra worker e app.

| File | Contenuto |
|---|---|
| `evento.schema.json` | Evento normalizzato, versione 1 (`docs/EVENT_INGESTION.md` §3.3) |

Una modifica allo schema richiede nella stessa PR: aggiornamento di EVENT_INGESTION.md,
dei modelli Pydantic del worker e dei tipi TypeScript dell'app; `versione_schema`
incrementata se la modifica non è compatibile.
