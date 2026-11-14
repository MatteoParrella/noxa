/**
 * Schermata di apertura: il marchio sale e il lampione si accende, poi la schermata si
 * dissolve da sola (solo CSS, movimento.css). Compare una volta per sessione: lo script del
 * tema la spegne nelle pagine successive (lib/tema.ts). Decorativa, non blocca i tocchi e con
 * il movimento ridotto non compare (ADR-0019).
 */
export function Apertura() {
  return (
    <div className="apertura" aria-hidden="true">
      <span className="apertura-bagliore" />
      <span className="apertura-marchio">
        <span className="apertura-parola">
          <span>noxa</span>
        </span>
        <span className="apertura-punto" />
      </span>
    </div>
  );
}
