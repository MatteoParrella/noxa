import type { CSSProperties, ReactNode } from 'react';
import { LinkIndietro } from '@/components/guscio/Indietro';
import { TitoloRivelato } from '@/components/ui/Movimento';

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
 * Intestazione di un'area: etichetta da pensilina che entra a fuoco, titolo editoriale che
 * sale parola per parola e il bagliore arancio del lampione (ADR-0019).
 */
export function IntestazioneArea({ titolo, sottotitolo, azioni, dopoTitolo, indietro }: Props) {
  return (
    <header className="intestazione-area con-bagliore flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        {indietro && (
          <LinkIndietro
            className="btn btn-testo btn-s -ml-3 self-start"
            href={indietro.href}
            etichetta={indietro.etichetta}
          />
        )}
        {sottotitolo && (
          <span className="etichetta a-fuoco" style={{ '--ritardo': '120ms' } as CSSProperties}>
            {sottotitolo}
          </span>
        )}
        {dopoTitolo ? (
          <div className="flex flex-wrap items-baseline gap-x-3">
            <TitoloRivelato testo={titolo} className="t-display m-0" />
            {dopoTitolo}
          </div>
        ) : (
          <TitoloRivelato testo={titolo} className="t-display m-0" />
        )}
      </div>
      {azioni}
    </header>
  );
}
