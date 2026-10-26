'use client';

import { ChevronRight, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { GruppoAvatar } from '@/components/ui/Avatar';
import { Avviso } from '@/components/ui/Avviso';
import { Badge } from '@/components/ui/Badge';
import { Icona } from '@/components/ui/Icona';
import { Entra } from '@/components/ui/Movimento';
import { Schede } from '@/components/ui/Schede';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { ElencoAmici } from '@/features/amici/ElencoAmici';
import { useAmici, useIo } from '@/features/amici/dati';
import { useOnline } from '@/lib/connessione';
import { messaggi } from '@/lib/messaggi/it';
import type { GruppoElenco } from './api';
import { useGruppiDalVivo, useMieiGruppi, useProssimeSerate } from './dati';
import { dataBreve } from './formato';
import { VoceInvito } from './InvitoGruppo';
import { RigaSerata } from './RigaSerata';

const testi = messaggi.gruppi;

type Scheda = 'gruppi' | 'amici';

/** Area Organizza (design/F-13-gruppi tavola 01): schede Amici e Gruppi. */
export function OrganizzaGruppi() {
  const [scheda, setScheda] = useState<Scheda>('gruppi');
  return (
    <Schede
      etichetta={testi.organizza.schede}
      valore={scheda}
      onCambia={setScheda}
      schede={[
        { valore: 'amici', etichetta: testi.organizza.amici, contenuto: <ElencoAmici /> },
        { valore: 'gruppi', etichetta: testi.organizza.gruppi, contenuto: <MieiGruppi /> },
      ]}
    />
  );
}

function MieiGruppi() {
  const io = useIo();
  const online = useOnline();
  const gruppi = useMieiGruppi();
  const serate = useProssimeSerate();
  const amici = useAmici();
  useGruppiDalVivo();

  const crea = online ? (
    <Link className="btn btn-principale btn-s" href="/gruppi/nuovo/">
      <Icona icona={Plus} dimensione="s" />
      {testi.elenco.crea}
    </Link>
  ) : (
    <span className="btn btn-secondario btn-s is-disabilitato" aria-disabled="true">
      <Icona icona={Plus} dimensione="s" />
      {testi.elenco.crea}
    </span>
  );

  const testa = (
    <div className="flex items-center justify-between gap-3">
      <h2 className="t-titolo-1 m-0">{testi.elenco.titolo}</h2>
      {gruppi.isSuccess && gruppi.data.length > 0 && crea}
    </div>
  );

  if (!io || gruppi.isPending) {
    return (
      <div className="flex flex-col gap-4">
        {testa}
        <Caricamento descrizione={testi.elenco.caricamento} />
      </div>
    );
  }

  if (gruppi.isError) {
    return (
      <div className="flex flex-col gap-4">
        {testa}
        <ErroreConAzione
          titolo={testi.elenco.errore.titolo}
          onRiprova={() => void gruppi.refetch()}
          riprovaInCorso={gruppi.isFetching}
        >
          {testi.elenco.errore.testo}
        </ErroreConAzione>
      </div>
    );
  }

  const inviti = gruppi.data.filter((g) => g.mio_stato === 'invitato');
  const miei = gruppi.data.filter((g) => g.mio_stato === 'attivo');
  const senzaAmici = amici.isSuccess && amici.data.amici.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {testa}
      {!online && <Avviso tipo="info">{testi.elenco.offline}</Avviso>}

      {inviti.length > 0 && (
        <Entra indice={1}>
          <section aria-labelledby="titolo-inviti" className="flex flex-col gap-2">
            <h3 className="etichetta-riga m-0" id="titolo-inviti">
              {testi.elenco.inviti} · {inviti.length}
            </h3>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {inviti.map((invito) => (
                <VoceInvito key={invito.id} io={io} invito={invito} />
              ))}
            </ul>
          </section>
        </Entra>
      )}

      {miei.length === 0 && inviti.length === 0 && (
        <ElencoVuoto
          icona={Users}
          titolo={senzaAmici ? testi.elenco.vuotoSenzaAmici.titolo : testi.elenco.vuoto.titolo}
          azione={
            senzaAmici ? (
              <Link className="btn btn-principale" href="/amici/cerca/">
                {testi.elenco.vuotoSenzaAmici.azione}
              </Link>
            ) : (
              crea
            )
          }
        >
          {senzaAmici ? testi.elenco.vuotoSenzaAmici.testo : testi.elenco.vuoto.testo}
        </ElencoVuoto>
      )}

      {miei.length > 0 && (
        <Entra indice={2}>
          <section aria-labelledby="titolo-gruppi">
            <h3 className="etichetta-riga m-0" id="titolo-gruppi">
              {testi.elenco.tuoiGruppi} · {miei.length}
            </h3>
            <ul className="m-0 list-none p-0">
              {miei.map((gruppo) => (
                <RigaGruppo key={gruppo.id} gruppo={gruppo} />
              ))}
            </ul>
          </section>
        </Entra>
      )}

      {serate.isSuccess && serate.data.length > 0 && (
        <Entra indice={3}>
          <section aria-labelledby="titolo-prossime">
            <h3 className="etichetta-riga m-0" id="titolo-prossime">
              {testi.elenco.prossimeSerate}
            </h3>
            <ul className="m-0 list-none p-0">
              {serate.data.map((serata) => (
                <RigaSerata
                  key={serata.id}
                  id={serata.id}
                  titolo={serata.titolo}
                  dataSerata={serata.data_serata}
                  ora={serata.ora_ritrovo}
                  stato={serata.stato}
                  sotto={serata.gruppo_nome}
                  miaRisposta={serata.mia_risposta}
                />
              ))}
            </ul>
          </section>
        </Entra>
      )}
    </div>
  );
}

/** Riga del gruppo: nome, ruolo, membri sovrapposti con il conteggio su 30, prossima serata. */
function RigaGruppo({ gruppo }: { gruppo: GruppoElenco }) {
  const membri = gruppo.membri ?? gruppo.primi.length;
  return (
    <li>
      <Link className="gr-voce" href={`/gruppo/?id=${gruppo.id}`}>
        <span className="gr-corpo">
          <span className="gr-titolo">
            <b>{gruppo.nome}</b>
            {gruppo.mio_ruolo === 'admin' && (
              <Badge className="badge-ruolo">{testi.elenco.admin}</Badge>
            )}
          </span>
          <span className="gr-membri">
            <GruppoAvatar
              persone={gruppo.primi.map((p) => ({
                nome: p.nome_visualizzato,
                foto: p.avatar_path,
              }))}
              massimo={4}
              altri={Math.max(membri - Math.min(gruppo.primi.length, 4), 0)}
              decorativo
            />
            <span className="gr-conteggio">
              <span aria-hidden="true">{testi.elenco.conteggio(membri)}</span>
              <span className="sr-only">{testi.elenco.conteggioAccessibile(membri)}</span>
            </span>
          </span>
          <span className="gr-prossima">
            {gruppo.prossima ? (
              <>
                {testi.elenco.prossima}{' '}
                <span className="mono">{dataBreve(gruppo.prossima.data_serata)}</span>
                {gruppo.prossima.titolo ? ` · ${gruppo.prossima.titolo}` : ''}
              </>
            ) : (
              testi.elenco.nessunaSerata
            )}
          </span>
        </span>
        <Icona icona={ChevronRight} dimensione="s" />
      </Link>
    </li>
  );
}
