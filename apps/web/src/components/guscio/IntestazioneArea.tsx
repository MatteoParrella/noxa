import type { CSSProperties, ReactNode } from 'react';
import { TitoloRivelato } from '@/components/ui/Movimento';

type Props = { titolo: string; sottotitolo?: string; azioni?: ReactNode };

/**
 * Intestazione di un'area: etichetta da pensilina che entra a fuoco, titolo editoriale che
 * sale parola per parola e il bagliore arancio del lampione (ADR-0019).
 */
export function IntestazioneArea({ titolo, sottotitolo, azioni }: Props) {
  return (
    <header className="intestazione-area con-bagliore flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
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
