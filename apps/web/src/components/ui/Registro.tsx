type Voce = {
  quando: string;
  /** Nome del moderatore; null per le operazioni della raccolta ("Sistema"). */
  autore: string | null;
  cosa: string;
  perche: string | null;
};

type Props = {
  voci: ReadonlyArray<Voce>;
  etichettaSistema: string;
  vuoto: string;
};

/** Registro in sola lettura delle azioni (chi, quando, cosa, motivazione). */
export function Registro({ voci, etichettaSistema, vuoto }: Props) {
  if (voci.length === 0) return <p className="guida">{vuoto}</p>;
  return (
    <ol className="registro">
      {voci.map((voce, indice) => (
        <li key={`${voce.quando}-${indice}`} className="reg-riga">
          <span className="quando">{voce.quando}</span>
          <span className="cosa">
            <b>{voce.autore ?? etichettaSistema}</b> {voce.cosa}
          </span>
          {voce.perche && <span className="perche">{voce.perche}</span>}
        </li>
      ))}
    </ol>
  );
}
