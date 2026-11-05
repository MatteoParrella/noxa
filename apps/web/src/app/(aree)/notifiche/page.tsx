import type { Metadata } from 'next';
import { Suspense } from 'react';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { ElencoNotifiche } from '@/features/notifiche/ElencoNotifiche';
import { messaggi } from '@/lib/messaggi/it';

export const metadata: Metadata = { title: 'Notifiche · Noxa' };

const testi = messaggi.notifiche;

export default function PaginaNotifiche() {
  return (
    <>
      <IntestazioneArea titolo={testi.titolo} />
      <div className="pagina flex flex-col gap-4 pt-4 pb-8">
        <Suspense>
          <ElencoNotifiche />
        </Suspense>
      </div>
    </>
  );
}
