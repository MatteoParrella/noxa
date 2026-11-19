import type { Metadata } from 'next';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { Rivela } from '@/components/ui/Movimento';
import { Campanella } from '@/features/notifiche/Campanella';
import { CommutatoreRicorda } from '@/features/ricorda/CommutatoreRicorda';
import { EtichettaPrivato } from '@/features/ricorda/Diario';
import { Statistiche } from '@/features/ricorda/Statistiche';
import { messaggi } from '@/lib/messaggi/it';

export const metadata: Metadata = { title: 'Statistiche · Noxa' };

export default function Pagina() {
  const testi = messaggi.ricorda.statistiche;
  return (
    <>
      <IntestazioneArea
        sottotitolo={testi.sottotitolo}
        titolo={testi.titolo}
        dopoTitolo={<EtichettaPrivato />}
        azioni={<Campanella />}
      />
      <Rivela className="pagina pagina-larga pb-8" indice={2}>
        <CommutatoreRicorda attiva="statistiche" />
        <Statistiche />
      </Rivela>
    </>
  );
}
