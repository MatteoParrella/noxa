import { Users } from 'lucide-react';
import type { Metadata } from 'next';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { ElencoVuoto } from '@/components/ui/Stati';

export const metadata: Metadata = { title: 'Organizza · Noxa' };

export default function PaginaOrganizza() {
  return (
    <>
      <IntestazioneArea sottotitolo="Amici e gruppi" titolo="Organizza" />
      <div className="pagina pt-4">
        <ElencoVuoto icona={Users} titolo="Ancora nessun gruppo">
          Qui troverai i tuoi amici, i gruppi e le serate da organizzare insieme: chi c’è, i
          biglietti e come si torna.
        </ElencoVuoto>
      </div>
    </>
  );
}
