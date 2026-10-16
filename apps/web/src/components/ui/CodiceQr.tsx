import { encode } from 'uqr';
import { classi } from '@/lib/classi';

type Props = {
  valore: string;
  /** Testo alternativo: il codice scritto sotto il QR. */
  etichetta: string;
  spento?: boolean;
  children?: React.ReactNode;
};

/**
 * QR nero su bianco in entrambi i temi, disegnato come SVG con i moduli del codice
 * (correzione d'errore M). Il codice scritto accanto è l'alternativa testuale.
 */
export function CodiceQr({ valore, etichetta, spento = false, children }: Props) {
  const qr = encode(valore, { ecc: 'M', border: 0 });
  let percorso = '';
  qr.data.forEach((riga, y) =>
    riga.forEach((pieno, x) => {
      if (pieno) percorso += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return (
    <div className={classi('qr-box', spento && 'is-spento')}>
      <svg
        viewBox={`0 0 ${qr.size} ${qr.size}`}
        role="img"
        aria-label={etichetta}
        shapeRendering="crispEdges"
      >
        <path d={percorso} />
      </svg>
      {children && <div className="qr-velo">{children}</div>}
    </div>
  );
}
