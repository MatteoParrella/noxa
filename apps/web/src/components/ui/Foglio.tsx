'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { classi } from '@/lib/classi';
import { Icona } from './Icona';
import { Pulsante } from './Pulsante';

type Props = {
  aperto: boolean;
  onChiudi: () => void;
  titolo: string;
  children: ReactNode;
  /** `foglio` sale dal basso (mobile), `modale` è centrata. */
  forma?: 'foglio' | 'modale';
  /**
   * Falso per le scelte obbligatorie (nuovi termini): niente pulsante Chiudi, Esc e tocco sul
   * velo non chiudono. Le azioni del contenuto offrono sempre una via d'uscita.
   */
  chiudibile?: boolean;
  /** Elemento accanto al titolo al posto del pulsante Chiudi (es. la data scelta). */
  accessorio?: ReactNode;
};

/**
 * Foglio dal basso o finestra modale su <dialog>: il browser gestisce il focus (nessuna
 * trappola, Esc chiude) e rende inerte il resto della pagina.
 */
export function Foglio({
  aperto,
  onChiudi,
  titolo,
  children,
  forma = 'foglio',
  chiudibile = true,
  accessorio,
}: Props) {
  const riferimento = useRef<HTMLDialogElement>(null);
  const idTitolo = useId();

  useEffect(() => {
    const dialogo = riferimento.current;
    if (!dialogo) return;
    if (aperto && !dialogo.open) dialogo.showModal();
    if (!aperto && dialogo.open) dialogo.close();
  }, [aperto]);

  return (
    <dialog
      ref={riferimento}
      aria-labelledby={idTitolo}
      onClose={onChiudi}
      onCancel={(evento) => {
        if (!chiudibile) evento.preventDefault();
      }}
      onClick={(evento) => {
        // Il tocco sul velo (fuori dal contenuto) chiude.
        if (chiudibile && evento.target === riferimento.current) onChiudi();
      }}
      className={classi(
        'dialogo',
        forma === 'foglio' ? 'foglio dialogo-foglio' : 'modale dialogo-modale',
      )}
    >
      {forma === 'foglio' && <span className="foglio-maniglia" aria-hidden="true" />}
      <div className="flex items-center justify-between gap-3 pb-3">
        <h2 id={idTitolo} className="t-titolo-3 m-0">
          {titolo}
        </h2>
        {accessorio}
        {chiudibile && !accessorio && (
          <Pulsante variante="neutro" soloIcona aria-label="Chiudi" onClick={onChiudi}>
            <Icona icona={X} />
          </Pulsante>
        )}
      </div>
      {children}
    </dialog>
  );
}
