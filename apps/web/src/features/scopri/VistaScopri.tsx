'use client';

import { CalendarSearch, List, MapPin } from 'lucide-react';
import { useState } from 'react';
import { Icona } from '@/components/ui/Icona';
import { Mappa } from '@/components/ui/Mappa';
import { Rivela } from '@/components/ui/Movimento';
import { Segmenti } from '@/components/ui/Segmenti';
import { ElencoVuoto } from '@/components/ui/Stati';

type Vista = 'elenco' | 'mappa';

const OPZIONI = [
  { valore: 'elenco', etichetta: 'Elenco', icona: <Icona icona={List} dimensione="s" /> },
  { valore: 'mappa', etichetta: 'Mappa', icona: <Icona icona={MapPin} dimensione="s" /> },
] as const;

/**
 * Vista dell'area Scopri. Il catalogo degli eventi arriva con l'iterazione 4: per ora
 * l'elenco mostra lo stato vuoto e la mappa la basemap di Milano e Brianza.
 */
export function VistaScopri() {
  const [vista, setVista] = useState<Vista>('elenco');
  return (
    <div className="flex flex-col gap-4">
      <Rivela className="pagina w-full" indice={2}>
        <Segmenti etichetta="Vista" opzioni={OPZIONI} valore={vista} onCambia={setVista} />
      </Rivela>
      {vista === 'elenco' ? (
        <Rivela className="pagina w-full pt-4" indice={3}>
          <ElencoVuoto icona={CalendarSearch} titolo="Nessun evento da mostrare">
            Il catalogo degli eventi di Milano e Brianza è in preparazione: qui vedrai le serate di
            stasera e dei prossimi giorni.
          </ElencoVuoto>
        </Rivela>
      ) : (
        <div className="h-[calc(100dvh-260px)] min-h-80">
          <Mappa urlPmtiles={process.env.NEXT_PUBLIC_MAPPA_PMTILES_URL} />
        </div>
      )}
    </div>
  );
}
