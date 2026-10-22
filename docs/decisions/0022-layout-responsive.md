# ADR-0022: Layout responsive con sidebar di navigazione

- **Stato**: Accettato
- **Data**: 2026-10-22

## Contesto
L'app è stata progettata portrait-first per telefono, con una barra di navigazione fissa in
fondo. Il product owner vuole che sia pienamente usabile anche in orizzontale e da PC
(browser desktop e PWA), ispirandosi alla fluidità editoriale di studioloop.com.br. L'area
di moderazione è già un'applicazione desktop-first (1280 px), ma deve funzionare anche in
portrait su tablet e telefono.

## Decisione

### Navigazione dell'app utente
- **≥ 768 px**: la barra di navigazione si trasforma in una **sidebar sinistra** di 68 px
  (sole icone); il guscio passa da `flex-direction: column` a `row`.
- **≥ 1024 px**: la sidebar si allarga a 200 px e mostra le **etichette** accanto alle icone;
  i contenuti delle aree (Scopri, Amici…) rimangono a colonna singola con `max-width: 720px`
  centrato nel resto dello schermo.
- Pura CSS (nessuna libreria nuova): le media query aggiornano il guscio in
  `componenti.css`. Il componente `BarraNavigazione` non cambia.
- L'indicatore animato dell'area attiva (`.nav-indicatore`, ADR-0019) rimane solo in
  portrait; in sidebar viene sostituito con un bordo sinistro sul link attivo
  (`.guscio .nav-voce.is-on::before`).

### Transizioni di navigazione
- Si aggiunge `@view-transition { navigation: auto }` con un fade leggero via
  `::view-transition-old/new(root)`. Funziona dove supportato (Chrome 111+, Safari 18+),
  si ignora silenziosamente altrove. Con `prefers-reduced-motion` la transizione è soppressa.
- Coesiste con la `.pagina-entra` del `template.tsx`: il View Transition fa il fade in uscita
  dalla vecchia pagina, `.pagina-entra` gestisce l'ingresso della nuova.

### Area di moderazione in portrait
- La sidebar dell'area di moderazione si comporta già come drawer a `≤ 720 px` (container
  query esistente in `moderazione.css`). Nessuna modifica necessaria.

## Alternative considerate
- **Route separate `/desktop/…`**: troppa duplicazione.
- **Framer Motion** o **GSAP** per le transizioni: ADR-0019 ha già scelto CSS +
  IntersectionObserver; le transizioni CSS View Transition bastano per questo effetto.
- **Lenis** (smooth scroll inerziale): efficace su browser web, ma interferisce con lo
  scroll nativo di Capacitor/WebView e richiede verifica su dispositivo fisico prima
  dell'adozione. Valutare nell'iterazione 8 (accessibilità e test su dispositivo).
- **Bottom nav visibile anche su desktop**: non scala bene su schermi larghi e mette distanza
  tra la navigazione e il pollice su touch screen larghi.

## Conseguenze
- `tokens.css` aggiunge i token `--sidebar-stretta`, `--sidebar-larga`, `--bp-tablet`,
  `--bp-desktop` per riferimento documentativo (non usati da Tailwind, ma consultabili).
- `componenti.css` aggiunge media query al fondo della sezione "GUSCIO DELL'APP".
- `movimento.css` aggiunge le regole `@view-transition` e `::view-transition-*`.
- `DESIGN.md §2` va aggiornato con i breakpoint e il comportamento responsive.
- Le verifiche Playwright esistenti (`tests/e2e/navigazione.spec.ts`) restano valide;
  nessun test nuovo è richiesto per il solo layout CSS — la verifica visiva a 1280 px già
  presente in ogni iterazione la copre.
