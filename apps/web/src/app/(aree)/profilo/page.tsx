import type { Metadata } from 'next';

import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { MioProfilo } from '@/features/amici/MioProfilo';
import { Campanella } from '@/features/notifiche/Campanella';

export const metadata: Metadata = { title: 'Profilo · Noxa' };

export default function Pagina() {
  return (
    <>
      <IntestazioneArea titolo="Profilo" sottotitolo="Il tuo account" azioni={<Campanella />} />
      <div className="pagina flex flex-col gap-4 pt-4 pb-8">
        <MioProfilo />
      </div>
    </>
  );
}
