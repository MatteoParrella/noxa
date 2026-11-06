import type { Metadata } from 'next';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { ChiLoVedeRitorno } from '@/features/ritorno/ChiLoVedeRitorno';
import { messaggi } from '@/lib/messaggi/it';

export const metadata: Metadata = { title: 'Chi vede il ritorno · Noxa' };

const testi = messaggi.ritorno.chiLoVede;

export default function PaginaChiLoVedeRitorno() {
  return (
    <>
      <IntestazioneArea
        titolo={testi.titolo}
        indietro={{ href: '/vivi/ritorno/', etichetta: testi.sopratitolo }}
      />
      <div className="pagina pt-2 pb-8">
        <ChiLoVedeRitorno />
      </div>
    </>
  );
}
