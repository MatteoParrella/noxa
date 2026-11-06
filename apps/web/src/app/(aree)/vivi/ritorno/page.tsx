import type { Metadata } from 'next';
import { Suspense } from 'react';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { DettaglioRitorno } from '@/features/ritorno/DettaglioRitorno';
import { messaggi } from '@/lib/messaggi/it';

export const metadata: Metadata = { title: 'Il tuo ritorno · Noxa' };

const testi = messaggi.ritorno.dettaglio;

export default function PaginaRitorno() {
  return (
    <>
      <IntestazioneArea
        titolo={testi.titolo}
        indietro={{ href: '/vivi/', etichetta: testi.sopratitolo }}
      />
      <div className="pagina pt-2 pb-8">
        <Suspense>
          <DettaglioRitorno />
        </Suspense>
      </div>
    </>
  );
}
