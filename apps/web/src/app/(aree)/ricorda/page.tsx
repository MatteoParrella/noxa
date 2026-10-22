import { BookOpen } from 'lucide-react';
import type { Metadata } from 'next';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { Rivela } from '@/components/ui/Movimento';
import { ElencoVuoto } from '@/components/ui/Stati';
import { Campanella } from '@/features/notifiche/Campanella';

export const metadata: Metadata = { title: 'Ricorda · Noxa' };

export default function PaginaRicorda() {
  return (
    <>
      <IntestazioneArea sottotitolo="Il tuo diario" titolo="Ricorda" azioni={<Campanella />} />
      <Rivela className="pagina pt-4" indice={2}>
        <ElencoVuoto icona={BookOpen} titolo="Nessuna serata nel diario">
          Qui ritroverai le tue serate, le statistiche, i badge e il riepilogo dell’anno. Lo vedi
          solo tu.
        </ElencoVuoto>
      </Rivela>
    </>
  );
}
