'use client';

import { Ellipsis } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { classi } from '@/lib/classi';
import { Icona } from './Icona';
import { Pulsante } from './Pulsante';

/** Altezza del menu più la barra di navigazione: sotto questo spazio si apre verso l'alto. */
const SPAZIO_MENU = 320;

export type VoceMenu = {
  etichetta: string;
  icona: ReactNode;
  onScegli: () => void;
  pericolo?: boolean;
  /** Linea di separazione prima di questa voce. */
  separata?: boolean;
};

type Props = {
  /** Nome del pulsante, per esempio "Altre azioni per @marco.brivio". */
  etichetta: string;
  /** Testo in cima al menu, per esempio l'username. */
  titolo?: string;
  voci: readonly VoceMenu[];
  /** Classe del pulsante ⋯, per esempio sopra una copertina. */
  className?: string;
};

/**
 * Menu "⋯" (design/F-11-amici): pulsante con nome, voci navigabili con le frecce, chiusura
 * con Esc o con un tocco fuori; il focus torna al pulsante.
 */
export function MenuAzioni({ etichetta, titolo, voci, className }: Props) {
  const [aperto, setAperto] = useState(false);
  const [sopra, setSopra] = useState(false);
  const id = useId();
  const contenitore = useRef<HTMLDivElement>(null);
  const pulsante = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aperto) return;
    contenitore.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const fuori = (evento: PointerEvent) => {
      if (!contenitore.current?.contains(evento.target as Node)) setAperto(false);
    };
    document.addEventListener('pointerdown', fuori);
    return () => document.removeEventListener('pointerdown', fuori);
  }, [aperto]);

  const chiudi = () => {
    setAperto(false);
    pulsante.current?.focus();
  };

  const tasti = (evento: KeyboardEvent<HTMLDivElement>) => {
    const elementi = [
      ...(contenitore.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []),
    ];
    const attuale = elementi.indexOf(document.activeElement as HTMLButtonElement);
    if (evento.key === 'Escape') {
      evento.preventDefault();
      chiudi();
    } else if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      const passo = evento.key === 'ArrowDown' ? 1 : -1;
      elementi[(attuale + passo + elementi.length) % elementi.length]?.focus();
    } else if (evento.key === 'Tab') {
      setAperto(false);
    }
  };

  return (
    <div className="menu-ancora" ref={contenitore} onKeyDown={tasti}>
      <Pulsante
        variante="neutro"
        soloIcona
        className={className}
        aria-label={etichetta}
        aria-haspopup="menu"
        aria-expanded={aperto}
        aria-controls={aperto ? id : undefined}
        onClick={() => {
          // Vicino al fondo (barra di navigazione fissa) il menu si apre verso l'alto.
          const riquadro = pulsante.current?.getBoundingClientRect();
          setSopra(Boolean(riquadro && window.innerHeight - riquadro.bottom < SPAZIO_MENU));
          setAperto((valore) => !valore);
        }}
        ref={pulsante}
      >
        <Icona icona={Ellipsis} dimensione="l" />
      </Pulsante>
      {aperto && (
        <div
          className={classi('menu-azioni', sopra && 'sopra')}
          role="menu"
          id={id}
          aria-label={etichetta}
        >
          {titolo && (
            <span className="menu-titolo" aria-hidden="true">
              {titolo}
            </span>
          )}
          {voci.map((voce) => (
            <div key={voce.etichetta}>
              {voce.separata && <div className="menu-sep" role="separator" />}
              <button
                type="button"
                role="menuitem"
                className={classi('menu-voce', voce.pericolo && 'pericolo')}
                onClick={() => {
                  setAperto(false);
                  voce.onScegli();
                }}
              >
                {voce.icona}
                {voce.etichetta}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
