'use client';

import { Check, Info, Lock, TriangleAlert } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { Avatar, iniziali } from '@/components/ui/Avatar';
import { Icona } from '@/components/ui/Icona';
import { MappaRitorno } from '@/components/ui/MappaRitorno';
import { Caricamento, ErroreConAzione } from '@/components/ui/Stati';
import { messaggi } from '@/lib/messaggi/it';
import type { RitornoAmico as Ritorno } from './api';
import { BadgeRitorno } from './Componenti';
import { trovaRicevuto, useAvvisiRitorno, useRitorni } from './dati';
import { metri, oraDi, posizioneVecchia, quantoFa, statoAmico, useAdesso } from './formato';

const testi = messaggi.ritorno.amico;
const QUINDICI_MINUTI = 15 * 60_000;

/**
 * Ritorno di un amico, per chi lo riceve (design/F-21-ritorno-sicuro §5): l'ultima posizione con
 * la precisione e da quanto è aggiornata, l'arrivo previsto. Nessuna scia, velocità o indirizzo;
 * nessun pulsante per chiamare o scrivere da Noxa (PRD §6). Un ritorno non più visibile (blocco,
 * amicizia rimossa, esito oltre i 15 minuti) porta all'elenco delle notifiche (R-17).
 */
export function RitornoAmico() {
  const parametri = useSearchParams();
  const router = useRouter();
  const id = parametri.get('id');
  const ritorni = useRitorni();
  const ritorno = trovaRicevuto(ritorni.data?.ricevuti, id);
  useAvvisiRitorno(ritorno ? id : null);
  const nonDisponibile = ritorni.isSuccess && !ritorno;

  useEffect(() => {
    if (nonDisponibile) router.replace('/notifiche/?non-disponibile=ritorno');
  }, [nonDisponibile, router]);

  if (ritorni.isPending || nonDisponibile)
    return <Caricamento descrizione={testi.caricamento} righe={4} />;
  if (ritorni.isError) {
    return (
      <ErroreConAzione
        titolo={testi.errore}
        onRiprova={() => void ritorni.refetch()}
        riprovaInCorso={ritorni.isFetching}
      >
        {messaggi.vivi.errore.testo}
      </ErroreConAzione>
    );
  }
  return <Vista ritorno={ritorno!} />;
}

function Vista({ ritorno }: { ritorno: Ritorno }) {
  const adesso = useAdesso();
  const stato = statoAmico(ritorno, adesso);
  const persona = ritorno.persona;
  const nome = persona.nome_visualizzato;
  const posizione = ritorno.posizione;
  const vecchia = posizione ? posizioneVecchia(posizione.registrata_il, adesso) : true;
  const attivo = stato === 'in_viaggio' || stato === 'in_ritardo';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar nome={nome} foto={persona.avatar_path} decorativo />
        <div className="min-w-0">
          <h2 className="t-titolo-s m-0">
            {nome} <span className="username">@{persona.username}</span>
          </h2>
          <BadgeRitorno stato={stato} />
        </div>
      </div>

      <div aria-live="polite">
        {stato === 'in_ritardo' && (
          <div className="rt-allerta" role="alert">
            <div className="rt-allerta-testa">
              <Icona icona={TriangleAlert} className="ico" />
              <span>
                <b>{testi.allerta.titolo(nome, oraDi(ritorno.arrivoPrevisto))}</b>
                <span>
                  {posizione
                    ? testi.allerta.posizione(
                        oraDi(posizione.registrata_il),
                        metri(posizione.precisione_m),
                      )
                    : testi.allerta.senzaPosizione}
                </span>
              </span>
            </div>
            <span className="etichetta">{testi.allerta.cosaFare}</span>
            <ol className="rt-cosa-fare">
              {testi.allerta.passi.map((passo) => (
                <li key={passo}>{passo}</li>
              ))}
            </ol>
          </div>
        )}
        {stato === 'arrivato' && ritorno.conclusoIl && (
          <div className="rt-allerta is-arrivo">
            <div className="rt-allerta-testa">
              <Icona icona={Check} className="ico" />
              <span>
                <b>{testi.esito.arrivato(nome, oraDi(ritorno.conclusoIl))}</b>
                <span>
                  {testi.esito.arrivatoTesto(
                    oraDi(new Date(ritorno.conclusoIl).getTime() + QUINDICI_MINUTI),
                  )}
                </span>
              </span>
            </div>
          </div>
        )}
        {stato === 'terminato' && (
          <div className="rt-pwa">
            <Icona icona={Info} dimensione="s" className="ico" />
            <span>
              <b>{testi.esito.terminato(nome)}</b>
              <br />
              {ritorno.stato === 'scaduto' ? testi.esito.scaduto : testi.esito.annullato}
            </span>
          </div>
        )}
      </div>

      {attivo &&
        (posizione ? (
          <MappaRitorno
            lat={posizione.lat}
            lon={posizione.lon}
            raggio={posizione.precisione_m}
            vecchia={vecchia}
            iniziali={iniziali(nome)}
            etichetta={testi.mappa(nome)}
            alta
          >
            <p className="rt-mappa-etichetta m-0">
              <b>
                {vecchia
                  ? testi.etichettaMappaVecchia(oraDi(posizione.registrata_il))
                  : testi.etichettaMappa(quantoFa(posizione.registrata_il, adesso))}
              </b>
              <span>{messaggi.ritorno.dettaglio.circa(metri(posizione.precisione_m))}</span>
            </p>
          </MappaRitorno>
        ) : (
          <p className="ck-motivo">{testi.nessunaPosizione}</p>
        ))}

      {attivo && (
        <>
          <dl className="rt-dati m-0">
            <div className="rt-dato">
              <dt>
                <span>{testi.arrivoPrevisto}</span>
              </dt>
              <dd className="m-0">
                <b>{oraDi(ritorno.arrivoPrevisto)}</b>
              </dd>
            </div>
            <div className="rt-dato">
              <dt>
                <span>{testi.ultimaPosizione}</span>
              </dt>
              <dd className="m-0">
                <b>
                  {posizione ? oraDi(posizione.registrata_il) : messaggi.ritorno.dettaglio.nessuna}
                </b>
              </dd>
            </div>
            <div className="rt-dato">
              <dt>
                <span>{testi.aggiornata}</span>
              </dt>
              <dd className="m-0">
                <b>
                  {posizione
                    ? quantoFa(posizione.registrata_il, adesso)
                    : messaggi.ritorno.dettaglio.nessuna}
                </b>
              </dd>
            </div>
            <div className="rt-dato">
              <dt>
                <span>{testi.precisione}</span>
              </dt>
              <dd className="m-0">
                <b>
                  {posizione
                    ? messaggi.ritorno.dettaglio.circa(metri(posizione.precisione_m))
                    : messaggi.ritorno.dettaglio.nessuna}
                </b>
              </dd>
            </div>
          </dl>
          <p className="ck-motivo">
            <Icona icona={Lock} dimensione="s" />
            {testi.privacy}
          </p>
        </>
      )}
    </div>
  );
}
