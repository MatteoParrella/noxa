import { ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { Rivela } from '@/components/ui/Movimento';
import { ElencoVuoto } from '@/components/ui/Stati';
import { Campanella } from '@/features/notifiche/Campanella';

export const metadata: Metadata = { title: 'Vivi · Noxa' };

export default function PaginaVivi() {
  return (
    <>
      <IntestazioneArea sottotitolo="Durante la serata" titolo="Vivi" azioni={<Campanella />} />
      <Rivela className="pagina pt-4" indice={2}>
        <ElencoVuoto icona={ShieldCheck} titolo="Check-in e ritorno sicuro">
          Qui potrai dire agli amici che hai scelto dove sei e farti seguire finché arrivi a casa.
          Sono sempre spenti finché non li attivi tu, e la posizione si cancella dopo 24 ore.
        </ElencoVuoto>
      </Rivela>
    </>
  );
}
