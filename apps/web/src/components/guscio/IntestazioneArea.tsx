import type { ReactNode } from 'react';

type Props = { titolo: string; sottotitolo?: string; azioni?: ReactNode };

/** Intestazione di un'area: etichetta da pensilina e titolo editoriale. */
export function IntestazioneArea({ titolo, sottotitolo, azioni }: Props) {
  return (
    <header className="intestazione-area flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        {sottotitolo && <span className="etichetta">{sottotitolo}</span>}
        <h1 className="t-display m-0">{titolo}</h1>
      </div>
      {azioni}
    </header>
  );
}
