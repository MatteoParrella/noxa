import type { Metadata } from 'next';

import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { ElencoAmici } from '@/features/amici/ElencoAmici';

export const metadata: Metadata = { title: 'Amici · Noxa' };

export default function Pagina() {
  return (
    <>
      <IntestazioneArea titolo="Amici" indietro={{ href: '/profilo/', etichetta: 'Profilo' }} />
      <div className="pagina flex flex-col gap-4 pt-4 pb-8">
        <ElencoAmici />
      </div>
    </>
  );
}
