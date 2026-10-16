import type { Metadata } from 'next';

import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { MieSegnalazioni } from '@/features/amici/MieSegnalazioni';

export const metadata: Metadata = { title: 'Le mie segnalazioni · Noxa' };

export default function Pagina() {
  return (
    <>
      <IntestazioneArea
        titolo="Le mie segnalazioni"
        indietro={{ href: '/profilo/', etichetta: 'Profilo' }}
      />
      <div className="pagina flex flex-col gap-4 pt-4 pb-8">
        <MieSegnalazioni />
      </div>
    </>
  );
}
