import type { Metadata } from 'next';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { ChiLoVede } from '@/features/vivi/ChiLoVede';
import { messaggi } from '@/lib/messaggi/it';

export const metadata: Metadata = { title: 'Chi lo vede · Noxa' };

const testi = messaggi.vivi.chiLoVede;

export default function PaginaChiLoVede() {
  return (
    <>
      <IntestazioneArea
        titolo={testi.titolo}
        indietro={{ href: '/vivi/', etichetta: testi.sopratitolo }}
      />
      <div className="pagina pt-2 pb-8">
        <ChiLoVede />
      </div>
    </>
  );
}
