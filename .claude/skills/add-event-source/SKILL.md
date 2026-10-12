---
name: add-event-source
description: Come aggiungere una nuova fonte di eventi a Noxa (sito di un locale, account Instagram, nuovo adattatore) con verifica di conformità, adattatore, fixture, test, deduplicazione e attivazione. Da usare anche per modificare un adattatore esistente rotto da un cambio del sito.
---

# Aggiungere una fonte di eventi

Riferimenti: `docs/EVENT_INGESTION.md` (pipeline, formato, dedup), ADR-0008 (politica sulle
fonti), `packages/schemas/evento.schema.json` (contratto).

## Prerequisiti

- Fase 0 completata: worker inizializzato con `coda`, `ClientHttpConforme`, le funzioni di
  `normalizzazione/`, il registro degli adattatori, il test `tests/unit/test_architettura.py`
  e gli strumenti `noxa_worker.fonti.prova` e `noxa_worker.fonti.salva_fixture`
  (ROADMAP.md, Fase 0).
- Accesso all'area di moderazione con ruolo `moderatore` e MFA attiva.
- `services/worker/.env` o `.env` della radice con le variabili del worker (`.env.example`).

## 0. Decidi il caso

| Caso | Vai a |
|---|---|
| Il locale non è in `locali` | §1, poi il caso della fonte |
| Sito con dati strutturati schema.org `Event` o feed iCal | §2, §3a |
| Sito senza dati strutturati | §2, §3b |
| Account Instagram Business o Creator | §2, §3c |
| Aggregatore (Resident Advisor, Xceed, Dice) | **Fermati**: serve un accordo scritto o un'API ufficiale (D-05). Senza, la fonte resta `vietata`. |
| Adattatore esistente che non trova più eventi | §3b punto 1 per nuove fixture, poi §4–§6 |

## 1. Aggiungi il locale

1. Nell'area di moderazione → Locali → Nuovo: nome, indirizzo, comune, provincia (`MI` o
   `MB`), posizione sulla mappa, `osm_id` se esiste, `sito_web`, `instagram_username`.
2. Verifica che non sia un doppione (ricerca per nome e per distanza entro 200 m).

## 2. Verifica di conformità (obbligatoria, prima di scrivere codice)

1. **robots.txt**: apri `https://<dominio>/robots.txt` e controlla i percorsi da leggere per
   `User-agent: NoxaBot` e `User-agent: *`. Se sono vietati → `stato_conformita = 'vietata'`
   e fine.
2. **Termini d'uso**: cerca nel sito termini, note legali o condizioni. Se vietano la raccolta
   automatica, l'estrazione di dati o il riuso dei contenuti → `vietata` e fine. Se non ci
   sono termini, si procede rispettando ADR-0008.
3. **Instagram**: verifica che l'account sia Business o Creator (Business Discovery restituisce
   errore per gli account personali) → se personale, la fonte non è possibile: restano i flyer.
4. Nell'area di moderazione → Fonti → Nuova: `tipo`, `url`, `adattatore` previsto,
   `frequenza_minuti` (≥ 360 per i siti, ≥ 720 per Instagram) e `note_conformita` con:
   ```
   robots.txt (<data>): percorsi /eventi consentiti per *; NoxaBot non citato.
   Termini (<url>, letti il <data>): nessun divieto di raccolta automatica.
   Pagine per esecuzione: <n> (max 50). Campi raccolti: solo schema evento v1.
   ```
5. Imposta `stato_conformita = 'consentita'`. **Non attivare ancora** la fonte (`attiva = false`).

## 3. Adattatore

Tutti gli adattatori stanno in `services/worker/src/noxa_worker/fonti/` e implementano il
protocollo `Adattatore` (EVENT_INGESTION.md §4). Le richieste HTTP passano **solo** da
`ClientHttpConforme`; importare `httpx` o `playwright` in un adattatore fa fallire
`tests/unit/test_architettura.py`.

### 3a. Sito con dati strutturati
1. Usa l'adattatore esistente `sito_jsonld`: nessun codice nuovo.
2. Scarica una fixture (§4) e verifica con il test parametrico di `sito_jsonld` che produca
   eventi validi. Se la pagina ha dati incompleti (per esempio senza orario), passa al 3b.

### 3b. Sito senza dati strutturati
1. Salva 2–3 pagine reali come fixture (§4), possibilmente in giorni diversi.
2. Crea `fonti/sito_html_<nome_locale>.py`:
   ```python
   class AdattatoreSitoHtmlEsempioClub:
       nome: ClassVar[str] = "sito_html_esempio_club"
       tipo: ClassVar[TipoFonte] = TipoFonte.SITO_LOCALE

       async def raccogli(self, fonte: Fonte, http: ClientHttpConforme) -> list[EventoGrezzo]:
           pagina = await http.get_html(fonte.url)            # applica robots.txt e limiti
           return [estrai_scheda(nodo, base_url=fonte.url)
                   for nodo in pagina.css("article.evento")]

       def normalizza(self, grezzo: EventoGrezzo, fonte: Fonte) -> EventoNormalizzato:
           return costruisci_evento(
               origine=Origine.da_fonte(fonte, url=grezzo.url, id_esterno=grezzo.id),
               titolo=grezzo.titolo,
               inizio=interpreta_data_ora(grezzo.data, grezzo.ora, fuso=FUSO_ROMA),
               eta_minima=estrai_eta_minima(grezzo.testo),      # None se assente → 18 (R-21)
               riferimenti_alcol=contiene_riferimenti_alcol(grezzo.testo),
               generi=mappa_generi(grezzo.tag),
               artisti=estrai_artisti(grezzo.lineup),
           )
   ```
   - Usa le funzioni comuni di `normalizzazione/` (date, età, alcol, generi): non
     reimplementarle.
   - Selettori il più possibile stabili (classi semantiche, attributi `itemprop`), mai
     posizionali (`div:nth-child(3)`).
   - `http.get_html_renderizzato()` (Playwright) solo se il contenuto è generato da
     JavaScript; spiega il motivo in un commento.
   - Non leggere altri dati oltre a quelli dello schema; non scaricare immagini.
3. Registra l'adattatore in `fonti/registro.py`.

### 3c. Instagram
1. Nessun codice nuovo: si usa `instagram_business_discovery`. La fonte ha come `url`
   l'username senza `@`.
2. Verifica in locale con il token di sviluppo:
   ```bash
   uv run python -m noxa_worker.fonti.prova --fonte <fonte_id> --senza-scrittura
   ```
   Il comando stampa gli eventi normalizzati senza scrivere nel database.

## 4. Fixture

```bash
uv run python -m noxa_worker.fonti.salva_fixture --url <url> \
  --destinazione tests/dati/pagine/<nome_adattatore>/<aaaa-mm-gg>.html
```
Lo script usa `ClientHttpConforme` (rispetta robots.txt) e rimuove cookie e header. Apri il
file e verifica che non contenga dati personali (nomi in liste, commenti): se li contiene,
sostituiscili con testo neutro.

## 5. Test

In `tests/unit/fonti/test_<nome_adattatore>.py`:

1. **Estrazione**: dalla fixture si ottiene il numero atteso di eventi, con titolo, inizio
   (con fuso corretto), età minima e generi verificati su almeno 3 eventi.
2. **Validazione**: ogni evento normalizzato è valido rispetto a
   `packages/schemas/evento.schema.json` (helper `valida_contro_schema`).
3. **Casi limite**: evento dopo mezzanotte (`data_serata` corretta), età assente → `None`,
   testo con open bar → `riferimenti_alcol = True`, pagina vuota → lista vuota senza
   eccezioni, struttura cambiata → `ErroreFonte` esplicito.
4. **Conformità**: con robots.txt che vieta il percorso (fixture `robots_vietato.txt`)
   l'adattatore solleva `ErroreConformita` senza fare richieste.
5. **Deduplicazione**: aggiungi a `tests/dati/dedup_golden.jsonl` almeno 3 coppie reali
   tra questa fonte e altre fonti dello stesso locale (stesso evento e eventi distinti), poi:
   ```bash
   uv run pytest tests/unit/test_dedup_golden.py
   ```
   Precisione e richiamo non devono peggiorare (EVENT_INGESTION.md §6.3).

Esegui tutto:
```bash
cd services/worker
uv run ruff check . && uv run ruff format --check . && uv run mypy src && uv run pytest
```

## 6. Attivazione

1. Merge della PR con la CI verde.
2. In staging: area di moderazione → Fonti → "Esegui ora" (chiama la RPC
   `public.esegui_fonte_ora(fonte)`, che accoda un job `esegui_fonte` anche se la fonte non è
   ancora attiva). Controlla `ultimo_esito`: nessun errore, eventi coerenti
   con il sito, duplicati uniti correttamente.
3. In produzione: `attiva = true`. Controlla la prima esecuzione pianificata e,
   dopo 24 ore, che non ci siano allarmi.

## Checklist finale

- [ ] `note_conformita` compilate con date e link; `stato_conformita = 'consentita'`
- [ ] Adattatore che usa solo `ClientHttpConforme` e le funzioni di `normalizzazione/`
- [ ] Fixture senza dati personali
- [ ] Test di estrazione, validazione, casi limite, conformità; golden set di dedup aggiornato
- [ ] CI verde; esecuzione di prova in staging verificata
- [ ] Nessuna immagine scaricata o ripubblicata; link alla fonte presente negli eventi
