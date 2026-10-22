import type { Metadata } from 'next';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { MieiFlyer } from '@/features/scopri/MieiFlyer';
import { messaggi } from '@/lib/messaggi/it';

export const metadata: Metadata = { title: 'I miei flyer · Noxa' };

const testi = messaggi.scopri.mieiFlyer;

export default function PaginaMieiFlyer() {
  return (
    <>
      <IntestazioneArea
        titolo={testi.titolo}
        sottotitolo={testi.sottotitolo}
        indietro={{ href: '/scopri/', etichetta: testi.indietro }}
      />
      <div className="pagina flex flex-col gap-4 pt-4 pb-8">
        <MieiFlyer />
      </div>
    </>
  );
}
