'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { classi } from '@/lib/classi';
import { Avatar } from './Avatar';

export type PersonaRiscontro = { nome: string; foto?: string | null };

export type DatiRiscontro = {
  /**
   * `amicizia`: i due avatar si avvicinano; `gruppo`: i membri entrano in fila; `serata`:
   * tutti insieme, «Ci siete tutti» (design/F-01-rinfresco-interfaccia, brief §4).
   */
  tipo: 'amicizia' | 'gruppo' | 'serata';
  titolo: string;
  testo?: string;
  persone: PersonaRiscontro[];
};

/** Il movimento dura al massimo 900 ms; il riscontro resta leggibile ancora un poco. */
const DURATA_MS = 2600;
const MASSIMO_AVATAR = 5;

/**
 * Riscontro caldo di un'azione riuscita: breve, una sola volta, si chiude con un tocco o con
 * Esc. Non è un dialogo: non prende il focus e il testo arriva ai lettori di schermo come
 * messaggio di stato. Con il movimento ridotto resta solo la dissolvenza.
 */
export function Riscontro({ dati, onFine }: { dati: DatiRiscontro; onFine: () => void }) {
  const fine = useRef(onFine);
  useEffect(() => {
    fine.current = onFine;
  }, [onFine]);
  useEffect(() => {
    const timer = window.setTimeout(() => fine.current(), DURATA_MS);
    const suTasto = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') fine.current();
    };
    window.addEventListener('keydown', suTasto);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', suTasto);
    };
  }, []);

  const mostrate = dati.persone.slice(0, MASSIMO_AVATAR);
  const altri = dati.persone.length - mostrate.length;
  return createPortal(
    <div className="riscontro-velo" onClick={() => fine.current()}>
      <div className={classi('riscontro', `riscontro-${dati.tipo}`)} role="status">
        <div className="riscontro-persone" aria-hidden="true">
          {mostrate.map((persona, indice) => (
            <span
              key={`${persona.nome}-${indice}`}
              className="riscontro-avatar"
              style={{ '--indice': indice, '--totale': mostrate.length } as CSSProperties}
            >
              <Avatar nome={persona.nome} foto={persona.foto ?? null} dimensione="l" decorativo />
            </span>
          ))}
          {altri > 0 && <span className="riscontro-altri">+{altri}</span>}
        </div>
        <p className="riscontro-titolo">{dati.titolo}</p>
        {dati.testo && <p className="riscontro-testo">{dati.testo}</p>}
      </div>
    </div>,
    document.body,
  );
}

const ContestoRiscontro = createContext<(dati: DatiRiscontro) => void>(() => undefined);

/** Un riscontro per volta a livello dell'app, come i toast. */
export function FornitoreRiscontro({ children }: { children: ReactNode }) {
  const [attuale, setAttuale] = useState<(DatiRiscontro & { chiave: number }) | null>(null);
  const mostra = useCallback(
    (dati: DatiRiscontro) => setAttuale({ ...dati, chiave: Date.now() }),
    [],
  );
  return (
    <ContestoRiscontro.Provider value={mostra}>
      {children}
      {attuale && <Riscontro key={attuale.chiave} dati={attuale} onFine={() => setAttuale(null)} />}
    </ContestoRiscontro.Provider>
  );
}

export function useRiscontro() {
  return useContext(ContestoRiscontro);
}
