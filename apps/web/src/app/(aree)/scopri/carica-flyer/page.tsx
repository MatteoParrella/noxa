import type { Metadata } from 'next';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { CaricaFlyer } from '@/features/scopri/CaricaFlyer';
import { messaggi } from '@/lib/messaggi/it';

export const metadata: Metadata = { title: 'Carica un flyer · Noxa' };

const testi = messaggi.scopri.caricaFlyer;

export default function PaginaCaricaFlyer() {
  return (
    <>
      <IntestazioneArea
        titolo={testi.titolo}
        sottotitolo={testi.sottotitolo}
        indietro={{ href: '/scopri/', etichetta: testi.indietro }}
      />
      <div className="pagina flex flex-col gap-6 pt-4 pb-8">
        <CaricaFlyer />
      </div>
    </>
  );
}
