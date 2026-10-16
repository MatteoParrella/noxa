import type { Metadata } from 'next';

import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { CercaAmici } from '@/features/amici/CercaAmici';

export const metadata: Metadata = { title: 'Cerca per username · Noxa' };

export default function Pagina() {
  return (
    <>
      <IntestazioneArea
        titolo="Cerca per username"
        indietro={{ href: '/amici/', etichetta: 'Amici' }}
      />
      <div className="pagina flex flex-col gap-4 pt-4 pb-8">
        <CercaAmici />
      </div>
    </>
  );
}
