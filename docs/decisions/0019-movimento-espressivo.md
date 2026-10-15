# ADR-0019: Movimento espressivo

- **Stato**: Accettato
- **Data**: 2026-10-15

## Contesto
Il design system nasceva con un movimento "discreto": transizioni di 150–250 ms e nessuna
animazione decorativa. Il product owner vuole un'app più viva, con riferimenti come
harderstaff.com (testi che entrano dal sfocato, aloni di luce, comparse allo scorrimento,
curva `cubic-bezier(.2,.7,.2,1)`) e vincentsaisset.com (tipografia grande animata). L'app è
usata di notte, anche da persone sensibili al movimento, e deve restare WCAG 2.2 AA.

## Decisione
- Accanto ai movimenti funzionali (150–250 ms) si aggiungono **ingressi espressivi**: curva
  `--curva-espressiva` `cubic-bezier(.2,.7,.2,1)`, durate `--movimento-espressivo` (700 ms) e
  `--movimento-ingresso` (900 ms), sfasamento `--ritardo-passo` (70 ms) tra elementi.
- Repertorio, in `apps/web/src/styles/movimento.css`:
  - titoli che salgono parola per parola (`TitoloRivelato`);
  - etichette che entrano dal sfocato al nitido;
  - bagliore arancio "lampione al sodio" che si accende una volta nell'intestazione;
  - contenuti che compaiono allo scorrimento, dal sfocato al nitido (`Rivela`);
  - ingresso della pagina a ogni cambio di area;
  - linea delle etichette da pensilina che si disegna;
  - indicatore della barra di navigazione che scorre tra le aree;
  - leggera compressione al tocco e zoom lento della foto del locale al passaggio.
- Vincoli:
  - si animano solo `transform`, `opacity` e `filter`;
  - **nessuna animazione infinita** né contenuto che si muove da solo per più di 5 secondi
    (WCAG 2.2.2);
  - l'interazione non aspetta mai un'animazione: i controlli sono subito utilizzabili;
  - con `prefers-reduced-motion` restano solo dissolvenze brevi (100 ms), senza
    spostamenti, scale o sfocature;
  - lo stato nascosto iniziale vale solo con JavaScript attivo (classe `.movimento` su
    `<html>`): senza script il contenuto è sempre visibile;
  - i titoli animati espongono il testo intero ai lettori di schermo.

## Alternative considerate
- **GSAP con ScrollTrigger** (usato da vincentsaisset.com): potente, ma aggiunge peso e una
  licenza da valutare; CSS e IntersectionObserver bastano per questo repertorio.
- **Fondi animati in loop** (aloni che si spostano di continuo, scritte che scorrono):
  scartati per WCAG 2.2.2, consumo di batteria di notte e distrazione.
- **Effetti che seguono il mouse o il puntatore** (cursori personalizzati, parallasse,
  elementi magnetici): esclusi dal product owner il 2026-10-15; su un'app da telefono non
  servono.
- **Restare al movimento discreto**: non corrisponde all'identità voluta dal product owner.

## Conseguenze
- DESIGN.md §2 e il brief del design system descrivono il nuovo movimento; il progetto Claude
  Design va aggiornato con i token di movimento.
- I test e2e attendono la fine delle animazioni prima di axe e verificano la variante con
  movimento ridotto (`tests/e2e/movimento.spec.ts`).
