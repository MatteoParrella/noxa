'use client';

import { createElement, useCallback, type CSSProperties, type ReactNode } from 'react';
import { classi } from '@/lib/classi';

type PropsTitolo = {
  testo: string;
  livello?: 1 | 2;
  className?: string;
};

/**
 * Titolo che sale parola per parola (ADR-0019). Il testo resta un'unica stringa per i
 * lettori di schermo; le parole animate sono nascoste agli strumenti assistivi.
 */
export function TitoloRivelato({ testo, livello = 1, className }: PropsTitolo) {
  const parole = testo.split(' ');
  return createElement(
    `h${livello}`,
    { className: classi('titolo-rivelato', className), 'aria-label': testo },
    parole.map((parola, indice) => (
      <span key={`${parola}-${indice}`} className="parola" aria-hidden="true">
        <span style={{ '--indice': indice } as CSSProperties}>{parola}</span>
        {indice < parole.length - 1 ? ' ' : null}
      </span>
    )),
  );
}

type PropsRivela = {
  children: ReactNode;
  /** Posizione nella sequenza: ogni passo ritarda l'ingresso di --ritardo-passo. */
  indice?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article';
};

/**
 * Contenuto che entra dal sfocato quando arriva nello schermo (ADR-0019). Lo stato nascosto
 * vale solo con la classe .movimento su <html>, aggiunta dallo script iniziale.
 */
export function Rivela({ children, indice = 0, className, as = 'div' }: PropsRivela) {
  // Ref a funzione con pulizia (React 19): l'osservatore vive quanto l'elemento.
  const osserva = useCallback((elemento: HTMLElement | null) => {
    if (!elemento) return;
    if (!('IntersectionObserver' in window)) {
      elemento.classList.add('is-visibile');
      return;
    }
    const osservatore = new IntersectionObserver(
      (voci) => {
        for (const voce of voci) {
          if (voce.isIntersecting) {
            voce.target.classList.add('is-visibile');
            osservatore.unobserve(voce.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
    );
    osservatore.observe(elemento);
    return () => osservatore.disconnect();
  }, []);

  return createElement(
    as,
    {
      ref: osserva,
      className: classi('rivela', className),
      style: { '--indice': indice } as CSSProperties,
    },
    children,
  );
}
