# ADR-0033: Su desktop Noxa si presenta come un sito

- **Stato**: Accettato
- **Data**: 2026-11-14

## Contesto
ADR-0022 ha reso l'app utilizzabile su tablet e desktop portando la barra di navigazione in una
barra laterale: stesso contenuto del telefono, in una colonna stretta con molto vuoto intorno.
Il product owner vuole che da computer Noxa sembri un sito e non un'app allargata, con un
aspetto diverso da quello del telefono. In più la barra laterale compariva a destra invece che
a sinistra, perché nel documento la navigazione viene dopo il contenuto.

## Decisione
- **Telefono (< 768 px)**: invariato. Barra in fondo con le cinque aree, una colonna.
- **Tablet (768–1023 px)**: barra laterale stretta a sinistra con le sole icone, come in
  ADR-0022; l'ordine nel layout la porta a sinistra.
- **Desktop (≥ 1024 px)**: layout da sito.
  - Barra in alto, fissa durante lo scorrimento, con il marchio a sinistra e le cinque aree a
    destra; l'area attiva ha il fondo tenue dell'accento.
  - Piè di pagina con marchio e link a Sicurezza, Termini e Informativa privacy.
  - Intestazione e contenuto nella stessa colonna centrata: 720 px per moduli ed elenchi,
    1120 px per le pagine che la sfruttano (`--larghezza-pagina`).
  - **Scopri**: evento in evidenza a tutta riga con copertina e informazioni affiancate, poi
    gli eventi su due colonne.
  - **Dettaglio evento**: locandina a sinistra che resta in vista durante lo scorrimento,
    informazioni e azioni a destra.
  - **Benvenuto**: pagina di presentazione larga, con le quattro promesse su una riga e le
    due azioni affiancate.
- Stesso codice, stesse route, stessi componenti: cambiano solo gli stili sopra i 1024 px.
  Nessuna funzione esiste solo su un formato. L'area di moderazione mantiene il suo layout.

## Alternative considerate
- **Tenere la barra laterale anche su desktop**: coerente con ADR-0022, ma è proprio l'aspetto
  «app allargata» che il product owner non vuole.
- **Un sito separato dall'app**: due basi di codice e due pubblicazioni per un prodotto che
  deve restare uno. Scartata.

## Conseguenze
- ADR-0022 resta valido per telefono, tablet e area di moderazione; questo ADR lo sostituisce
  sopra i 1024 px per le aree dell'app.
- Le barre delle azioni fisse in fondo usano `--nav-altezza` invece di un valore scritto a
  mano: sul telefono stanno esattamente sopra la navigazione, altrove sul bordo.
- Implementato senza tavole di Claude Design, su richiesta del product owner: il progetto
  Claude Design va riallineato (ROADMAP, iterazione 12).
- Le altre pagine (Organizza, Vivi, Ricorda, Profilo) restano nella colonna da 720 px: un
  layout a più colonne per ciascuna è nel piano.

## Aggiornamento del 2026-11-15
Sugli schermi grandi la colonna da 1120 px lasciava ancora molto vuoto ai lati, e nell'evento
in evidenza la metà destra della scheda conteneva solo uno o due generi. Su richiesta del
product owner:
- la larghezza del sito segue lo schermo fino a 1680 px, con un margine laterale
  proporzionale (`--sito-larghezza`, `--sito-margine`); barra, contenuti e piè di pagina
  condividono gli stessi margini;
- **Scopri**: l'evento in evidenza è un manifesto a tutta riga; amici, generi e prezzo stanno
  in un riquadro traslucido appoggiato alla foto, grande quanto il suo contenuto; sotto, gli
  eventi riempiono la riga in colonne da almeno 400 px;
- **Vivi**, **Organizza**, **Ricorda** e **Profilo** usano la larghezza del sito su più
  colonne (`.pagina-larga`); moduli e pagine di lettura restano nella colonna da 720 px;
- tag dei generi, etichette sopra le copertine, pulsanti tondi e barra di navigazione sono
  superfici «di vetro» (`--vetro-*` in `tokens.css`): lasciano intravedere quello che hanno
  dietro invece di essere blocchi pieni, in entrambi i temi.
