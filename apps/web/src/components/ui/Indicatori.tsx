import { classi } from '@/lib/classi';

type PropsPassi = { passo: number; totale: number; testo: string; etichetta: string };

/** "1 di 4" in monospaziato con le barre: fatte in testo primario, l'attuale in arancio. */
export function IndicatorePassi({ passo, totale, testo, etichetta }: PropsPassi) {
  return (
    <div className="passi" role="img" aria-label={etichetta}>
      <span className="passi-testo" aria-hidden="true">
        {testo}
      </span>
      <span className="passi-barre" aria-hidden="true">
        {Array.from({ length: totale }, (_, indice) => (
          <i
            key={indice}
            className={classi(indice + 1 < passo && 'fatto', indice + 1 === passo && 'ora')}
          />
        ))}
      </span>
    </div>
  );
}

type PropsPunti = { attuale: number; totale: number; etichetta: string };

/** Indicatore a punti: quello attuale è più lungo e arancio. */
export function IndicatorePunti({ attuale, totale, etichetta }: PropsPunti) {
  return (
    <div className="punti" role="img" aria-label={etichetta}>
      {Array.from({ length: totale }, (_, indice) => (
        <i key={indice} className={classi(indice + 1 === attuale && 'ora')} />
      ))}
    </div>
  );
}
