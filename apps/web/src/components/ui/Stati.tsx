import { CloudOff, RotateCw, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Icona } from './Icona';
import { Pulsante } from './Pulsante';

type PropsVuoto = {
  icona: LucideIcon;
  titolo: string;
  children?: ReactNode;
  azione?: ReactNode;
};

/** Stato vuoto: dice cosa manca e, se possibile, offre un'azione. */
export function ElencoVuoto({ icona, titolo, children, azione }: PropsVuoto) {
  return (
    <div className="stato-vuoto">
      <span className="cornice-icona">
        <Icona icona={icona} dimensione="l" />
      </span>
      <h2 className="t-titolo-3 m-0">{titolo}</h2>
      {children && <p className="t-corpo-s c-2 m-0">{children}</p>}
      {azione}
    </div>
  );
}

type PropsCaricamento = {
  /** Testo per i lettori di schermo, per esempio "Carico gli eventi". */
  descrizione: string;
  righe?: number;
};

/** Scheletri sobri al posto degli spinner; annunciato una volta ai lettori di schermo. */
export function Caricamento({ descrizione, righe = 3 }: PropsCaricamento) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">{descrizione}</span>
      {Array.from({ length: righe }, (_, indice) => (
        <div key={indice} className="flex gap-4" aria-hidden="true">
          <div className="scheletro h-10 w-16" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="scheletro h-4 w-3/4" />
            <div className="scheletro h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

type PropsErrore = {
  titolo: string;
  children: ReactNode;
  onRiprova: () => void;
  riprovaInCorso?: boolean;
};

/** Errore con l'azione per riprovare (DESIGN.md §3). */
export function ErroreConAzione({
  titolo,
  children,
  onRiprova,
  riprovaInCorso = false,
}: PropsErrore) {
  return (
    <div role="alert" className="stato-vuoto">
      <h2 className="t-titolo-3 m-0">{titolo}</h2>
      <p className="t-corpo-s c-2 m-0">{children}</p>
      <Pulsante
        variante="secondario"
        dimensione="s"
        onClick={onRiprova}
        caricamento={riprovaInCorso}
      >
        <Icona icona={RotateCw} dimensione="s" />
        Riprova
      </Pulsante>
    </div>
  );
}

const TESTO_OFFLINE =
  'Sei offline: vedi i dati salvati sul telefono. Le modifiche partono quando torna la rete.';

/** Striscia mostrata quando il dispositivo è offline. */
export function StrisciaOffline({ testo = TESTO_OFFLINE }: { testo?: string }) {
  return (
    <div className="striscia-offline" role="status">
      <Icona icona={CloudOff} dimensione="s" />
      <span>{testo}</span>
    </div>
  );
}
