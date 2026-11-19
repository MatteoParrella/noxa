import type { Metadata } from 'next';
import { Suspense } from 'react';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { Rivela } from '@/components/ui/Movimento';
import { Campanella } from '@/features/notifiche/Campanella';
import { Bacheca } from '@/features/ricorda/Bacheca';
import { CommutatoreRicorda } from '@/features/ricorda/CommutatoreRicorda';
import { EtichettaPrivato } from '@/features/ricorda/Diario';
import { messaggi } from '@/lib/messaggi/it';

export const metadata: Metadata = { title: 'Badge · Noxa' };

export default function Pagina() {
  const testi = messaggi.ricorda.badge;
  return (
    <>
      <IntestazioneArea
        sottotitolo={testi.sottotitolo}
        titolo={testi.titolo}
        dopoTitolo={<EtichettaPrivato />}
        azioni={<Campanella />}
      />
      <Rivela className="pagina pagina-larga pb-8" indice={2}>
        <CommutatoreRicorda attiva="badge" />
        <Suspense>
          <Bacheca />
        </Suspense>
      </Rivela>
    </>
  );
}
