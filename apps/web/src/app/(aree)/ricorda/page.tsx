import type { Metadata } from 'next';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { Rivela } from '@/components/ui/Movimento';
import { Campanella } from '@/features/notifiche/Campanella';
import { Diario, EtichettaPrivato } from '@/features/ricorda/Diario';
import { messaggi } from '@/lib/messaggi/it';

export const metadata: Metadata = { title: 'Ricorda · Noxa' };

export default function PaginaRicorda() {
  const testi = messaggi.ricorda.area;
  return (
    <>
      <IntestazioneArea
        sottotitolo={testi.sottotitolo}
        titolo={testi.titolo}
        dopoTitolo={<EtichettaPrivato />}
        azioni={<Campanella />}
      />
      <Rivela className="pagina pb-8" indice={2}>
        <Diario />
      </Rivela>
    </>
  );
}
