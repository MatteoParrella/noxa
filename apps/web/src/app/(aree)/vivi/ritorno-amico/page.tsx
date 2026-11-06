import type { Metadata } from 'next';
import { Suspense } from 'react';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { RitornoAmico } from '@/features/ritorno/RitornoAmico';
import { messaggi } from '@/lib/messaggi/it';

export const metadata: Metadata = { title: 'Ritorno sicuro · Noxa' };

const testi = messaggi.ritorno.amico;

export default function PaginaRitornoAmico() {
  return (
    <>
      <IntestazioneArea
        titolo={testi.etichetta}
        indietro={{ href: '/vivi/', etichetta: testi.sopratitolo }}
      />
      <div className="pagina pt-2 pb-8">
        <Suspense>
          <RitornoAmico />
        </Suspense>
      </div>
    </>
  );
}
