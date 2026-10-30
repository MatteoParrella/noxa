import type { Metadata } from 'next';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { ScaricaDati } from '@/features/privacy/ScaricaDati';
import { messaggi } from '@/lib/messaggi/it';

export const metadata: Metadata = { title: 'Scarica i tuoi dati · Noxa' };

export default function Pagina() {
  const testi = messaggi.privacy.scarica;
  return (
    <>
      <IntestazioneArea
        titolo={testi.titolo}
        indietro={{ href: '/profilo/privacy/', etichetta: testi.sopratitolo }}
      />
      <div className="pagina flex flex-col gap-5 pt-2 pb-8">
        <p className="t-corpo-s c-2 m-0">{testi.intro}</p>
        <ScaricaDati />
      </div>
    </>
  );
}
