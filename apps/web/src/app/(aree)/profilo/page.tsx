import type { Metadata } from 'next';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { Rivela } from '@/components/ui/Movimento';
import { ImpostazioniAspetto } from '@/features/account/ImpostazioniAspetto';

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
      </Rivela>
    </>
  );
}
