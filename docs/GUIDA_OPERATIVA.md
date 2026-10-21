# Guida operativa

Come lavorare su Noxa giorno per giorno con Claude Code, le skill, Claude Design e i
documenti del repository.

## 1. Come è organizzato il lavoro

| Livello | Cosa sono | Chi li usa |
|---|---|---|
| `CLAUDE.md` | Istruzioni permanenti del progetto (stack, convenzioni, vincoli di sicurezza) | Claude Code lo legge da solo a ogni sessione aperta nella cartella del progetto |
| `docs/` | Cosa fa l'app, come è fatta e perché | Il product owner per decidere, Claude per implementare |
| `.claude/skills/` | Procedure passo per passo per i lavori ricorrenti | Claude, quando le richiami o quando riconosce il tipo di lavoro |
| `design/` | Materiali di Claude Design per ogni schermata | Claude, tramite la skill `implement-design` |

## 2. Avviare una sessione

```bash
cd ~/progetti/noxa
claude
```

Scrivi le richieste in italiano. Non serve rispiegare stack, convenzioni o regole: sono in
`CLAUDE.md`. Comandi utili di Claude Code: `/model` (cambia modello), `/fast` (risposte più
rapide con lo stesso modello), `/help`.

## 3. Lo sviluppo a iterazioni: `/iterazione`

La roadmap è divisa in **15 iterazioni** (da 0 a 14), descritte in
[ROADMAP.md](ROADMAP.md) §5. Ognuna si esegue con un solo comando:

```
/iterazione 0
```

Claude esegue tutta l'iterazione:
1. controlla i prerequisiti (iterazioni precedenti, design, decisioni);
2. crea un branch dedicato;
3. scrive e ti mostra il piano;
4. implementa con le altre skill;
5. ripete i **cicli di revisione** (test, rilettura, criteri, `safety-review`) finché tutto
   passa;
6. aggiorna documenti e registro;
7. fa il commit e ti fa il rapporto.

Il rapporto finale riporta il numero di cicli di revisione fatti, le iterazioni completate
sul totale e cosa preparare per la successiva.

Altri usi:

| Comando | Effetto |
|---|---|
| `/iterazione stato` | Avanzamento: iterazioni completate su 15, attese esterne, prossima iterazione e cosa serve |
| `/iterazione 3` lanciata prima della 2 | Si ferma e ti dice quale iterazione eseguire prima |
| `/iterazione 4` senza i design pronti | Si ferma ed elenca le schermate da preparare in Claude Design |

Lo storico è in [REGISTRO_ITERAZIONI.md](REGISTRO_ITERAZIONI.md). Claude non fa merge in
`main` né push se non glielo chiedi: alla fine di un'iterazione puoi rivedere il branch e
poi scrivere "unisci l'iterazione in main".

Cosa fare se si ferma:
- **manca un design**: preparalo (§4) e rilancia lo stesso comando;
- **manca una decisione**: rispondi alla domanda, Claude la registra e prosegue;
- **mancano account o chiavi** (Supabase, Meta, Apple…): non si ferma; l'iterazione si chiude
  come "completata con attese esterne" e le attese restano elencate nel registro finché non
  le risolvi.

## 4. Quando preparare i design in Claude Design

Ogni iterazione con interfaccia ha bisogno dei suoi design **prima** di essere lanciata. Il
modo più efficiente è preparare i design dell'iterazione successiva mentre Claude lavora a
quella corrente.

| Pronto prima dell'iterazione | Cosa preparare in Claude Design | Cartella |
|---|---|---|
| **1** (la prima scadenza) | **Design system Noxa**: colori del tema scuro e chiaro, tipografia, spaziature, raggi, ombre, componenti di base (pulsante, campo, scheda, avviso, foglio, badge, avatar, interruttore, schede, stati vuoto/caricamento/errore), barra di navigazione delle 5 aree, stile della mappa | `design/sistema/` |
| 2 | Benvenuto, registrazione con data di nascita, verifica email, accesso, onboarding di sicurezza (3 schermate), consensi | `design/F-10-accesso/` |
| 3 | Amici (elenco, richieste, ricerca, codice QR, avviso al minorenne), profilo, segnala, blocca, elenco bloccati | `design/F-11-amici/`, `design/F-12-segnala-blocca/` |
| 4 | Elenco eventi con filtri, mappa, dettaglio evento, "mi interessa / partecipo", amici che partecipano | `design/F-01-scopri/`, `design/F-03-dettaglio-evento/` |
| 5 | Area di moderazione (desktop): locali, fonti, coda dei duplicati | `design/F-40-moderazione-fonti/` |
| 6 | Carica flyer, stato dei miei flyer, notifiche nell'app e reclamo sulle decisioni; code di moderazione di flyer, segnalazioni e reclami; foto profilo (scelta, ritaglio, sostituzione, rimozione) | `design/F-06-flyer/`, `design/F-40-moderazione/`, `design/F-10-foto-profilo/` |
| 7 | Gruppi, dettaglio gruppo e inviti, serata di gruppo (chi c'è, biglietti, trasporto) | `design/F-13-gruppi/`, `design/F-14-serata/` |
| 8 | Tracker (elenco, nuova serata, dettaglio), impostazioni di privacy, esporta dati, elimina account | `design/F-30-tracker/`, `design/F-42-privacy/` |
| 9 | Centro notifiche, richiesta dei permessi, check-in | `design/F-22-notifiche/`, `design/F-20-checkin/` |
| 10 | Avvio del ritorno sicuro, ritorno in corso, ritorno di un amico, allerta | `design/F-21-ritorno-sicuro/` |
| 11 | Statistiche, bacheca dei badge, schede del Wrapped | `design/F-31-statistiche/`, `design/F-32-badge/`, `design/F-33-wrapped/` |
| 12 | Icona dell'app, schermate e testi per App Store e Google Play | `design/store/` |
| 13 | Accesso con Apple e Google, completamento del profilo | `design/F-17-accesso-social/` |

Le iterazioni 0 e 14 non hanno interfaccia: non serve nulla.

In ogni cartella metti:
- `brief.md`: obiettivo, stati (vuoto, caricamento, errore, successo, offline), differenze
  per minorenni e maggiorenni, testi;
- il link al progetto Claude Design;
- le immagini di ogni stato in tema scuro e chiaro;
- l'eventuale codice esportato, che Claude usa solo come riferimento.

Le regole del design (contrasti, aree di tocco, tono dei testi, niente dark pattern) sono in
[DESIGN.md](DESIGN.md).

## 5. Le altre skill

Durante le iterazioni le skill vengono usate da sole. Puoi richiamarle anche direttamente
per lavori fuori dalle iterazioni, scrivendo `/nome-skill` seguito dalla richiesta oppure
descrivendo il lavoro.

| Skill | Quando | Esempio |
|---|---|---|
| `new-feature` | Una funzionalità nuova o una modifica di comportamento | `/new-feature aggiungi il filtro "gratis" all'elenco eventi` |
| `db-migration` | Una modifica al database | "aggiungi la colonna dress code agli eventi" |
| `safety-review` | Verifica di sicurezza su una funzionalità o una PR | `/safety-review sui gruppi` |
| `implement-design` | Una schermata pronta in Claude Design | `/implement-design design/F-01-scopri` |
| `add-event-source` | Un nuovo locale o una nuova fonte; un sito cambiato | "aggiungi il sito di [locale] come fonte" |
| `flyer-parser` | La lettura dei flyer sbaglia o vuoi cambiare modello | "il parser sbaglia l'età sui flyer di X" |

## 6. I documenti

| File | Lo apri quando… |
|---|---|
| [PRD.md](PRD.md) | Vuoi sapere o cambiare cosa fa l'app (codici `F-xx`) |
| [ROADMAP.md](ROADMAP.md) | Vuoi sapere cosa viene dopo: fasi, iterazioni, criteri |
| [REGISTRO_ITERAZIONI.md](REGISTRO_ITERAZIONI.md) | Vuoi vedere l'avanzamento e i cicli di revisione fatti |
| [SAFETY_PRIVACY.md](SAFETY_PRIVACY.md) | Hai un dubbio su minorenni e privacy (regole `R-xx`) |
| [DECISIONI_APERTE.md](DECISIONI_APERTE.md) | Vuoi sapere quali decisioni sono ancora aperte |
| [decisions/](decisions/) | Vuoi sapere perché è stata fatta una scelta tecnica (ADR) |
| [DESIGN.md](DESIGN.md) | Lavori in Claude Design |
| ARCHITECTURE, DATA_MODEL, EVENT_INGESTION | Dettagli tecnici, soprattutto per Claude e per altri sviluppatori |

Quando prendi una decisione, dilla a Claude ("il dominio sarà noxa.it"): la registra in
DECISIONI_APERTE.md, aggiorna i documenti e, se serve, scrive un ADR.

## 7. Controlli e regole

- `python3 scripts/verifica_documentazione.py` controlla la coerenza dei documenti; gira
  anche in CI e a ogni ciclo di revisione delle iterazioni.
- Le regole di sicurezza dei minorenni sono vincoli: se una richiesta le viola, Claude si
  ferma e te lo dice. Per cambiarle serve una discussione e un nuovo ADR.
- Claude fa commit solo sui branch delle iterazioni o quando glielo chiedi; merge e push
  solo su tua richiesta.

## 8. Cosa fai tu, in parallelo

| Quando | Attività |
|---|---|
| Prima dell'iterazione 0 | Creare il repository GitHub e l'account Supabase |
| Prima dell'iterazione 1 | Design system in Claude Design |
| Quando si crea lo staging | Comprare il dominio su Cloudflare Registrar (D-01); account Cloudflare (Pages, R2) e Brevo, tutti gratuiti (ADR-0021) |
| Durante la Fase 0 | Avviare con un legale DPIA, termini e informativa (D-07); inviare la richiesta di App Review a Meta |
| Prima dell'iterazione 5 | App Review Meta approvata; chiave Google Places facoltativa (senza, solo OpenStreetMap) |
| Prima dell'iterazione 6 | Organizzazione della moderazione (D-10). Facoltativi finché non si apre la beta: chiave Claude API con limite di spesa e accordo sul trattamento dei dati con Anthropic (D-12); senza chiave i flyer si compilano a mano in moderazione (ADR-0021) |
| Prima dell'iterazione 9 | Progetto Firebase e chiavi APNs |
| Prima dell'iterazione 12 | Penetration test esterno; testi legali definitivi; questionari d'età degli store (D-06) |
