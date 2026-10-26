import type { Metadata } from 'next';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { Rivela } from '@/components/ui/Movimento';
import { OrganizzaGruppi } from '@/features/gruppi/OrganizzaGruppi';
import { Campanella } from '@/features/notifiche/Campanella';
import { messaggi } from '@/lib/messaggi/it';

export const metadata: Metadata = { title: 'Organizza · Noxa' };

export default function PaginaOrganizza() {
  return (
    <>
      <IntestazioneArea
        sottotitolo={messaggi.gruppi.organizza.sottotitolo}
        titolo={messaggi.gruppi.organizza.titolo}
        azioni={<Campanella />}
      />
      <Rivela className="pagina pt-2 pb-8" indice={2}>
        <OrganizzaGruppi />
      </Rivela>
    </>
  );
}
