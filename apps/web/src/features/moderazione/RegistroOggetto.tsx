'use client';

import { Registro } from '@/components/ui/Registro';
import { Caricamento } from '@/components/ui/Stati';
import { messaggi } from '@/lib/messaggi/it';
import type { TipoRegistro, VoceRegistro } from './api';
import { useRegistro } from './dati';
import { dataOra } from './formato';

const testi = messaggi.moderazione;

function voce(riga: VoceRegistro) {
  const azioni = testi.registroAzioni as Record<string, string>;
  const cosa = azioni[riga.azione] ?? testi.registroAzioni.altro;
  // Per le operazioni della raccolta la "motivazione" è la fonte: fa parte della frase.
  const sistema = riga.azione === 'evento_creato' || riga.azione === 'evento_aggiornato';
  return {
    quando: dataOra(riga.creata_il),
    autore: riga.autore,
    cosa: sistema ? `${cosa} ${riga.motivazione ?? ''}`.trim() : cosa,
    perche: sistema ? null : riga.motivazione,
  };
}

/** Registro in sola lettura di un locale, una fonte o un evento. */
export function RegistroOggetto({ tipo, id }: { tipo: TipoRegistro; id: string }) {
  const registro = useRegistro(tipo, id);
  return (
    <section className="md-sezione" aria-labelledby={`registro-${id}`}>
      <h2 id={`registro-${id}`} className="etichetta-riga">
        {testi.comune.registro}
      </h2>
      {registro.isPending && <Caricamento descrizione={testi.comune.caricamento} righe={2} />}
      {registro.isError && <p className="guida">{testi.comune.erroreCaricamento.testo}</p>}
      {registro.data && (
        <Registro
          voci={registro.data.map(voce)}
          etichettaSistema={testi.comune.sistema}
          vuoto={testi.comune.registroVuoto}
        />
      )}
    </section>
  );
}
