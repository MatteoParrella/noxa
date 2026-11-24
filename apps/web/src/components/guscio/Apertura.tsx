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
      <svg className="apertura-simbolo" viewBox="110 100 292 312" focusable="false">
        <g className="apertura-lettera">
          <path d="M121.6 396.2V122H184.1L188.6 155.4H190.9Q197.6 141.8 206.4 133Q215.2 124.2 226.9 119.9Q238.6 115.7 253 115.7Q275.2 115.7 288.6 124.3Q302 132.9 308.2 149.5Q314.4 166.1 314.4 191V396.2H242V211.1Q242 204.6 240.9 199.4Q239.8 194.1 237.4 190.4Q234.9 186.6 231 184.6Q227.2 182.6 221.5 182.6Q212.1 182.6 206 189.3Q199.8 196.1 196.9 208.2Q194 220.4 194 237.5V396.2Z" />
        </g>
        <circle className="apertura-punto" cx="360.4" cy="145.8" r="30" />
      </svg>
    </div>
  );
}
