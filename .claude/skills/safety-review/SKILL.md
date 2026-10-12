---
name: safety-review
description: Checklist obbligatoria di sicurezza dei minorenni e privacy da applicare a ogni nuova funzionalità o modifica (codice, migrazioni, schermate, job) prima di considerarla completa. Da usare anche quando si rivede una PR o si valuta se una richiesta è compatibile con le regole R-xx di docs/SAFETY_PRIVACY.md.
---

# Safety review

Verifica che una funzionalità rispetti tutte le regole di `docs/SAFETY_PRIVACY.md`. Il
risultato è un **rapporto** da incollare nella descrizione della PR. Una funzionalità con
anche un solo punto "NO" non è completa.

## Input

- La funzionalità (ID `F-xx` del PRD) e il diff o i file coinvolti.
- `docs/SAFETY_PRIVACY.md` (regole), `docs/DATA_MODEL.md` (policy).

## Procedura

1. **Inventario dei dati.** Elenca ogni dato letto, scritto o mostrato dalla funzionalità:
   tabella e colonna, oppure campo dell'interfaccia. Per ognuno indica chi lo vede.
2. **Inventario delle superfici di contatto.** Elenca ogni modo in cui un utente può
   scoprire, vedere o raggiungere un altro utente grazie alla funzionalità (ricerca, liste,
   notifiche, gruppi, contenuti condivisi).
3. **Compila la checklist** qui sotto rispondendo SÌ, NO o N/A **con l'evidenza**: file e
   riga della policy, nome del test pgTAP o e2e, schermata. "SÌ" senza evidenza conta come
   "NO".
4. **Esegui i test** citati come evidenza:
   ```bash
   supabase db reset && supabase test db
   pnpm --filter web test:e2e
   ```
   e riporta l'esito.
5. **Se emerge un NO**: correggi e ripeti dal punto 3. Se la correzione richiede di cambiare
   una regola, fermati: serve un ADR e l'approvazione del product owner.
6. **Scrivi il rapporto** nel formato in fondo.

## Checklist

### A. Autorizzazione (R-04, R-68)
- [ ] Ogni tabella nuova o modificata ha RLS abilitata e policy per ogni operazione consentita.
- [ ] Nessuna regola di accesso esiste solo nel frontend.
- [ ] Età e fascia sono calcolate nel DB (`private.eta_di`, `private.e_minorenne`), mai ricevute dal client.
- [ ] Le funzioni `security definer` sono in `private` (o sono RPC documentate) con `set search_path = ''`.
- [ ] Esistono test pgTAP positivi **e negativi** per gli utenti `minore_14`, `minore_15`, `minore_16`, `minore_17`, `adulto_18`, `adulto_20`, `adulto_21`, `moderatore`, `moderatore_senza_mfa` dove pertinenti.
- [ ] La chiave `service_role` non compare nel codice dell'app.

### B. Contatti tra utenti (R-10…R-17)
- [ ] Un adulto non può trovare, vedere o contattare un minorenne che non sia suo amico confermato attraverso questa funzionalità (verifica ogni superficie del passo 2).
- [ ] Un minorenne non vede profili adulti non amici.
- [ ] Le liste di utenti mostrate sono limitate ad amici confermati o alla stessa fascia, mai a sconosciuti di altra fascia.
- [ ] I gruppi rispettano l'invariante delle fasce (R-15); i nuovi percorsi che aggiungono membri passano da `private.puo_entrare_nel_gruppo`.
- [ ] Il blocco nasconde i contenuti in entrambe le direzioni (`private.c_e_blocco` nelle policy).
- [ ] Non si introducono messaggi liberi tra utenti (R-16); i testi liberi hanno un limite di lunghezza e sono segnalabili.
- [ ] Le notifiche non contengono testi scritti da altri utenti.

### C. Eventi e contenuti (R-20…R-24, R-40…R-43)
- [ ] Gli eventi mostrati passano dalla policy di `eventi` (nessuna copia di dati evento in tabelle senza lo stesso filtro).
- [ ] Età sconosciuta = 18; con fonti discordanti vale il massimo.
- [ ] Nessun contenuto legato all'alcol è visibile ai minorenni (eventi con `riferimenti_alcol`, categorie di spesa, badge, testi, icone).
- [ ] Nessun incentivo a spendere, bere o uscire più spesso; nessun dark pattern (R-43).
- [ ] I contenuti condivisibili fuori dall'app non includono dati di altri utenti (R-42).

### D. Posizione (R-30…R-34)
- [ ] Ogni funzione di posizione è disattivata di default e si avvia con un'azione esplicita.
- [ ] La posizione è visibile solo ad amici confermati scelti, ha una scadenza e una conservazione definita.
- [ ] Si usa la granularità minima necessaria (locale invece di coordinate quando basta).
- [ ] Le coordinate non finiscono in log, Sentry o tabelle non previste.
- [ ] Nessun indirizzo di casa sul server.

### E. Contenuti caricati e moderazione (R-50…R-55)
- [ ] Ogni nuovo contenuto caricato o visibile ad altri è segnalabile (`segnalazioni`, nuovo valore di `tipo_oggetto_segnalabile` se serve).
- [ ] I contenuti che diventano pubblici passano da una revisione o da un controllo documentato.
- [ ] Esistono limiti di frequenza e di dimensione.
- [ ] I metadati delle immagini (EXIF) vengono rimossi.
- [ ] Le azioni dei moderatori sono registrate in `azioni_moderazione` e i moderatori non accedono a posizioni, tracker e dati privati (R-69).

### F. Privacy (R-60…R-67)
- [ ] Ogni nuovo dato personale è indispensabile; non si raccolgono telefono, rubrica, indirizzo, genere.
- [ ] Il nuovo dato ha una riga nella tabella di conservazione (SAFETY_PRIVACY.md §10) e la cancellazione automatica.
- [ ] Il nuovo dato è incluso in `esporta-dati` e cancellato da `elimina-account`.
- [ ] Nessun nuovo SDK di terze parti che tracci gli utenti; i nuovi fornitori trattano i dati nell'UE oppure sono in D-07/D-12.
- [ ] Nessuna pubblicità; nessuna profilazione dei minorenni.
- [ ] Le impostazioni predefinite sono le più protettive ragionevoli.
- [ ] I testi informativi sono comprensibili da un quattordicenne.

### G. Documentazione
- [ ] SAFETY_PRIVACY.md, DATA_MODEL.md e PRD sono coerenti con l'implementazione.
- [ ] Se una regola è cambiata esiste un ADR approvato.

## Formato del rapporto

```markdown
## Safety review — F-xx <nome>
Esito: SUPERATA | NON SUPERATA

### Dati coinvolti
| Dato | Chi lo vede | Regole |
|---|---|---|

### Superfici di contatto
- ...

### Checklist
| Sezione | Esito | Evidenza |
|---|---|---|
| A. Autorizzazione | SÌ | supabase/tests/12_gruppi.test.sql (casi 1-18) |
| ... | | |

### Test eseguiti
- supabase test db: N test, 0 falliti
- e2e: ...

### Problemi trovati e correzioni
- ...
```
