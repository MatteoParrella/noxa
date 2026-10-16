
## Esito

- Progetto Claude Design: https://claude.ai/artifact/4MTnXgrpFWHsegaL47BcbT (riga "F-11 · Amici").
- Esportazione in `esportazione/`: il prototipo navigabile `Amici.dc.html` (tutte le schermate
  e gli stati, con i parametri `tema`, `schermata`, `stato`, `fascia`), le tavole
  `F11-01`…`F11-08` (amici; cerca; il mio codice e scansiona; anteprima del codice e richiesta
  ricevuta, con le varianti per chi ha 14–17 anni; profili; segnala e blocca; persone
  bloccate e le mie segnalazioni; verifica a 360 px), i componenti nuovi
  (`Componenti-amici.dc.html`: riga persona, ricerca con risultati, QR con codice, menu ⋯,
  toast con «Annulla», motivo di segnalazione, voce di profilo) e il foglio
  `noxa-amici.css` (layer "amici", solo token di noxa.css).
- Le tavole si vedono nel progetto Claude Design; le schermate di confronto si catturano
  durante l'iterazione 3 (skill `implement-design`).

## Implementazione (iterazione 3)

Schermate in `apps/web/src/features/amici/`, route `/profilo`, `/profilo/modifica`,
`/profilo/bloccati`, `/profilo/segnalazioni`, `/amici`, `/amici/cerca`, `/amici/codice`,
`/amici/scansiona`, `/amici/invito?c=…`, `/persona?id=…`. Differenze volute rispetto alle
tavole:

- **Richiesta arrivata con il codice**: nell'elenco c'è «Vedi il profilo» invece di Accetta /
  Rifiuta, così la decisione si prende sempre dalla schermata che mostra l'avviso per chi ha
  14–17 anni (R-12); le richieste dalla ricerca hanno Accetta / Rifiuta nella riga.
- **Segnalazione offline**: si può già scrivere il testo, ma i motivi restano spenti finché
  non torna la connessione (le scritture diverse dal tracker richiedono la rete,
  ARCHITECTURE.md §5.5).
- **«Non sono d'accordo» e «Puoi contestarla entro 6 mesi»**: arrivano con le decisioni dei
  moderatori e il reclamo nell'iterazione 6 (ROADMAP); ora la decisione si mostra solo se c'è.
- **Aspetto** resta nella pagina Profilo, sotto le voci, invece che in una pagina a sé.
- **Scansione**: usa la fotocamera dove il browser legge i QR (BarcodeDetector); altrove il
  codice si scrive a mano, come nello stato "senza permesso".
