import type { Metadata } from 'next';
import { Suspense } from 'react';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { AnteprimaCodice } from '@/features/amici/AnteprimaCodice';

export const metadata: Metadata = { title: 'Codice invito · Noxa' };

export default function Pagina() {
  return (
    <>
      <IntestazioneArea titolo="Codice invito" indietro={{ href: '/amici/', etichetta: 'Amici' }} />
      <div className="pagina flex flex-col gap-4 pt-4 pb-8">
        <Suspense>
          <AnteprimaCodice />
        </Suspense>
      </div>
    </>
  );
}
