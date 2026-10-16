import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { Icona } from '@/components/ui/Icona';
import { TitoloRivelato } from '@/components/ui/Movimento';

type Props = {
  titolo: string;
  sottotitolo?: string;
  azioni?: ReactNode;
  /** Pagina interna di un'area: link per tornare alla pagina che la contiene. */
  indietro?: { href: string; etichetta: string };
};

/**
 * Intestazione di un'area: etichetta da pensilina che entra a fuoco, titolo editoriale che
 * sale parola per parola e il bagliore arancio del lampione (ADR-0019).
 */
export function IntestazioneArea({ titolo, sottotitolo, azioni, indietro }: Props) {
  return (
    <header className="intestazione-area con-bagliore flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        {indietro && (
          <Link className="btn btn-testo btn-s -ml-3 self-start" href={indietro.href}>
            <Icona icona={ChevronLeft} dimensione="s" />
            {indietro.etichetta}
          </Link>
        )}
        {sottotitolo && (
          <span className="etichetta a-fuoco" style={{ '--ritardo': '120ms' } as CSSProperties}>
            {sottotitolo}
          </span>
        )}
        <TitoloRivelato testo={titolo} className="t-display m-0" />
      </div>
      {azioni}
    </header>
  );
}
