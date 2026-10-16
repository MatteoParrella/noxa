import type { Metadata } from 'next';

import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { MioCodice } from '@/features/amici/MioCodice';

export const metadata: Metadata = { title: 'Il mio codice · Noxa' };

export default function Pagina() {
  return (
    <>
      <IntestazioneArea titolo="Il mio codice" indietro={{ href: '/amici/', etichetta: 'Amici' }} />
      <div className="pagina flex flex-col gap-4 pt-4 pb-8">
        <MioCodice />
      </div>
    </>
  );
}
