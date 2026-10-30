import type { Metadata } from 'next';

import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { PersoneBloccate } from '@/features/amici/PersoneBloccate';

export const metadata: Metadata = { title: 'Persone bloccate · Noxa' };

export default function Pagina() {
  return (
    <>
      <IntestazioneArea
        titolo="Persone bloccate"
        indietro={{ href: '/profilo/privacy/', etichetta: 'Privacy e dati' }}
      />
      <div className="pagina flex flex-col gap-4 pt-4 pb-8">
        <PersoneBloccate />
      </div>
    </>
  );
}
