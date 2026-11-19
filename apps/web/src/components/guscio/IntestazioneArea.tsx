'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { LinkIndietro } from '@/components/guscio/Indietro';
import { classi } from '@/lib/classi';

type Props = {
  titolo: string;
  sottotitolo?: string;
  azioni?: ReactNode;
  /** Dato accanto al titolo, per esempio la data in Scopri. */
  dopoTitolo?: ReactNode;
  /**
   * Pagina interna di un'area: il link torna alla pagina precedente dell'app; `href` ed
   * `etichetta` indicano la pagina madre, usata quando non c'è una pagina precedente.
   */
  indietro?: { href: string; etichetta: string };
};

/**
 * Intestazione di un'area in stile iOS (ADR-0035): titolo grande (Large Title) con
 * l'intestazione di sezione sopra. Quando il titolo esce dallo schermo compare in alto una
 * barra di vetro con il titolo piccolo, come la barra di navigazione di iOS che si riduce.
 * Il titolo della barra è un doppione visivo, nascosto ai lettori di schermo: il titolo
 * della pagina resta l'h1. Da nascosta la barra è `visibility: hidden`, quindi il suo
 * pulsante indietro esce anche dall'ordine del tasto Tab.
 */
export function IntestazioneArea({ titolo, sottotitolo, azioni, dopoTitolo, indietro }: Props) {
  const [ridotta, setRidotta] = useState(false);

  // Ref a funzione con pulizia (React 19): l'osservatore vive quanto il titolo.
  const osserva = useCallback((elemento: HTMLElement | null) => {
    if (!elemento || !('IntersectionObserver' in window)) return;
    const osservatore = new IntersectionObserver(
      ([voce]) => {
        if (voce) setRidotta(!voce.isIntersecting && voce.boundingClientRect.top < 0);
      },
      // Il titolo conta come uscito quando passa sotto la barra in alto.
      { rootMargin: '-56px 0px 0px 0px', threshold: 0 },
    );
    osservatore.observe(elemento);
    return () => osservatore.disconnect();
  }, []);

  const titoloGrande = (
    <h1 ref={osserva} className="t-titolo-grande m-0">
      {titolo}
    </h1>
  );

  return (
    <>
      <div className={classi('barra-titolo', ridotta && 'is-visibile')}>
        {indietro && <LinkIndietro href={indietro.href} etichetta={indietro.etichetta} />}
        <span className="barra-titolo-testo" aria-hidden="true">
          {titolo}
        </span>
      </div>
      <header className="intestazione-area con-bagliore flex items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          {indietro && (
            <LinkIndietro
              className="self-start"
              href={indietro.href}
              etichetta={indietro.etichetta}
            />
          )}
          {sottotitolo && <span className="etichetta a-fuoco">{sottotitolo}</span>}
          {dopoTitolo ? (
            <div className="flex flex-wrap items-baseline gap-x-3">
              {titoloGrande}
              {dopoTitolo}
            </div>
          ) : (
            titoloGrande
          )}
        </div>
        {azioni}
      </header>
    </>
  );
}
