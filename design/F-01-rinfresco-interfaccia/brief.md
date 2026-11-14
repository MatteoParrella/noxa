# Brief — Rinfresco dell'interfaccia: Benvenuto, Scopri, dettaglio evento, momenti di riscontro

Revisione delle schermate già in produzione, da preparare prima della beta. Non aggiunge
funzionalità né dati: cambia peso visivo, gerarchia e movimento di ciò che esiste. Requisiti:
PRD F-01, F-03, F-04, F-05, F-10, F-11, F-13; regole R-10, R-20, R-43, R-61, R-67 di
SAFETY_PRIVACY.md; movimento ADR-0019; layout ADR-0022; copertine generate
(`design/F-01-copertine-generate/`). Sostituisce, dove li modifica, i disegni di
`design/F-01-scopri/` e `design/F-10-accesso/`. Le tavole vanno in questa cartella; se
servono token nuovi (vedi "Token") si aggiornano prima `design/sistema/noxa.css` e poi
`tokens.css`, nella stessa PR dell'implementazione (DESIGN.md §2). Il prompt da incollare in
Claude Design è tutto quello che segue la riga `---`.

---

Nello **stesso progetto "Noxa — Design system"** rivedi le schermate elencate sotto. Oggi
l'app è ordinata e leggibile ma fredda: sembra uno strumento, non il posto dove un ragazzo di
14–25 anni decide dove andare stasera. L'obiettivo è renderla **più calda, più visiva e più
viva** senza cambiare identità (accento A arancio "lampione al sodio", Archivo + IBM Plex
Mono, tema scuro predefinito) e senza toccare nessuna regola di sicurezza. Ogni schermata in
**tema scuro e chiaro**, mobile 390 × 844, con una verifica a 360 px e una a 1280 px. Mettile
in una nuova riga del canvas intitolata "Rinfresco · Benvenuto e Scopri", con accanto a ogni
tavola la versione attuale per confronto.

## Regole che restano ferme
- Senza account non si vede nulla: nel Benvenuto nessun evento, locale o persona reale, solo
  illustrazioni e copertine generate di esempio.
- **Amici che partecipano**: solo amici confermati che hanno reso visibile la scelta. Mai
  contatori di persone in generale, mai nomi di sconosciuti, mai suggerimenti di persone.
- Nessuna pressione sociale ("i tuoi amici ci vanno, tu no?"), nessun conto alla rovescia,
  nessuna urgenza ("ultimi posti"), nessun invito a uscire o spendere di più, nessun
  riferimento all'alcol, nessuna pubblicità.
- "Visibile ai tuoi amici" e "Solo per te" hanno lo stesso peso visivo.
- Nessuna animazione infinita, nessun effetto che segue il dito; con il movimento ridotto
  restano solo dissolvenze brevi.
- Contrasti WCAG 2.2 AA in entrambi i temi, aree di tocco di almeno 44 × 44 px.

## 1. Benvenuto
Oggi: marchio, una frase, due pulsanti. Non mostra che cosa si trova dentro.
- Sotto il marchio, **tre schede che scorrono in orizzontale** (a mano, con i punti
  dell'`IndicatorePunti`; nessuno scorrimento automatico), una per promessa:
  1. **Scopri** — due o tre copertine generate di esempio sovrapposte, titolo "Cosa c'è
     stasera", riga "Solo eventi a cui puoi entrare davvero."
  2. **Organizza** — una serata di gruppo d'esempio con tre avatar a iniziali e "chi c'è",
     titolo "Decidete insieme", riga "Chi viene, chi guida, come si torna."
  3. **Vivi** — il ritorno sicuro in forma illustrata, titolo "Torna a casa tranquillo",
     riga "Solo gli amici che scegli vedono che sei arrivato."
- "Crea un account" e "Ho già un account" restano in fondo, sempre visibili; Termini e
  Informativa privacy sotto.
- Stati: prima apertura (movimento d'ingresso), movimento ridotto, 360 px, 1280 px (le tre
  schede affiancate).

## 2. Scopri · elenco
Oggi: una scheda in evidenza, poi righe con miniature da 84 px. Le copertine generate, che
sono la parte più riconoscibile di Noxa, quasi non si vedono.
- **Copertine più grandi**: proponi due varianti da confrontare.
  - A: dopo la scheda in evidenza, schede medie a tutta larghezza con copertina 16:9 bassa
    (circa 120 px) e il titolo sopra la copertina.
  - B: griglia a due colonne di schede quadrate, con orario e titolo sulla copertina e
    locale, età e generi sotto.
  In entrambe restano: badge d'età sempre scritto, al massimo due generi, distanza e prezzo
  minimo solo se noti.
- **Sezione "Con i tuoi amici"** in cima all'elenco, prima della scheda in evidenza, solo se
  almeno un amico confermato ha una partecipazione visibile nell'intervallo scelto: fila
  orizzontale di schede compatte con copertina, titolo e avatar degli amici (più grandi di
  oggi, 32 px). Sono gli stessi eventi del filtro "Solo eventi con amici", non un elenco
  nuovo. Senza amici che partecipano la sezione non compare: nessuno stato vuoto, nessun
  invito ad aggiungere amici in quel punto.
- **Riga degli amici nelle schede**: avatar da 32 px e testo in corpo, subito sotto il titolo
  invece che in fondo.
- **Testo piccolo**: distanza, prezzo e orari secondari passano da 13 px ad almeno 14 px;
  le etichette in maiuscoletto da 11 px restano solo per i titoli di sezione.
- Stati: caricamento (scheletri delle nuove schede), nessun evento, errore, offline, con e
  senza la sezione degli amici, weekend con le sezioni per serata.

## 3. Dettaglio evento
- **Mi interessa / Partecipo**: oggi i due pulsanti a riposo sono identici. Proponi uno stato
  a riposo in cui "Partecipo" è l'azione principale della schermata (pieno, accento) e "Mi
  interessa" resta secondario; lo stato scelto resta scritto sotto ("Partecipi", "Ti
  interessa"), non solo colorato. Un tocco imposta, un secondo tocco toglie.
- **Riscontro alla scelta**: un'animazione breve (al massimo 400 ms, una sola volta) quando
  si sceglie "Partecipo"; sulle app native una vibrazione leggera. Mostra i fotogrammi
  chiave e la versione ridotta.
- **Amici che partecipano**: riga più alta con avatar da 40 px, subito sotto titolo e orario.
- La riga "Visibile ai tuoi amici" resta dov'è, con lo stesso peso di oggi.
- Stati: non scelto, mi interessa, partecipo, evento annullato (nessuna azione), offline.

## 4. Momenti di riscontro
Oggi le azioni riuscite si chiudono con un Toast di testo. Per tre momenti proponi un
riscontro più caldo, sempre breve (al massimo 900 ms, una sola volta, saltabile con un
tocco) e senza coriandoli o punteggi:
1. **Amicizia confermata** — i due avatar si avvicinano e si affiancano.
2. **Gruppo creato** — gli avatar dei membri invitati entrano in fila.
3. **Serata confermata da tutti** ("Ci siete tutti") — solo quando tutti hanno risposto sì;
   nessun messaggio a chi manca o ha risposto no.
Per ognuno: fotogrammi chiave, versione con movimento ridotto, tema scuro e chiaro.

## 5. Barra di navigazione
- L'area **Vivi** usa lo scudo, che comunica controllo più che serata. Proponi due
  alternative tra le icone di Lucide (per esempio la luna o il segnaposto con il cuore) e
  mostrale nella barra accanto alle altre quattro, in mobile e nella barra laterale.
- Lo stato attivo oggi è una linea da 2 px: valuta un fondo tenue (`--colore-accento-tenue`)
  dietro l'icona attiva.

## Token
Lavora con i token esistenti. Se una proposta richiede valori nuovi (un raggio più morbido
per le schede con copertina, una dimensione di avatar da 32 o 40 px, una durata per i
momenti di riscontro), elencali in una tavola "Token nuovi" con nome, valore e dove si
usano: senza quella tavola non entrano nel codice.

## Consegna
- Tavole PNG per ogni schermata e stato, in scuro e chiaro, più le verifiche a 360 e 1280 px.
- Per Scopri le due varianti A e B affiancate, con una nota su quale consigli e perché.
- Esportazione HTML e foglio CSS del layer, come per le altre cartelle.
