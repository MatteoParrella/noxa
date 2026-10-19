'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import { List, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Badge, Genere } from '@/components/ui/Badge';
import { Copertina } from '@/components/ui/Copertina';
import { Icona } from '@/components/ui/Icona';
import { Mappa, MappaSpenta, type LuogoMappa } from '@/components/ui/Mappa';
import { Pulsante } from '@/components/ui/Pulsante';
import { messaggi } from '@/lib/messaggi/it';
import type { EventoElenco } from './api';
import { useCopertine, useNomiGeneri } from './dati';
import { datiScheda } from './schede';

const testi = messaggi.scopri.mappaVista;

type Props = {
  eventi: UseQueryResult<EventoElenco[]>;
  online: boolean;
  onVaiAllElenco: () => void;
};

/**
 * Mappa di Scopri (F-02, design/F-01-scopri tavola 03): un segnaposto per locale con il numero
 * dei suoi eventi, gruppi quando sono vicini, anteprima in basso. Stessi filtri dell'elenco,
 * che resta sempre raggiungibile come alternativa accessibile.
 */
export function MappaEventi({ eventi, online, onVaiAllElenco }: Props) {
  const [selezionato, setSelezionato] = useState<string | null>(null);
  const [vuota, setVuota] = useState(false);
  const elenco = useMemo(() => eventi.data ?? [], [eventi.data]);

  const luoghi = useMemo<LuogoMappa[]>(() => {
    const perLocale = new Map<string, LuogoMappa>();
    for (const evento of elenco) {
      const luogo = perLocale.get(evento.locale_id);
      if (luogo) luogo.eventi += 1;
      else
        perLocale.set(evento.locale_id, {
          id: evento.locale_id,
          nome: evento.locale_nome,
          lat: evento.locale_lat,
          lon: evento.locale_lon,
          eventi: 1,
        });
    }
    return [...perLocale.values()];
  }, [elenco]);

  const delLocale = elenco.filter((evento) => evento.locale_id === selezionato);

  if (!online) {
    return (
      <div className="scopri-mappa">
        <MappaSpenta
          titolo={testi.offline.titolo}
          testo={testi.offline.testo}
          onVaiAllElenco={onVaiAllElenco}
        />
      </div>
    );
  }

  return (
    <div className="scopri-mappa">
      <Mappa
        urlPmtiles={process.env.NEXT_PUBLIC_MAPPA_PMTILES_URL}
        etichetta={testi.etichetta}
        luoghi={luoghi}
        selezionato={selezionato}
        onSeleziona={setSelezionato}
        onAreaVuota={setVuota}
        onVaiAllElenco={onVaiAllElenco}
      >
        <Pulsante
          variante="secondario"
          dimensione="s"
          className="mappa-fluttua"
          onClick={onVaiAllElenco}
        >
          <Icona icona={List} dimensione="s" />
          {testi.mostraElenco}
        </Pulsante>
        {vuota && eventi.data && (
          <div className="mappa-avviso">
            <Avviso tipo="info" titolo={testi.vuota.titolo}>
              {testi.vuota.testo}
            </Avviso>
          </div>
        )}
      </Mappa>
      {delLocale.length > 0 && selezionato && (
        <Anteprima eventi={delLocale} onChiudi={() => setSelezionato(null)} />
      )}
    </div>
  );
}

function Anteprima({ eventi, onChiudi }: { eventi: EventoElenco[]; onChiudi: () => void }) {
  const copertine = useCopertine(
    eventi.map((evento) => ({ tipo: evento.copertina_tipo, path: evento.copertina_path })),
  );
  const nomiGeneri = useNomiGeneri();
  const nome = eventi[0]?.locale_nome ?? '';
  return (
    <section className="anteprima-mappa" aria-label={testi.anteprima(nome)}>
      <div className="flex items-center justify-between gap-2">
        <span className="etichetta">
          {eventi.length > 1 ? testi.eventiLocale(nome, eventi.length) : nome}
        </span>
        <Pulsante variante="neutro" soloIcona aria-label={testi.chiudiAnteprima} onClick={onChiudi}>
          <Icona icona={X} dimensione="s" />
        </Pulsante>
      </div>
      <ul className="m-0 list-none p-0">
        {eventi.map((evento) => {
          const dati = datiScheda(evento, copertine.data, nomiGeneri);
          return (
            <li key={evento.id} className="anteprima-riga">
              <Copertina
                copertina={dati.copertina}
                forma="miniatura"
                ora={dati.ora}
                titolo={dati.titolo}
                className="miniatura"
              />
              <span className="min-w-0">
                <h3 className="rc-titolo">{dati.titolo}</h3>
                <span className="rc-ora">{dati.orario}</span>
                <span className="rc-tag">
                  <Badge variante="eta">{dati.eta}</Badge>
                  {dati.generi.slice(0, 1).map((genere) => (
                    <Genere key={genere}>{genere}</Genere>
                  ))}
                </span>
              </span>
              <Link
                className="btn btn-secondario btn-s"
                href={dati.href}
                aria-label={testi.apriEvento(dati.titolo)}
              >
                {testi.apri}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
