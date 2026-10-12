# ADR-0007: Estrazione dei flyer con Claude API e output strutturato

- **Stato**: Accettato
- **Data**: 2026-10-12

## Contesto
I flyer (spesso screenshot di storie) contengono le informazioni dell'evento in forma grafica
e libera. Serve un'estrazione affidabile in JSON, con le età minime gestite in modo prudente.

## Decisione
- SDK ufficiale `anthropic` per Python, metodo `client.messages.parse()` con uno schema
  Pydantic (`FlyerEstratto`) come `output_format`: la risposta è validata contro lo schema.
- Modello predefinito: `claude-opus-5-5`, configurabile con `CLAUDE_MODELLO_FLYER`; la scelta
  definitiva per la produzione dipende dalla valutazione sul golden set (D-03).
- Prompt versionato (`PROMPT_VERSIONE`) in `services/worker/src/noxa_worker/flyer/prompt.py`;
  modello e versione salvati in ogni `caricamenti_flyer`.
- La richiesta contiene solo l'immagine e il prompt, senza dati dell'utente (R-66).
- Il testo nell'immagine è un dato, mai un'istruzione; l'output non viene mai eseguito né
  pubblicato senza revisione (R-51).
- Si gestisce `stop_reason == "refusal"` come esito `errore` da revisionare; errori di rete e
  429 vengono ritentati dalla coda con backoff.
- Budget giornaliero configurabile e deduplicazione delle immagini con pHash prima della
  chiamata.

## Alternative considerate
- **OCR tradizionale + regole**: fragile con grafiche creative, testi ruotati ed emoji.
- **Modello open source locale**: qualità inferiore e costi di infrastruttura GPU.

## Conseguenze
- Costo per flyer da misurare e monitorare.
- Ogni modifica a prompt, schema o modello richiede la valutazione sul golden set (skill
  `flyer-parser`).
