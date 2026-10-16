'use client';

import { ChevronLeft } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { StatoConnessione } from '@/components/guscio/StatoConnessione';
import { Icona } from '@/components/ui/Icona';
import { TitoloRivelato } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { classi } from '@/lib/classi';
import { messaggi } from '@/lib/messaggi/it';

type Props = {
  /** Azione del pulsante "Indietro" in alto a sinistra; senza, il pulsante non c'è. */
  onIndietro?: (() => void) | undefined;
  /** Contenuto accanto al pulsante "Indietro" (indicatore dei passi). */
  testa?: ReactNode;
  illustrazione?: ReactNode;
  etichetta?: string;
  titolo?: string;
  children?: ReactNode;
  piede?: ReactNode;
  piedeSenzaFilo?: boolean;
  /** Bagliore arancio: solo nel Benvenuto (design/F-10-accesso). */
  bagliore?: boolean;
  /** Corpo allineato in basso (Benvenuto). */
  inFondo?: boolean;
  /** Testo della striscia offline, se diverso da quello predefinito. */
  testoOffline?: string;
  /** Classe del corpo, per esempio il passaggio orizzontale tra i passi. */
  classeCorpo?: string;
};

/**
 * Impaginazione delle schermate di accesso: testa con "Indietro", corpo con etichetta e
 * titolo che sale parola per parola, piede fisso con le azioni (ADR-0019).
 */
export function Schermata({
  onIndietro,
  testa,
  illustrazione,
  etichetta,
  titolo,
  children,
  piede,
  piedeSenzaFilo = false,
  bagliore = false,
  inFondo = false,
  testoOffline,
  classeCorpo,
}: Props) {
  return (
    <main id="contenuto" className="schermo-accesso" tabIndex={-1}>
      {bagliore && <div className="bagliore-benvenuto" aria-hidden="true" />}
      {testoOffline ? <StatoConnessione testo={testoOffline} /> : <StatoConnessione />}
      <div className="schermo-testa">
        {onIndietro && (
          <Pulsante
            variante="neutro"
            soloIcona
            aria-label={messaggi.comune.indietro}
            onClick={onIndietro}
          >
            <Icona icona={ChevronLeft} dimensione="l" />
          </Pulsante>
        )}
        {testa}
      </div>
      <div className={classi('schermo-corpo', inFondo && 'in-fondo', classeCorpo)}>
        {illustrazione && <div className="mb-6">{illustrazione}</div>}
        {etichetta && (
          <span className="etichetta a-fuoco" style={{ '--ritardo': '120ms' } as CSSProperties}>
            {etichetta}
          </span>
        )}
        {titolo && <TitoloRivelato testo={titolo} className="titolo-accesso" />}
        {children}
      </div>
      {piede && (
        <div className={classi('schermo-piede', piedeSenzaFilo && 'senza-filo')}>{piede}</div>
      )}
    </main>
  );
}
