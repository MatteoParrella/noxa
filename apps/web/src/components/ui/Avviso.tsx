import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { classi } from '@/lib/classi';
import { Icona } from './Icona';

export type TipoAvviso = 'info' | 'successo' | 'avviso' | 'errore';

const ICONE: Record<TipoAvviso, LucideIcon> = {
  info: Info,
  successo: CircleCheck,
  avviso: TriangleAlert,
  errore: CircleAlert,
};

type Props = {
  tipo: TipoAvviso;
  titolo?: string;
  children: ReactNode;
  azioni?: ReactNode;
  /** Porta l'avviso nello schermo quando compare (errori sotto un piede fisso). */
  portaInVista?: boolean;
};

/**
 * Avviso in linea. Errori e avvisi sono annunciati subito (role="alert"), info e successi
 * con cortesia (role="status"). L'icona e il titolo rendono lo stato leggibile senza colore.
 */
export function Avviso({ tipo, titolo, children, azioni, portaInVista = false }: Props) {
  const urgente = tipo === 'errore' || tipo === 'avviso';
  return (
    <div
      className={classi('avviso', `avviso-${tipo}`)}
      role={urgente ? 'alert' : 'status'}
      ref={portaInVista ? (elemento) => elemento?.scrollIntoView({ block: 'nearest' }) : undefined}
    >
      <Icona icona={ICONE[tipo]} />
      <div>
        {titolo && <strong className="avviso-titolo">{titolo}</strong>}
        <div>{children}</div>
        {azioni && <div className="avviso-azioni">{azioni}</div>}
      </div>
    </div>
  );
}
