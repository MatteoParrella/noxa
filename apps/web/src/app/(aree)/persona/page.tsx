import type { Metadata } from 'next';
import { Suspense } from 'react';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { ProfiloPersona } from '@/features/amici/ProfiloPersona';

export const metadata: Metadata = { title: 'Profilo · Noxa' };

export default function Pagina() {
  return (
    <>
      <IntestazioneArea titolo="Profilo" indietro={{ href: '/amici/', etichetta: 'Amici' }} />
      <div className="pagina flex flex-col gap-4 pt-4 pb-8">
        <Suspense>
          <ProfiloPersona />
        </Suspense>
      </div>
    </>
  );
}
