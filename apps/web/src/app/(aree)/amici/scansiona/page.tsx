import type { Metadata } from 'next';

import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { ScansionaCodice } from '@/features/amici/ScansionaCodice';

export const metadata: Metadata = { title: 'Scansiona un codice · Noxa' };

export default function Pagina() {
  return (
    <>
      <IntestazioneArea
        titolo="Scansiona un codice"
        indietro={{ href: '/amici/codice/', etichetta: 'Il mio codice' }}
      />
      <div className="pagina flex flex-col gap-4 pt-4 pb-8">
        <ScansionaCodice />
      </div>
    </>
  );
}
