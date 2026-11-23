'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type PointerEvent, type ReactNode } from 'react';
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

/** Spostamento verso il basso (px) o velocità (px/ms) oltre cui il foglio trascinato si chiude. */
const SOGLIA_CHIUSURA = 96;
const VELOCITA_CHIUSURA = 0.6;

/**
 * Foglio dal basso o finestra modale su <dialog>: il browser gestisce il focus (nessuna
 * trappola, Esc chiude) e rende inerte il resto della pagina. Il foglio si chiude anche
 * trascinando in basso la maniglia o la testata, come i fogli di iOS (ADR-0035); se il
 * trascinamento è breve torna su con una molla. Tastiera e lettori di schermo usano Esc e il
 * pulsante Chiudi.
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
  const trascina = useRef<{ inizio: number; tempo: number; spostamento: number } | null>(null);
  const idTitolo = useId();

  useEffect(() => {
    const dialogo = riferimento.current;
    if (!dialogo) return;
    if (aperto && !dialogo.open) dialogo.showModal();
    if (!aperto && dialogo.open) dialogo.close();
  }, [aperto]);

  const trascinabile = forma === 'foglio' && chiudibile;

  function inizia(evento: PointerEvent<HTMLElement>) {
    if (!trascinabile || evento.button !== 0) return;
    // I pulsanti della testata (Chiudi, accessorio) restano cliccabili.
    if ((evento.target as HTMLElement).closest('button:not(.foglio-maniglia), a')) return;
    trascina.current = { inizio: evento.clientY, tempo: evento.timeStamp, spostamento: 0 };
    evento.currentTarget.setPointerCapture(evento.pointerId);
    riferimento.current?.classList.add('is-trascinato');
  }

  function muovi(evento: PointerEvent<HTMLElement>) {
    const stato = trascina.current;
    const dialogo = riferimento.current;
    if (!stato || !dialogo) return;
    // Verso l'alto il foglio resiste (un quinto dello spostamento), verso il basso segue il dito.
    const delta = evento.clientY - stato.inizio;
    stato.spostamento = delta > 0 ? delta : delta / 5;
    dialogo.style.transform = `translateY(${stato.spostamento}px)`;
  }

  function rilascia(evento: PointerEvent<HTMLElement>) {
    const stato = trascina.current;
    const dialogo = riferimento.current;
    trascina.current = null;
    if (!stato || !dialogo) return;
    dialogo.classList.remove('is-trascinato');
    const velocita = stato.spostamento / Math.max(1, evento.timeStamp - stato.tempo);
    dialogo.style.transform = '';
    if (stato.spostamento > SOGLIA_CHIUSURA || velocita > VELOCITA_CHIUSURA) onChiudi();
  }

  const gestoriTrascina = trascinabile
    ? {
        onPointerDown: inizia,
        onPointerMove: muovi,
        onPointerUp: rilascia,
        onPointerCancel: rilascia,
      }
    : {};

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
      <div className={classi(trascinabile && 'foglio-testata')} {...gestoriTrascina}>
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
      </div>
      {children}
    </dialog>
  );
}
