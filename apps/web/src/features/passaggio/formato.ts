import type { ServizioTrasporto, TipoServizio } from './api';

export const ORDINE_TIPI: readonly TipoServizio[] = ['mezzi_pubblici', 'taxi', 'app_trasporto'];

/** "+39024040" → "02 4040"; "+3903936379" → "039 36379". Solo per la lettura. */
export function numeroLeggibile(telefono: string): string {
  const nazionale = telefono.replace(/^\+39/, '');
  const prefisso = nazionale.startsWith('02') ? 2 : 3;
  return `${nazionale.slice(0, prefisso)} ${nazionale.slice(prefisso)}`;
}

/** Voci raggruppate per tipo, nell'ordine fisso mezzi pubblici, taxi, app (R-61). */
export function perTipo(
  servizi: readonly ServizioTrasporto[],
): Array<{ tipo: TipoServizio; voci: ServizioTrasporto[] }> {
  return ORDINE_TIPI.map((tipo) => ({
    tipo,
    voci: servizi.filter((servizio) => servizio.tipo === tipo),
  })).filter((gruppo) => gruppo.voci.length > 0);
}

/** Data dell'ultima verifica più vecchia tra le voci, "15.11.2026". */
export function ultimaVerifica(servizi: readonly ServizioTrasporto[]): string | null {
  const date = servizi.map((servizio) => servizio.verificato_il).sort();
  const prima = date[0];
  if (!prima) return null;
  const [anno, mese, giorno] = prima.split('-');
  return anno && mese && giorno ? `${giorno}.${mese}.${anno}` : null;
}
