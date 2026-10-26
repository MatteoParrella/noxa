import type { Metadata } from 'next';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { CreaGruppo } from '@/features/gruppi/CreaGruppo';
import { messaggi } from '@/lib/messaggi/it';

export const metadata: Metadata = { title: 'Crea un gruppo · Noxa' };

export default function Pagina() {
  return (
    <>
      <IntestazioneArea
        titolo={messaggi.gruppi.crea.titolo}
        indietro={{ href: '/organizza/', etichetta: messaggi.gruppi.organizza.titolo }}
      />
      <div className="pagina pt-4 pb-8">
        <CreaGruppo />
      </div>
    </>
  );
}
