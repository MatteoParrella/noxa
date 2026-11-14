/**
 * Schermata di apertura: solo il simbolo di Noxa. La «n» sale, il lampione si accende con il
 * suo bagliore, poi la schermata si apre sulla pagina sotto (il Benvenuto senza sessione,
 * Scopri con la sessione). Solo CSS (movimento.css): compare una volta per sessione, perché lo
 * script del tema la spegne nelle pagine successive (lib/tema.ts). Decorativa, non blocca i
 * tocchi e con il movimento ridotto non compare (ADR-0019).
 */
export function Apertura() {
  return (
    <div className="apertura" aria-hidden="true">
      <span className="apertura-bagliore" />
      {/* Stesso disegno di public/icone/icona.svg, senza il fondo. */}
      <svg className="apertura-simbolo" viewBox="120 100 320 300" focusable="false">
        <g className="apertura-lettera">
          <path d="M150 380V196h56v26c18-22 42-32 72-32 54 0 84 34 84 94v96h-58v-88c0-32-14-48-42-48-30 0-56 20-56 58v78z" />
        </g>
        <circle className="apertura-punto" cx="392" cy="150" r="28" />
      </svg>
    </div>
  );
}
