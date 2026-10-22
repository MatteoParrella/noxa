# Brief — F-13 Gruppi e inviti (iterazione 7)

Schermate da preparare prima dell'iterazione 7 (GUIDA_OPERATIVA.md §4). Requisiti: PRD F-13;
regole R-11, R-15, R-16, R-17, R-50 di SAFETY_PRIVACY.md; DATA_MODEL.md (`gruppi`,
`membri_gruppo`). La serata di gruppo (chi c'è, biglietti, trasporto) è in
`design/F-14-serata/`. Il prompt da incollare in Claude Design è tutto quello che segue la
riga `---`.

---

Nello **stesso progetto "Noxa — Design system"** progetta i **gruppi** dell'area
**Organizza**, usando solo i token, i componenti e il movimento già definiti:
- accento A arancio "lampione al sodio";
- Archivo e IBM Plex Mono;
- riga di una persona, menu ⋯, fogli dal basso, segnala e blocca di "F-11 · Amici".

Formato **mobile 390 × 844**, con una verifica a **360 px** e una a **1280 px**: da desktop
la navigazione delle aree è una barra laterale (ADR-0022) e i contenuti stanno in una colonna
di 720 px. Tema **scuro e chiaro**. Mettile in una nuova riga del canvas intitolata
"F-13 · Gruppi".

## Contesto e regole che il design deve rendere evidenti
Un gruppo è un piccolo insieme di amici che escono insieme (la compagnia del sabato, la
classe, gli amici del calcetto) e organizza le serate. Non è una chat e non è un luogo per
conoscere persone nuove.
- **Solo amici confermati** (R-11, R-15): si invita in un gruppo solo chi è già proprio
  amico. Nessuna ricerca di sconosciuti, nessun link pubblico al gruppo, nessun elenco di
  gruppi da scoprire.
- **Invariante delle fasce** (R-15): se nel gruppo ci sono minorenni (14–17) e maggiorenni,
  ogni minorenne deve essere amico confermato di **ogni** maggiorenne del gruppo, e
  viceversa. Quindi un invito può non essere possibile anche tra amici. Esempio: Marco, 20
  anni, è amico di Giulia ma non di Sara, 16 anni, che è nel gruppo.
  - Nel selettore degli amici da invitare, chi non si può invitare compare **spento con il
    motivo scritto** ("Non è amico di tutti i minorenni del gruppo"). Il motivo non dice chi,
    per non rivelare amicizie altrui.
  - Se l'invariante si rompe (amicizia rimossa, blocco, compleanno dei 18 anni), **il
    maggiorenne viene tolto dal gruppo** e riceve una notifica con il motivo.
- **Inviti** (R-11): un invito si **accetta o rifiuta esplicitamente**; finché non accetta,
  la persona non risponde alle serate e non compare tra "chi c'è". Chi ha invitato vede
  "Invitato".
- **Ruoli**: chi crea il gruppo è **admin**:
  - può rinominarlo, togliere membri, nominare altri admin ed eliminarlo;
  - i membri possono invitare amici e uscire;
  - se l'ultimo admin esce, il gruppo propone di nominare un altro admin.
- **Limiti**: massimo **30 membri** (con il conteggio visibile, "12/30"); nome del gruppo
  1–40 caratteri.
- **Niente chat** (R-16): nessun campo di messaggio libero. Si comunica con le serate e le
  loro risposte (vedi F-14).
- **Blocco** (R-17): si può bloccare un membro dal suo menu ⋯, con la stessa conferma di
  Amici. Il bloccato non lo sa e non può più essere invitato da chi lo ha bloccato. Se i
  due sono di fasce diverse, l'invariante si rompe e il maggiorenne esce dal gruppo (§5).
- **Segnalazione** (R-50): il **nome del gruppo** è segnalabile in due tocchi, come i
  profili.
- Niente alcol nei nomi di esempio e nelle illustrazioni (R-40).

## Stile
Linguaggio di Amici e Scopri:
- titoli Archivo stretto ed etichette da pensilina in maiuscoletto;
- numeri e conteggi in IBM Plex Mono;
- un solo accento per l'azione principale;
- avatar sovrapposti per i membri, con le foto profilo se ci sono (iniziali altrimenti);
- stati con badge testuali, mai solo colore.

## Schermate e stati

### 1. Organizza › I miei gruppi
- Intestazione dell'area "Organizza · Amici e gruppi" con la campanella.
- Elenco dei gruppi:
  - nome, avatar sovrapposti dei primi membri e "+N", numero dei membri;
  - prossima serata in programma con data in monospaziato ("SAB 08.11"), se c'è;
  - badge "Admin" se lo si è.
- In cima, gli **inviti ricevuti** con Accetta / Rifiuta, e chi ha invitato ("Giulia R. ti
  invita in «Calcetto del giovedì»").
- Azione principale "Crea un gruppo".
- Stati:
  - caricamento;
  - vuoto ("Ancora nessun gruppo. Crea un gruppo con i tuoi amici per organizzare le
    serate"), con il link agli Amici se non se ne hanno;
  - errore con Riprova;
  - offline (elenco salvato, azioni spente con il motivo).

### 2. Crea un gruppo
- Nome (con conteggio 0/40) e scelta degli amici da invitare, facoltativa: si può invitare
  anche dopo.
- Selettore degli amici:
  - righe persona con casella;
  - ricerca locale tra i propri amici (non tra gli sconosciuti);
  - spenti con il motivo quelli che rompono l'invariante R-15;
  - contatore "3 selezionati · 4/30".
- Conferma: "Gruppo creato · 3 inviti inviati".
- Errori: nome mancante o troppo lungo, limite di 30, amicizia nel frattempo rimossa.

### 3. Dettaglio del gruppo
- Nome, numero dei membri, "Creato da Giulia R.".
- Sezione **Serate**:
  - prossime serate con data e risposte ("4 sì · 2 forse");
  - "Proponi una serata" (porta a F-14);
  - le serate passate, compresse.
- Sezione **Membri**:
  - righe persona con ruolo (Admin) e stato (Invitato, in attesa);
  - menu ⋯ per persona: vedi profilo, segnala, blocca; per gli admin anche "Togli dal
    gruppo" e "Rendi admin".
- Azioni:
  - "Invita amici", con lo stesso selettore di §2;
  - menu ⋯ del gruppo: rinomina (admin), segnala il nome, esci dal gruppo, elimina (admin).
- Conferme:
  - per uscire, togliere un membro ed eliminare il gruppo, un foglio con l'effetto scritto
    ("Le serate del gruppo verranno eliminate per tutti");
  - per l'ultimo admin che esce, la scelta del nuovo admin.
- Stati: caricamento, errore, gruppo non più disponibile ("Non fai più parte di questo
  gruppo"), offline.

### 4. Invito ricevuto
- Foglio o pagina:
  - chi invita, nome del gruppo, numero dei membri;
  - i membri **che si conoscono già**: solo amici o persone il cui profilo si può vedere;
  - degli altri solo il numero ("e altre 5 persone").
- Accetta / Rifiuta, con Rifiuta senza colpevolizzare.
- Se l'invito non è più valido (gruppo pieno, invariante cambiata, gruppo eliminato): stato
  che lo spiega senza dare colpe.

### 5. Rimozione per l'invariante (R-15)
- Notifica e schermata informativa per il maggiorenne tolto: "Non fai più parte di
  «Calcetto del giovedì»: nel gruppo ci sono persone minorenni che non sono tue amiche
  confermate". Il gruppo e le sue serate non sono più visibili; lo stato dice solo cosa è
  successo e cosa si può fare (chiedere di nuovo l'amicizia con un codice invito).
- Variante del compleanno: "Hai compiuto 18 anni: …", con lo stesso tono neutro.

## Testi e tono
"Tu", frasi brevi, tono da amici ma chiaro sulle regole. Spiegazioni delle regole senza
gergo e senza allarmismo ("Per sicurezza, in un gruppo con minorenni tutti devono essere
amici tra loro"). Nessun dato di persone vere negli esempi: "Giulia R." `@giulia.r`,
"Marco B." `@marcob`, "Sara C." `@sara.c`; gruppi "Calcetto del giovedì", "Terza B",
"Quelli del sabato".

## Accessibilità
- WCAG 2.2 AA nei due temi; aree di tocco di almeno 44 px.
- Le caselle spente del selettore restano raggiungibili e leggibili, con il motivo come
  descrizione accessibile.
- Contatori con etichetta testuale ("12 membri su 30").
- Conferme chiudibili con Esc e con il gesto indietro; focus visibile.
- Ogni esito annunciato in una regione live.

## Cosa consegnare
Le tavole di tutte le schermate e degli stati elencati, nei due temi, più le verifiche a 360
e 1280 px.

Aggiungi alla tavola dei componenti i componenti nuovi:
- riga del gruppo;
- avatar sovrapposti con conteggio;
- selettore di amici con caselle e righe spente con motivo;
- voce di invito con Accetta e Rifiuta;
- badge di ruolo;
- foglio di conferma con effetto.

Esporta l'HTML come `gruppi.html` e le tavole come immagini in questa cartella (o in
`esportazione/` con il foglio CSS del layer, come per Scopri).
