import type { Metadata } from 'next';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { InformativaBreve } from '@/features/privacy/InformativaBreve';
import { messaggi } from '@/lib/messaggi/it';

export const metadata: Metadata = { title: 'Informativa in breve · Noxa' };

export default function Pagina() {
  const testi = messaggi.privacy.informativa;
  return (
    <>
      <IntestazioneArea
        titolo={testi.titolo}
        indietro={{ href: '/profilo/privacy/', etichetta: testi.sopratitolo }}
      />
      <div className="pagina pt-2 pb-8">
        <p className="t-corpo-s c-2 m-0">{testi.intro}</p>
        <InformativaBreve />
      </div>
    </>
  );
}
