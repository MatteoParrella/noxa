import type { Metadata } from 'next';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { PrivacyDati } from '@/features/privacy/PrivacyDati';
import { messaggi } from '@/lib/messaggi/it';

export const metadata: Metadata = { title: 'Privacy e dati · Noxa' };

export default function Pagina() {
  const testi = messaggi.privacy.pagina;
  return (
    <>
      <IntestazioneArea
        titolo={testi.titolo}
        indietro={{ href: '/profilo/', etichetta: testi.sopratitolo }}
      />
      <div className="pagina pt-2 pb-8">
        <p className="t-corpo-s c-2 m-0">{testi.intro}</p>
        <PrivacyDati />
      </div>
    </>
  );
}
