'use client';

import { CalendarDays, List, Map as MapIcon, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { IntestazioneArea } from '@/components/guscio/IntestazioneArea';
import { Contatore } from '@/components/ui/Badge';
import { Icona } from '@/components/ui/Icona';
import { Rivela } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { Segmenti } from '@/components/ui/Segmenti';
import { useMontato, useOnline } from '@/lib/connessione';
import { classi } from '@/lib/classi';
import { serataInCorso, type DataCalendario } from '@/lib/date';
import { messaggi } from '@/lib/messaggi/it';
import { useEventi, useNomiGeneri } from './dati';
import { ElencoEventi } from './ElencoEventi';
import {
  FILTRI_INIZIALI,
  filtriAttivi,
  leggiFiltriSalvati,
  parametriRicerca,
  salvaFiltri,
  type Filtri,
} from './filtri';
import { FoglioData } from './FoglioData';
import { FoglioFiltri } from './FoglioFiltri';
import { dataFiltri, luogoIntestazione, riassuntoFiltri } from './formato';
import { MappaEventi } from './MappaEventi';
import { usePosizione } from './posizione';
import { OPZIONI_QUANDO, valoreQuando } from './quando';

type Vista = 'elenco' | 'mappa';

const testi = messaggi.scopri;

const OPZIONI_VISTA = [
  { valore: 'elenco', etichetta: testi.elenco, icona: <Icona icona={List} /> },
  { valore: 'mappa', etichetta: testi.mappa, icona: <Icona icona={MapIcon} /> },
] as const;

/**
 * Scopri (F-01, F-02, F-04): eventi della serata in elenco o sulla mappa, con i filtri. Gli
 * eventi a cui non si può entrare semplicemente non arrivano dal database (R-20, R-23).
 */
export function VistaScopri() {
  const online = useOnline();
  const [vista, setVista] = useState<Vista>('elenco');
  const montato = useMontato();
  // Data e filtri salvati dipendono dal telefono: si leggono dopo l'idratazione, non nella build.
  const oggi = useMemo<DataCalendario | null>(() => (montato ? serataInCorso() : null), [montato]);
  const salvati = useMemo(() => (montato ? leggiFiltriSalvati() : FILTRI_INIZIALI), [montato]);
  const [filtriScelti, setFiltri] = useState<Filtri | null>(null);
  const filtri = filtriScelti ?? salvati;
  const [foglio, setFoglio] = useState<'filtri' | 'data' | null>(null);
  const { posizione, chiedi } = usePosizione();
  const nomiGeneri = useNomiGeneri();

  // Dopo una riapertura la posizione non c'è più: si chiede di nuovo solo se l'utente l'aveva
  // scelta; se il telefono non la dà, si torna a tutta l'area.
  useEffect(() => {
    if (filtri.dove.tipo !== 'posizione') return;
    if (posizione.stato === 'inattiva') void chiedi();
    if (posizione.stato === 'negata' || posizione.stato === 'non_disponibile')
      applica({ ...filtri, dove: { tipo: 'ovunque' }, distanzaKm: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reagisce solo a filtro e posizione
  }, [filtri.dove.tipo, posizione.stato]);

  const coordinate = posizione.stato === 'pronta' ? posizione.coordinate : null;
  const parametri = useMemo(
    () =>
      oggi && !(filtri.dove.tipo === 'posizione' && !coordinate)
        ? parametriRicerca(filtri, coordinate, oggi)
        : null,
    [oggi, filtri, coordinate],
  );
  const eventi = useEventi(parametri);

  function applica(nuovi: Filtri) {
    setFiltri(nuovi);
    salvaFiltri(nuovi);
  }

  const attivi = filtriAttivi(filtri);

  return (
    <div className="flex flex-col">
      <IntestazioneArea
        sottotitolo={luogoIntestazione(filtri)}
        titolo={testi.titolo}
        dopoTitolo={oggi && <span className="t-mono-dato c-2">{dataFiltri(filtri, oggi)}</span>}
        azioni={
          <Segmenti
            etichetta={testi.vista}
            opzioni={OPZIONI_VISTA}
            valore={vista}
            onCambia={setVista}
            soloIcone
          />
        }
      />
      <Rivela className="pagina w-full" indice={2}>
        <div className="scopri-comandi">
          <div className="scopri-barra">
            <Segmenti
              etichetta={testi.quando}
              opzioni={OPZIONI_QUANDO}
              valore={valoreQuando(filtri.quando)}
              onCambia={(valore) => applica({ ...filtri, quando: { tipo: valore } })}
              className="flex-1"
            />
            <Pulsante
              variante="secondario"
              soloIcona
              aria-label={testi.scegliData}
              aria-pressed={filtri.quando.tipo === 'data'}
              className={classi(filtri.quando.tipo === 'data' && 'is-on')}
              onClick={() => setFoglio('data')}
            >
              <Icona icona={CalendarDays} />
            </Pulsante>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <Pulsante
              variante="secondario"
              dimensione="s"
              className="flex-none"
              aria-label={testi.filtriAttivi(attivi)}
              onClick={() => setFoglio('filtri')}
            >
              <Icona icona={SlidersHorizontal} dimensione="s" />
              {testi.filtri}
              <Contatore valore={attivi} descrizione="" />
            </Pulsante>
            <span className="t-corpo-s c-2 truncate">{riassuntoFiltri(filtri, nomiGeneri)}</span>
          </div>
        </div>
      </Rivela>

      <div className={classi('scopri-contenuto', vista === 'mappa' && 'is-mappa')} key={vista}>
        {vista === 'elenco' ? (
          <ElencoEventi
            eventi={eventi}
            online={online}
            oggi={oggi}
            conFiltri={attivi > 0}
            onTogliFiltri={() => applica({ ...FILTRI_INIZIALI, quando: filtri.quando })}
          />
        ) : (
          <MappaEventi eventi={eventi} online={online} onVaiAllElenco={() => setVista('elenco')} />
        )}
      </div>

      {foglio === 'filtri' && oggi && (
        <FoglioFiltri
          iniziali={filtri}
          oggi={oggi}
          posizione={posizione}
          chiediPosizione={chiedi}
          onChiudi={() => setFoglio(null)}
          onApplica={(nuovi) => {
            applica(nuovi);
            setFoglio(null);
          }}
        />
      )}
      {foglio === 'data' && oggi && (
        <FoglioData
          oggi={oggi}
          scelta={filtri.quando.tipo === 'data' ? filtri.quando.data : undefined}
          onChiudi={() => setFoglio(null)}
          onConferma={(data) => {
            applica({ ...filtri, quando: { tipo: 'data', data } });
            setFoglio(null);
          }}
        />
      )}
    </div>
  );
}
