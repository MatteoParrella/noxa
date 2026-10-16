'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pulsante } from './Pulsante';

type Props = {
  testo: string;
  icona?: ReactNode;
  /** Azione per tornare indietro, per esempio "Annulla" dopo un blocco. */
  azione?: { etichetta: string; onScegli: () => void };
  onChiudi: () => void;
  /** Millisecondi prima che sparisca; si ferma con il dito o il focus sopra. */
  durata?: number;
};

/** Messaggio breve in fondo allo schermo, annunciato con cortesia ai lettori di schermo. */
export function Toast({ testo, icona, azione, onChiudi, durata = 6000 }: Props) {
  const [fermo, setFermo] = useState(false);
  const ultimoOnChiudi = useRef(onChiudi);
  useEffect(() => {
    ultimoOnChiudi.current = onChiudi;
  });

  useEffect(() => {
    if (fermo) return;
    const timer = window.setTimeout(() => ultimoOnChiudi.current(), durata);
    return () => window.clearTimeout(timer);
  }, [fermo, durata]);

  return (
    <div
      className="toast toast-basso"
      role="status"
      onPointerEnter={() => setFermo(true)}
      onPointerLeave={() => setFermo(false)}
      onFocus={() => setFermo(true)}
      onBlur={() => setFermo(false)}
    >
      {icona}
      <span className="toast-testo">{testo}</span>
      {azione && (
        <Pulsante variante="testo" dimensione="s" onClick={azione.onScegli}>
          {azione.etichetta}
        </Pulsante>
      )}
    </div>
  );
}

type OpzioniToast = Omit<Props, 'onChiudi'>;

const ContestoToast = createContext<(opzioni: OpzioniToast) => void>(() => undefined);

/**
 * Un toast per volta a livello dell'app: resta visibile anche quando il componente che l'ha
 * chiesto sparisce (per esempio la riga di una persona appena bloccata).
 */
export function FornitoreToast({ children }: { children: ReactNode }) {
  const [attuale, setAttuale] = useState<(OpzioniToast & { chiave: number }) | null>(null);
  const mostra = useCallback(
    (opzioni: OpzioniToast) => setAttuale({ ...opzioni, chiave: Date.now() }),
    [],
  );
  return (
    <ContestoToast.Provider value={mostra}>
      {children}
      {attuale && (
        <Toast
          key={attuale.chiave}
          testo={attuale.testo}
          {...(attuale.icona ? { icona: attuale.icona } : {})}
          {...(attuale.azione
            ? {
                azione: {
                  etichetta: attuale.azione.etichetta,
                  onScegli: () => {
                    setAttuale(null);
                    attuale.azione?.onScegli();
                  },
                },
              }
            : {})}
          {...(attuale.durata ? { durata: attuale.durata } : {})}
          onChiudi={() => setAttuale(null)}
        />
      )}
    </ContestoToast.Provider>
  );
}

export function useToast() {
  return useContext(ContestoToast);
}
