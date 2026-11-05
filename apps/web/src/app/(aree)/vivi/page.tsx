import type { Metadata } from 'next';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { Rivela } from '@/components/ui/Movimento';
import { Campanella } from '@/features/notifiche/Campanella';
import { AreaVivi, OraStasera } from '@/features/vivi/AreaVivi';
import { messaggi } from '@/lib/messaggi/it';

export const metadata: Metadata = { title: 'Vivi · Noxa' };

const testi = messaggi.vivi;

export default function PaginaVivi() {
  return (
    <>
      <IntestazioneArea
        sottotitolo={`${testi.titolo} · ${testi.sottotitolo}`}
        titolo={testi.stasera}
        dopoTitolo={<OraStasera />}
        azioni={<Campanella />}
      />
      <Rivela className="pagina pb-8" indice={2}>
        <AreaVivi />
      </Rivela>
    </>
  );
}
