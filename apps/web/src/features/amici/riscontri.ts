import type { DatiRiscontro } from '@/components/ui/Riscontro';
import { messaggi } from '@/lib/messaggi/it';

type Chi = { nome: string; foto: string | null };

/** «Ora siete amici»: i due avatar si avvicinano (brief del rinfresco §4.1). */
export function riscontroAmicizia(
  io: Chi,
  persona: { nome_visualizzato: string; avatar_path: string | null },
): DatiRiscontro {
  return {
    tipo: 'amicizia',
    titolo: messaggi.riscontri.amicizia.titolo,
    testo: messaggi.riscontri.amicizia.testo(persona.nome_visualizzato),
    persone: [
      { nome: io.nome || persona.nome_visualizzato, foto: io.foto },
      { nome: persona.nome_visualizzato, foto: persona.avatar_path },
    ],
  };
}
