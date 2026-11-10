# Brief — F-33 Riepilogo annuale "Wrapped" (iterazione 11)

Schermate da preparare prima dell'iterazione 11 (GUIDA_OPERATIVA.md §4). Requisiti: PRD F-33;
regole R-40, R-42, R-43 di SAFETY_PRIVACY.md; DATA_MODEL.md (`riepiloghi_annuali`,
`private.genera_riepiloghi()`, RPC `rigenera_mio_riepilogo`, notifica `riepilogo_pronto`).
Il riepilogo è disponibile dal **1° dicembre**: per averlo nel 2026 l'iterazione 11 va chiusa
prima di quella data. Proposte da confermare nell'iterazione 11: la spesa **non** compare nel
Wrapped (resta nelle statistiche, R-43); servono almeno 3 serate nell'anno; il riepilogo
generato il 1° dicembre si può rigenerare a fine anno per includere dicembre. Il prompt da
incollare in Claude Design è tutto quello che segue la riga `---`.

---

Nello **stesso progetto "Noxa — Design system"** progetta il **riepilogo annuale** dell'area
**Ricorda**: da 5 a 8 schede a tutto schermo da scorrere, ognuna esportabile come immagine.
Usa solo i token e i componenti già definiti (accento A arancio, Archivo e IBM Plex Mono); qui
puoi osare di più con la tipografia: numeri enormi in Plex Mono, titoli Archivo stretto.

Formato **mobile 390 × 844** (schede verticali 9:16), con una verifica a **360 px** e una a
**1280 px** (le schede al centro, con le frecce). Tema **scuro e chiaro**. Mettile in una
nuova riga del canvas intitolata "F-33 · Il tuo anno".

## Contesto e regole che il design deve rendere evidenti
Il Wrapped racconta il tuo anno di serate a partire dal diario. Si condivide **solo** come
immagine salvata sul telefono: non esiste un link pubblico.
- **Nessun altro utente** (R-42): niente nomi, username, foto o avatar di amici, nemmeno
  sfocati. Gli amici diventano solo un numero ("7 amici diversi con te").
- **Nessun incentivo** (R-43): niente spesa, niente "hai battuto il tuo record", niente
  confronti con gli altri o percentuali ("sei nel 5% più attivo").
- **Minorenni** (R-40): nessun riferimento all'alcol nei testi, nelle icone, nei colori.
  Il Wrapped è lo stesso per tutti; nessuna scheda cambia in base all'età.
- Locali, generi e DJ sono dati pubblici del catalogo: possono comparire per nome.

## Schede (proposta, 5–8)
1. **Copertina** — "Il tuo 2026 di notte", anno enorme in monospaziato.
2. **Serate** — numero di serate annotate e il mese più pieno.
3. **Locali** — numero di locali diversi e i primi 3.
4. **Musica** — genere più ascoltato e i primi 3 DJ.
5. **In compagnia** — quante serate con amici, quanti amici diversi (solo numeri).
6. **Badge** — badge ottenuti nell'anno (le icone di F-32).
7. **Il tuo voto** — la serata col voto più alto (data e locale, niente note).
8. **Chiusura** — "Ci vediamo nel 2027" con il logo Noxa piccolo.
Le schede senza dati si saltano (es. nessun DJ annotato → niente scheda Musica).

## Schermate e stati

### 1. Ingresso
- Da Ricorda, una tessera "Il tuo 2026 è pronto" in cima al diario, dal 1° dicembre.
- Notifica "riepilogo pronto" nell'elenco e push generico ("Noxa · Il tuo riepilogo
  dell'anno è pronto").

### 2. Visualizzatore delle schede
- Barre di avanzamento in alto (una per scheda), tocco a destra/sinistra per andare
  avanti/indietro, pulsanti Pausa e Chiudi sempre visibili.
- Avanzamento automatico ogni 6 secondi, che si ferma con Pausa o con
  `prefers-reduced-motion` (in quel caso solo pulsanti Avanti/Indietro, niente animazioni).
- Pulsante "Salva immagine" su ogni scheda: genera l'immagine sul telefono (1080 × 1920),
  poi foglio di sistema per salvarla o condividerla.
- Pulsante "Aggiorna" in fondo all'ultima scheda (una volta al giorno): "Riepilogo
  aggiornato" oppure "Puoi aggiornarlo di nuovo domani".

### 3. Stati
- Non ancora disponibile (prima del 1° dicembre): la tessera non c'è.
- Troppe poche serate (meno di 3): "Quest'anno il diario è quasi vuoto: annota le tue
  serate e il prossimo riepilogo sarà tutto tuo".
- Caricamento, errore con Riprova, offline (ultimo riepilogo salvato; "Salva immagine"
  funziona, "Aggiorna" no).
- Anni passati: elenco "I tuoi riepiloghi" (2026, 2025…) in Ricorda.

### 4. Immagine esportata
- Mostra come appare l'immagine salvata di 2–3 schede: sfondo pieno, dati della scheda,
  "noxa" in piccolo in basso. Nessun nome utente, nessun codice QR, nessun link.

## Testi e tono
"Tu", entusiasta ma mai competitivo; italiano neutro per il genere ("Sei uscito/a" va
evitato: "Hai annotato 23 serate", "7 amici diversi con te"). Locali e DJ di fantasia
("Binario 7", "DJ Lumen").

## Accessibilità
- WCAG 2.2 AA nei due temi, anche sui fondi pieni delle schede.
- Avanzamento automatico fermabile (WCAG 2.2.2) e assente con `prefers-reduced-motion`.
- Ogni scheda ha un testo alternativo completo; i pulsanti Pausa, Chiudi, Avanti, Indietro e
  Salva immagine hanno etichette e si raggiungono da tastiera; Esc chiude.

## Cosa consegnare
Le tavole di tutte le schede e degli stati elencati, nei due temi, più le verifiche a 360 e
1280 px e 2–3 esempi di immagine esportata. Aggiungi alla tavola dei componenti: scheda del
Wrapped, barre di avanzamento, tessera "Il tuo anno è pronto".

Esporta l'HTML come `wrapped.html` e le tavole come immagini in questa cartella (con il
foglio CSS del layer).
