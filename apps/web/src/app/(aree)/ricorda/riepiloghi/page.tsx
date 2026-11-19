import type { Metadata } from 'next';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { Rivela } from '@/components/ui/Movimento';
import { EtichettaPrivato } from '@/features/ricorda/Diario';
import { ElencoRiepiloghi } from '@/features/ricorda/Riepiloghi';
import { messaggi } from '@/lib/messaggi/it';

export const metadata: Metadata = { title: 'I tuoi riepiloghi · Noxa' };

export default function Pagina() {
  const testi = messaggi.ricorda.riepilogo.elenco;
  return (
    <>
      <IntestazioneArea
        sottotitolo={testi.sottotitolo}
        titolo={testi.titolo}
        dopoTitolo={<EtichettaPrivato />}
        indietro={{ href: '/ricorda/', etichetta: messaggi.ricorda.area.titolo }}
      />
      <Rivela className="pagina pb-8" indice={2}>
        <ElencoRiepiloghi />
      </Rivela>
    </>
  );
}
