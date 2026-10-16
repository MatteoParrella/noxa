import type { Metadata } from 'next';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { Rivela } from '@/components/ui/Movimento';
import { ImpostazioniAspetto } from '@/features/account/ImpostazioniAspetto';
import { PulsanteEsci } from '@/features/account/PulsanteEsci';
import { messaggi } from '@/lib/messaggi/it';

export const metadata: Metadata = { title: 'Profilo · Noxa' };

export default function PaginaProfilo() {
  return (
    <>
      <IntestazioneArea sottotitolo="Il tuo account" titolo="Profilo" />
      <Rivela className="pagina flex flex-col gap-4 pt-4" indice={2}>
        <div className="etichetta-riga">
          <h2 className="etichetta m-0">Aspetto</h2>
        </div>
        <ImpostazioniAspetto />
        <div className="etichetta-riga mt-4">
          <h2 className="etichetta m-0">{messaggi.profilo.account}</h2>
        </div>
        <PulsanteEsci />
      </Rivela>
    </>
  );
}
