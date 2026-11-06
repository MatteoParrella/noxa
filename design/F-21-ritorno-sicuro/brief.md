# Brief — F-21 Ritorno sicuro (iterazione 10)

Schermate da preparare prima dell'iterazione 10 (GUIDA_OPERATIVA.md §4). Requisiti: PRD F-21,
F-16, F-22; regole R-17, R-31, R-32, R-34, R-43 di SAFETY_PRIVACY.md; ADR-0006 e ADR-0027;
DATA_MODEL.md (`ritorni_sicuri`, `ritorni_destinatari`, `posizioni_ritorno`, notifiche
`ritorno_avviato`, `ritorno_allerta`, `ritorno_arrivato`). Il check-in (F-20) e le notifiche
(F-22) sono già disegnati in `design/F-20-checkin/` e `design/F-22-notifiche/`: qui si
riempie lo spazio riservato al ritorno sicuro nell'area Vivi. Il prompt da incollare in
Claude Design è tutto quello che segue la riga `---`.

Proposte del brief da fissare in DATA_MODEL nell'iterazione 10: proroga dell'arrivo previsto
di 15 o 30 minuti (sempre entro le 4 ore dall'avvio); area di arrivo con raggio di 150 m;
esito "è arrivato" visibile ai destinatari per 15 minuti, come già previsto da
`private.e_destinatario_ritorno`.

---

Nello **stesso progetto "Noxa — Design system"** progetta il **ritorno sicuro** dell'area
**Vivi**, usando solo i token, i componenti e il movimento già definiti:
- accento A arancio "lampione al sodio";
- Archivo e IBM Plex Mono;
- riga di una persona di "F-11 · Amici", selettori e fogli dal basso di "F-14 · Serata",
  mappa di "F-02 · Mappa", scheda del check-in e selettore dei destinatari di
  "F-20 · Vivi: check-in", notifiche di "F-22 · Notifiche".

Formato **mobile 390 × 844**, con una verifica a **360 px** e una a **1280 px**: da desktop
la navigazione delle aree è una barra laterale (ADR-0022) e i contenuti stanno in una colonna
di 720 px. Tema **scuro e chiaro**. Mettile in una nuova riga del canvas intitolata
"F-21 · Vivi: ritorno sicuro".

## Contesto e regole che il design deve rendere evidenti
Il ritorno sicuro serve a far sapere a **pochi amici scelti** che stai tornando a casa e a
farli avvisare se non arrivi. È l'unica funzione di Noxa che condivide la posizione, e lo fa
solo per **una sessione** avviata da te (R-31, R-34).
- **Avvio esplicito, una sessione alla volta** (R-31): niente interruttore "sempre attivo",
  niente avvio automatico alla fine di una serata. Se un ritorno è già attivo, Vivi mostra
  quello.
- **Arrivo previsto**: si sceglie tra 10 minuti e 4 ore da adesso (scorciatoie "30 min",
  "1 ora", "1 ora e mezza" e scelta dell'orario). Si può **prorogare** di 15 o 30 minuti
  mentre il ritorno è attivo.
- **Da 1 a 5 amici confermati** (R-31): scelti ogni volta. Proposti di default gli amici
  confermati della serata di gruppo di stasera, in particolare chi torna con te (stesso
  passaggio o stessa auto, F-16); nessun "tutti gli amici". Il contatore mostra il limite
  ("2 di 5").
- **Indicatore permanente** (R-31): finché il ritorno è attivo il telefono mostra una
  **notifica di sistema fissa** con l'arrivo previsto e "Sono arrivato", e l'app mostra una
  barra sempre visibile in tutte le aree.
- **Fine**: "Sono arrivato" in **un tocco**, "Annulla ritorno", oppure arrivo automatico
  quando entri nell'**area di arrivo salvata solo sul telefono** (R-32). Senza conferma, la
  sessione si chiude da sola **2 ore dopo l'arrivo previsto**.
- **Allerta dal server**: se l'arrivo previsto passa senza conferma, gli amici ricevono
  un'allerta con l'ultima posizione nota, anche se il tuo telefono è spento o senza rete.
  Prima di avviare lo si dice chiaramente.
- **Nessun indirizzo di casa** (R-32): Noxa non chiede mai "dove abiti". L'area di arrivo è
  facoltativa, resta solo su questo telefono e si chiama come vuoi tu ("Casa", "Da Sara").
  Non c'è un elenco di indirizzi né una ricerca per via.
- **Posizioni cancellate dopo 24 ore** dalla fine: scritto nell'avvio e in Privacy e dati.
- **App e PWA** (ADR-0006, ADR-0027): nell'app Android la posizione arriva anche con lo
  schermo bloccato; nella **PWA** (iPhone e browser) il ritorno funziona **solo con Noxa
  aperta in primo piano**, e lo si dice prima dell'avvio e nella barra del ritorno attivo,
  senza nasconderlo in una nota.
- **Chi riceve** vede nome, avatar, la posizione sulla mappa con la precisione, da quanto è
  aggiornata e l'arrivo previsto, solo mentre il ritorno è attivo (più 15 minuti per
  l'esito). Il blocco o la fine dell'amicizia lo tolgono subito (R-17).
- **Nessuna pressione sociale** (R-43) e nessun allarmismo: niente "non hai avviato il
  ritorno sicuro", niente conti alla rovescia rossi; l'allerta è seria ma calma.

## Stile
Linguaggio di Vivi e Serata:
- titoli Archivo stretto ed etichette da pensilina in maiuscoletto;
- orari in IBM Plex Mono ("ARRIVO PREVISTO 01:30", "AGGIORNATA 1 MIN FA");
- un solo accento per l'azione principale ("Sono arrivato");
- il ritorno attivo è un **biglietto di corsa notturna**: scheda compatta con la tratta
  "Binario 7 → Casa", l'orario previsto e i destinatari, non un pannello di sorveglianza;
- per l'allerta uno stato di attenzione dei token esistenti, senza nuovi rossi.

## Schermate e stati

### 1. Vivi (area): spazio del ritorno sicuro
Sostituisce la riga riservata di "F-20 · Vivi: check-in".
- **Nessun ritorno attivo**: blocco "Torni a casa? Fai sapere ad alcuni amici che stai
  rientrando: se non arrivi in tempo, li avvisiamo noi" e "Avvia il ritorno sicuro".
- **Il tuo ritorno attivo**: scheda con tratta, "arrivo previsto 01:30", stato della
  posizione ("Posizione condivisa · aggiornata 1 min fa"), avatar dei destinatari con
  "Lo vedono 2 amici", azioni "Sono arrivato" (principale), "Proroga", "Chi lo vede",
  "Annulla ritorno".
- **Ritorni degli amici**: elenco dei ritorni attivi ricevuti, ognuno con avatar, nome,
  username, "arrivo previsto 01:45" e stato ("In viaggio", "In ritardo", "Arrivata");
  toccando si apre il §5. Vuoto: nessun blocco, la sezione non compare.
- Stati: caricamento, errore con Riprova, offline (il ritorno non parte senza rete: azione
  spenta con il motivo).

### 2. Avvia il ritorno sicuro (foglio dal basso o pagina)
Passi in un solo foglio:
- **Arrivo previsto**: scorciatoie e scelta dell'orario, con l'ora risultante in mono
  ("Arrivo previsto alle 01:30").
- **Chi lo vede**: selettore degli amici confermati (come in F-20) con al massimo 5 scelte;
  in cima gli amici della serata di stasera con l'etichetta "Torna con te" o "Dalla serata
  Sabato al Binario 7". Superato il limite, le altre caselle si spengono con il motivo.
- **Area di arrivo** (facoltativa): "Arrivo automatico" con le aree salvate su questo
  telefono; "Nessuna, confermo io" è la scelta predefinita.
- **Riepilogo** con quello che succede, in tre righe: "Giulia R. e Marco B. vedono dove sei
  fino a quando arrivi", "Se alle 01:30 non hai confermato, li avvisiamo", "Le posizioni si
  cancellano 24 ore dopo". Poi "Avvia".
- Nella **PWA**: riga ben visibile "Su questo telefono funziona solo con Noxa aperta. Con lo
  schermo bloccato gli amici vedono l'ultima posizione" prima di "Avvia".
- Esiti: "Ritorno avviato: lo vedono 2 amici"; errore di rete; un amico non più amico tolto
  con l'avviso; posizione non disponibile (§3).

### 3. Permessi della posizione
- **Spiegazione prima della richiesta di sistema**, una sola schermata: perché serve la
  posizione, che si usa solo durante il ritorno, chi la vede, quando si cancella. Su Android
  spiega perché conviene "Consenti sempre" e che la notifica fissa resta visibile.
- Stati: permesso negato (come riattivarlo dalle impostazioni del telefono, senza
  insistere), solo "durante l'uso" (il ritorno parte, ma funziona come nella PWA e lo dice),
  GPS spento, posizione imprecisa ("Precisione circa 300 m").

### 4. Ritorno attivo
- **Barra permanente** in cima a tutte le aree: "Ritorno attivo · arrivo 01:30" con
  "Sono arrivato"; da desktop nella barra laterale.
- **Dettaglio**: mappa con la propria posizione e il cerchio di precisione (nessuna scia del
  percorso), tratta, arrivo previsto, destinatari, azioni del §1.
- **Proroga**: foglio con "+15 min" e "+30 min" e il nuovo orario; oltre le 4 ore
  dall'avvio non si può, con il motivo.
- **Chi lo vede**: elenco con "Togli" (togliere l'ultimo equivale ad annullare, lo si dice
  prima).
- **Annulla ritorno**: conferma leggera ("Gli amici sapranno che hai annullato").
- **Arrivo automatico**: avviso "Sei arrivato nell'area Casa: ritorno concluso" con
  "Non ero arrivato" per riprendere entro un minuto.
- **Mancano 10 minuti all'arrivo previsto**: avviso discreto con "Sono arrivato" e
  "Proroga".
- Stati: posizione non aggiornata da più di 5 minuti ("Gli amici vedono una posizione di
  01:12"), offline (le posizioni ripartono al ritorno della rete; l'allerta del server
  funziona comunque).
- Esiti: "Sono arrivato" annunciato in una regione live con "Gli amici sanno che sei a
  casa".

### 5. Ritorno di un amico (chi riceve)
- **In viaggio**: intestazione con avatar, nome, username; mappa con l'ultima posizione e il
  cerchio di precisione, "aggiornata 1 min fa", "arrivo previsto 01:45". Nessuna scia,
  nessuna velocità, nessun indirizzo.
- **Posizione non aggiornata**: "Ultima posizione alle 01:12", senza allarmi finché l'arrivo
  previsto non è passato.
- **In ritardo (allerta)**: stato di attenzione, "Sara C. non ha confermato l'arrivo delle
  01:45", ultima posizione con l'orario, suggerimenti in ordine: "Prova a sentirla",
  "Se pensi che sia in pericolo, chiama il 112". Nessun pulsante che chiami o scriva da Noxa
  (niente chat, PRD §6).
- **Arrivata**: "Sara C. è arrivata alle 01:38", mappa tolta; resta 15 minuti poi sparisce.
- **Annullato** o **concluso da solo**: "Il ritorno di Sara C. è terminato", senza
  posizione.
- **Non più disponibile** (blocco, amicizia rimossa): si apre l'elenco delle notifiche con
  "Non è più disponibile".

### 6. Aree di arrivo (solo su questo telefono)
In Profilo › Privacy e dati, sezione nuova "Ritorno sicuro":
- spiegazione: "Le aree di arrivo restano solo su questo telefono. Noxa non conosce il tuo
  indirizzo";
- elenco delle aree con nome e raggio, "Aggiungi area" (dalla posizione attuale, con la
  mappa per spostare il centro; nessuna ricerca per indirizzo), "Elimina";
- vuoto: "Nessuna area. Puoi sempre confermare l'arrivo a mano";
- riga informativa "Le posizioni dei ritorni si cancellano 24 ore dopo la fine".

### 7. Notifiche
- **Notifica di sistema fissa** (Android, durante il ritorno): "Ritorno sicuro attivo ·
  arrivo previsto 01:30 · lo vedono 2 amici" con l'azione "Sono arrivato". Non si può
  scorrere via finché il ritorno è attivo.
- **Schermata di blocco** dei destinatari, con i testi di sistema di F-22, **senza nomi né
  username**: "Un amico ha avviato il ritorno sicuro", "Allerta: un amico non è ancora
  rientrato", "Un amico è rientrato sano e salvo". Toccando si apre il §5.
- **Elenco delle notifiche nell'app**: tre tipi nuovi con avatar, nome e orario
  (`ritorno_avviato`, `ritorno_allerta`, `ritorno_arrivato`); a ritorno finito la notifica
  resta ma senza posizione.

## Testi e tono
"Tu", frasi brevi, tono da amici ma sobrio: è una funzione di sicurezza, non un gioco.
Niente parole che suggeriscono controllo ("traccia", "segui", "localizza", "monitora").
L'allerta informa e suggerisce cosa fare, senza drammatizzare. Nessun dato di persone vere
negli esempi: "Giulia R." `@giulia.r`, "Marco B." `@marcob`, "Sara C." `@sara.c`; locali e
luoghi di fantasia ("Binario 7", "Sala Ventuno"); mappe su zone generiche, senza vie o
numeri civici leggibili.

## Accessibilità
- WCAG 2.2 AA nei due temi; aree di tocco di almeno 44 px.
- La mappa non è l'unico modo di capire lo stato: orario dell'ultima posizione, precisione e
  arrivo previsto sono sempre testo.
- Lo stato di allerta non si distingue solo con il colore (icona ed etichetta).
- "Sono arrivato", proroga, annullamento ed esiti annunciati in una regione live.
- Fogli chiudibili con Esc e con il gesto indietro; focus visibile; i destinatari scelti sono
  letti con il contatore ("2 di 5 amici selezionati").

## Cosa consegnare
Le tavole di tutte le schermate e degli stati elencati, nei due temi, più le verifiche a 360
e 1280 px e la tavola delle notifiche del §7.

Aggiungi alla tavola dei componenti i componenti nuovi:
- scheda del proprio ritorno attivo e barra permanente;
- riga del ritorno di un amico con i tre stati;
- scelta dell'arrivo previsto con le scorciatoie;
- marcatore della posizione con il cerchio di precisione;
- riga di un'area di arrivo.

Esporta l'HTML come `ritorno.html` e le tavole come immagini in questa cartella (con il
foglio CSS del layer, come per le altre aree).
