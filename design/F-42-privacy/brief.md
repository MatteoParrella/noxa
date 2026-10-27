# Brief — F-42 e F-41 Privacy, dati e account (iterazione 8)

Schermate da preparare prima dell'iterazione 8 (GUIDA_OPERATIVA.md §4). Requisiti: PRD F-41,
F-42; regole R-17, R-55, R-63, R-64, R-67 e §10 di SAFETY_PRIVACY.md; DATA_MODEL.md
(`profili_privati`, `blocchi`). Check-in e notifiche sul telefono arrivano nella Fase 2
(iterazione 9) e non vanno disegnati ora. Il diario delle serate è in `design/F-30-tracker/`.
Il prompt da incollare in Claude Design è tutto quello che segue la riga `---`.

---

Nello **stesso progetto "Noxa — Design system"** progetta le schermate **Privacy e dati**
del profilo, usando solo i token, i componenti e il movimento già definiti:
- accento A arancio "lampione al sodio";
- Archivo e IBM Plex Mono;
- interruttori, fogli dal basso, avvisi e righe di impostazione già presenti nel profilo
  ("F-11 · Amici": persone bloccate, le mie segnalazioni).

Formato **mobile 390 × 844**, con una verifica a **360 px** e una a **1280 px**: da desktop
la navigazione delle aree è una barra laterale (ADR-0022) e i contenuti stanno in una colonna
di 720 px. Tema **scuro e chiaro**. Mettile in una nuova riga del canvas intitolata
"F-41 · Privacy e dati".

## Contesto e regole che il design deve rendere evidenti
Chi usa Noxa ha tra 14 e 25 anni: ogni impostazione deve essere comprensibile da un
quattordicenne, senza gergo legale, e le scelte predefinite sono le più protettive
ragionevoli.
- **Partecipazioni visibili** (R-67): "interessato" e "partecipo" agli eventi si vedono solo
  dagli amici confermati. L'impostazione generale decide il valore predefinito per i nuovi
  eventi; ogni evento si può comunque cambiare dal suo dettaglio. Il testo spiega chi vede
  cosa ("Solo i tuoi amici confermati, mai gli sconosciuti").
- **Persone bloccate** (R-17): la schermata esiste già; qui serve solo la riga che ci porta,
  con il numero.
- **Scarica i tuoi dati** (R-64): un file JSON con tutto ciò che Noxa conserva su di te
  (profilo, amicizie, gruppi e serate, partecipazioni, diario, segnalazioni fatte, consensi).
  Si prepara in pochi secondi e si scarica sul dispositivo; nessuna email, nessun link
  pubblico.
- **Elimina l'account** (R-64, SAFETY_PRIVACY §10): self-service, senza contattare nessuno.
  La cancellazione è **immediata e definitiva**: profilo, amicizie, gruppi, diario e
  partecipazioni spariscono subito; le copie di sicurezza si cancellano entro 30 giorni.
  Restano solo, separati da te, i registri che la legge impone di conservare quando c'è
  stata una segnalazione grave (R-55): dillo in una frase, senza allarmare.
- **Informativa a livelli** (R-63): prima un riassunto di una schermata in linguaggio
  semplice, poi il testo completo (pagina `/privacy` già esistente). Qui serve la schermata
  del riassunto, con le voci "Cosa raccogliamo", "Chi lo vede", "Quanto lo teniamo", "I tuoi
  diritti", e il link al testo completo.
- **Nessun dark pattern** (R-43): niente "Sei sicuro sicuro?", niente pulsanti per restare
  più grandi o colorati di quello per eliminare, niente richieste di motivazione
  obbligatorie, niente attese finte.

## Stile
Linguaggio del profilo:
- titoli Archivo stretto ed etichette da pensilina in maiuscoletto;
- righe di impostazione con titolo, spiegazione breve e controllo a destra;
- l'azione distruttiva usa il colore di errore del sistema, mai l'accento;
- un solo accento per l'azione principale di ogni schermata.

## Schermate e stati

### 1. Profilo › Privacy e dati
- Riga d'ingresso dal profilo ("Privacy e dati").
- Sezione **Chi vede cosa**:
  - interruttore "Mostra ai tuoi amici a quali eventi vai" (predefinito acceso, R-67), con la
    spiegazione e la nota "Puoi cambiarlo anche per ogni evento";
  - riga "Persone bloccate · 2".
- Sezione **I tuoi dati**:
  - "Scarica i tuoi dati";
  - "Informativa in breve".
- Sezione **Account**: "Elimina l'account", in fondo, separata.
- Stati: caricamento, errore del salvataggio dell'interruttore (torna com'era, con un
  avviso), offline (interruttore spento con il motivo).

### 2. Scarica i tuoi dati
- Cosa contiene il file, in un elenco breve; formato JSON spiegato in una riga ("un file di
  testo leggibile anche da altri servizi").
- Pulsante "Prepara il file" → stato di preparazione con indicatore → "File pronto" con
  "Scarica" (nome del file in monospaziato, es. `noxa-dati-2026-10-26.json`, e dimensione).
- Errori: rete assente, preparazione non riuscita con Riprova; limite di una richiesta ogni
  ora con l'orario della prossima ("Puoi richiederlo di nuovo alle 18:40").

### 3. Elimina l'account
Due passi, entrambi chiari e senza pressione:
1. **Cosa succede**: elenco di ciò che sparisce subito, la frase sui backup a 30 giorni,
   quella sui registri conservati per legge, e il suggerimento neutro "Se vuoi, prima scarica
   i tuoi dati" con il link al §2.
2. **Conferma**: inserimento della password (per un account con i due fattori anche il
   codice a sei cifre), pulsante "Elimina definitivamente" nel colore di errore, "Annulla"
   come azione secondaria di pari evidenza.
- Esito: schermata di uscita "Il tuo account è stato eliminato" con il ritorno all'inizio.
- Errori: password errata, rete assente, eliminazione non riuscita con Riprova.

### 4. Informativa in breve
- Quattro blocchi brevi (cosa raccogliamo, chi lo vede, quanto lo teniamo, i tuoi diritti),
  ognuno con 2–4 righe; link "Leggi l'informativa completa" e versione e data in
  monospaziato.

## Testi e tono
"Tu", frasi brevi, tono da amici ma preciso: niente formule legali nel riassunto, nessuna
minimizzazione dell'eliminazione. Nessun dato di persone vere negli esempi.

## Accessibilità
- WCAG 2.2 AA nei due temi; aree di tocco di almeno 44 px.
- Interruttori con etichetta e stato letti insieme ("Mostra ai tuoi amici a quali eventi vai,
  attivo").
- La preparazione del file e l'esito dell'eliminazione annunciati in una regione live.
- Il pulsante distruttivo si riconosce anche senza colore (testo esplicito, icona).
- Fogli chiudibili con Esc e con il gesto indietro; focus visibile.

## Cosa consegnare
Le tavole di tutte le schermate e degli stati elencati, nei due temi, più le verifiche a 360
e 1280 px.

Aggiungi alla tavola dei componenti i componenti nuovi:
- riga di impostazione con interruttore e spiegazione;
- riga di navigazione con conteggio;
- blocco "cosa succede" con elenco di effetti;
- pulsante distruttivo e conferma a due passi.

Esporta l'HTML come `privacy.html` e le tavole come immagini in questa cartella (con il
foglio CSS del layer, come per le altre aree).
