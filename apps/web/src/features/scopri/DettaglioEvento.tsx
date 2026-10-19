'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  ChevronLeft,
  CircleAlert,
  ExternalLink,
  Flag,
  Globe,
  Share,
  Ticket,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { z } from 'zod';
import { AmiciPartecipano } from '@/components/ui/AmiciPartecipano';
import { Avviso } from '@/components/ui/Avviso';
import { Badge, Genere } from '@/components/ui/Badge';
import { Copertina } from '@/components/ui/Copertina';
import { Foglio } from '@/components/ui/Foglio';
import { Icona } from '@/components/ui/Icona';
import { LinkEsterno } from '@/components/ui/LinkEsterno';
import { MenuAzioni } from '@/components/ui/MenuAzioni';
import { Entra, TitoloRivelato } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { RigaPersona } from '@/components/ui/RigaPersona';
import {
  SelettorePartecipazione,
  type SceltaPartecipazione,
} from '@/components/ui/SelettorePartecipazione';
import { useToast } from '@/components/ui/Toast';
import { useIo } from '@/features/amici/dati';
import { urlPubblicoApp } from '@/lib/ambiente';
import { useOnline } from '@/lib/connessione';
import { daIso } from '@/lib/date';
import { messaggi } from '@/lib/messaggi/it';
import { registraErrore } from '@/lib/registro';
import { cambiaPartecipazione, type DettaglioEvento as Dati, type Partecipazione } from './api';
import {
  CHIAVI,
  nomeGenere,
  useCopertine,
  useEvento,
  useNomiGeneri,
  useVisibilitaPredefinita,
} from './dati';
import { FoglioSegnalaEvento } from './FoglioSegnalaEvento';
import {
  dominio,
  etichettaEta,
  giornoBreve,
  linkMappe,
  ora,
  orario,
  prezzo,
  testoAmici,
} from './formato';
import { copertina } from './schede';

const testi = messaggi.evento;

/**
 * Dettaglio dell'evento (F-03, F-04, F-05; design/F-01-scopri tavole 04–06). "Non
 * disponibile" usa lo stesso testo per un evento tolto e per uno non adatto all'età (R-20).
 */
export function DettaglioEvento() {
  const grezzo = useSearchParams().get('id');
  const id = z.uuid().safeParse(grezzo).success ? grezzo : null;
  const io = useIo();
  const evento = useEvento(id);
  const online = useOnline();

  if (!id) return <NonDisponibile />;
  if (!evento.data && evento.data !== null) {
    if (evento.isError) {
      return (
        <Stato
          icona={<Icona icona={CircleAlert} />}
          titolo={testi.errore.titolo}
          testo={testi.errore.testo}
          azione={
            <Pulsante
              variante="secondario"
              dimensione="s"
              caricamento={evento.isFetching}
              onClick={() => void evento.refetch()}
            >
              {messaggi.comune.riprova}
            </Pulsante>
          }
        />
      );
    }
    if (!online || evento.fetchStatus === 'paused') {
      return (
        <Stato
          icona={<Icona icona={CircleAlert} />}
          titolo={messaggi.scopri.offlineVuoto.titolo}
          testo={messaggi.scopri.offlineVuoto.testo}
        />
      );
    }
    return <Scheletro />;
  }
  if (evento.data === null || !io) return <NonDisponibile />;
  return <Scheda io={io} dati={evento.data} online={online} />;
}

function Indietro() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="cop-btn cop-indietro"
      aria-label={testi.indietro}
      onClick={() => (window.history.length > 1 ? router.back() : router.push('/scopri/'))}
    >
      <Icona icona={ChevronLeft} />
    </button>
  );
}

function Stato({
  icona,
  titolo,
  testo,
  azione,
}: {
  icona: ReactNode;
  titolo: string;
  testo: string;
  azione?: ReactNode;
}) {
  return (
    <div className="pagina dettaglio-stato">
      <Indietro />
      <div className="stato-elenco" role="alert">
        <span className="cornice-icona">{icona}</span>
        <h1 className="t-titolo-2 m-0">{titolo}</h1>
        <p className="t-corpo-s c-2 m-0">{testo}</p>
        {azione}
      </div>
    </div>
  );
}

function NonDisponibile() {
  return (
    <Stato
      icona={<Icona icona={Ban} />}
      titolo={testi.nonDisponibile.titolo}
      testo={testi.nonDisponibile.testo}
      azione={
        <Link className="btn btn-secondario btn-s" href="/scopri/">
          {testi.nonDisponibile.azione}
        </Link>
      }
    />
  );
}

function Scheletro() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{testi.caricamento}</span>
      <span className="scheletro scheletro-copertina" aria-hidden="true" />
      <div className="pagina flex flex-col gap-3 pt-5" aria-hidden="true">
        <span className="scheletro h-5 w-2/5" />
        <span className="scheletro h-9 w-4/5" />
        <span className="scheletro h-3.5 w-3/5" />
        <span className="scheletro h-3.5 w-1/2" />
        <span className="scheletro mt-2 h-12" />
      </div>
    </div>
  );
}

function Scheda({ io, dati, online }: { io: string; dati: Dati; online: boolean }) {
  const client = useQueryClient();
  const toast = useToast();
  const nomiGeneri = useNomiGeneri();
  const predefinita = useVisibilitaPredefinita();
  const copertine = useCopertine([{ tipo: dati.copertina_tipo, path: dati.copertina_path }]);
  const [foglio, setFoglio] = useState<'amici' | 'segnala' | null>(null);
  const [visibilitaScelta, setVisibilitaScelta] = useState<boolean | null>(null);

  const chiave = CHIAVI.dettaglio(io, dati.id);
  const attuale: Partecipazione = dati.mia_partecipazione
    ? { stato: dati.mia_partecipazione, visibile: dati.mia_visibilita ?? false }
    : null;
  // Senza una scelta salvata vale l'impostazione di privacy, finché non la si cambia qui (R-67).
  const visibile = attuale?.visibile ?? visibilitaScelta ?? predefinita.data ?? false;

  const salva = useMutation({
    mutationFn: (passo: { prima: Partecipazione; dopo: Partecipazione }) =>
      cambiaPartecipazione({ io, evento: dati.id, ...passo }),
    onMutate: async ({ dopo }) => {
      await client.cancelQueries({ queryKey: chiave });
      client.setQueryData<Dati | null>(chiave, (vecchi) =>
        vecchi
          ? {
              ...vecchi,
              mia_partecipazione: dopo?.stato ?? null,
              mia_visibilita: dopo?.visibile ?? null,
            }
          : vecchi,
      );
    },
    onError: (errore, { prima }) => {
      registraErrore('partecipazione', errore);
      client.setQueryData<Dati | null>(chiave, (vecchi) =>
        vecchi
          ? {
              ...vecchi,
              mia_partecipazione: prima?.stato ?? null,
              mia_visibilita: prima?.visibile ?? null,
            }
          : vecchi,
      );
      toast({ testo: testi.partecipazione.errore });
    },
    onSettled: () => client.invalidateQueries({ queryKey: CHIAVI.eventi }),
  });

  const cambia = (dopo: Partecipazione, testoToast: string) => {
    const prima = attuale;
    salva.mutate(
      { prima, dopo },
      {
        onSuccess: () =>
          toast({
            testo: testoToast,
            azione: {
              etichetta: testi.partecipazione.annulla,
              onScegli: () => salva.mutate({ prima: dopo, dopo: prima }),
            },
          }),
      },
    );
  };

  const scegli = (scelta: SceltaPartecipazione) => {
    if (!scelta) return cambia(null, testi.partecipazione.toastTolta);
    cambia(
      { stato: scelta, visibile },
      scelta === 'partecipo'
        ? testi.partecipazione.toastPartecipo
        : testi.partecipazione.toastInteressa,
    );
  };

  const cambiaVisibilita = (nuova: boolean) => {
    if (!attuale) return setVisibilitaScelta(nuova);
    cambia(
      { stato: attuale.stato, visibile: nuova },
      nuova ? testi.partecipazione.toastVisibile : testi.partecipazione.toastSoloTe,
    );
  };

  const condividi = async () => {
    const url = `${urlPubblicoApp()}/evento/?id=${dati.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: dati.titolo, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ testo: testi.linkCopiato });
    } catch (errore) {
      // Chiudere il foglio di condivisione del telefono non è un errore.
      if (errore instanceof DOMException && errore.name === 'AbortError') return;
      registraErrore('condividi', errore);
      toast({ testo: testi.linkNonCopiato });
    }
  };

  const giorno = giornoBreve(daIso(dati.data_serata));
  const annullato = dati.stato === 'annullato';
  const testoAmiciEvento = testoAmici(
    dati.amici,
    dati.amici.filter((amico) => amico.stato === 'partecipo').length,
    dati.amici.filter((amico) => amico.stato === 'interessato').length,
  );
  const vanno = dati.amici.some((amico) => amico.stato === 'partecipo');
  const amiciMostrati = dati.amici
    .filter((amico) => amico.stato === (vanno ? 'partecipo' : 'interessato'))
    .slice(0, 2);
  const prezzoTesto = prezzo(dati.prezzo_min_centesimi) ?? testi.prezzoNonIndicato;
  const fonteEtichetta =
    dati.fonte_tipo === 'sito_locale' || dati.fonte_tipo === 'instagram'
      ? testi.fonte[dati.fonte_tipo]
      : testi.fonte.altro;
  const datiCopertina = copertina(dati, copertine.data);

  return (
    <article className="dettaglio">
      <Copertina
        copertina={datiCopertina}
        forma="dettaglio"
        ora={ora(dati.inizio)}
        titolo={dati.titolo}
        sopra={`${giorno} · ${dati.locale_comune}`}
      >
        <Indietro />
        <div className="cop-menu">
          <MenuAzioni
            etichetta={testi.altreAzioni(dati.titolo)}
            className="cop-btn"
            voci={[
              {
                etichetta: testi.condividi,
                icona: <Icona icona={Share} dimensione="s" />,
                onScegli: () => void condividi(),
              },
              {
                etichetta: testi.segnala,
                icona: <Icona icona={Flag} dimensione="s" />,
                onScegli: () => setFoglio('segnala'),
                separata: true,
              },
            ]}
          />
        </div>
      </Copertina>

      <div className="pagina dettaglio-corpo">
        {datiCopertina.tipo === 'locale' && datiCopertina.url && dati.copertina_attribuzione && (
          <p className="cop-credito m-0">{testi.foto(dati.copertina_attribuzione)}</p>
        )}
        <div className="rc-tag">
          {annullato && (
            <Badge variante="annullato">
              <Icona icona={Ban} dimensione="s" />
              {messaggi.scopri.annullato}
            </Badge>
          )}
          <Badge variante="eta">{etichettaEta(dati.eta_minima, dati.eta_minima_dichiarata)}</Badge>
          {dati.generi_evento.map((codice) => (
            <Genere key={codice}>{nomeGenere(nomiGeneri, codice)}</Genere>
          ))}
        </div>
        <TitoloRivelato testo={dati.titolo} className="dettaglio-titolo" />

        <Entra indice={1} className="flex flex-col gap-5">
          {annullato && (
            <Avviso tipo="avviso" titolo={testi.annullato.titolo}>
              {testi.annullato.testo}
            </Avviso>
          )}
          <div className="flex flex-col gap-0.5">
            <span className="dettaglio-quando">
              {giorno} · {orario(dati.inizio, dati.fine)}
            </span>
            <span className="t-corpo-s c-2">
              {dati.locale_nome} · {dati.locale_comune}
            </span>
          </div>
          {!dati.eta_minima_dichiarata && (
            <Avviso tipo="info" titolo={testi.etaNonDichiarata.titolo}>
              {testi.etaNonDichiarata.testo}
            </Avviso>
          )}
          {dati.descrizione && <p className="t-corpo c-2 m-0">{dati.descrizione}</p>}
          {testoAmiciEvento && (
            <AmiciPartecipano
              className="riga-amici-dettaglio"
              persone={amiciMostrati.map((amico) => ({ nome: amico.nome_visualizzato }))}
              altri={
                dati.amici.filter((amico) => amico.stato === (vanno ? 'partecipo' : 'interessato'))
                  .length - amiciMostrati.length
              }
              testo={testoAmiciEvento}
              onApri={() => setFoglio('amici')}
            />
          )}
          {!annullato && (
            <SelettorePartecipazione
              scelta={dati.mia_partecipazione}
              visibile={visibile}
              onScegli={scegli}
              onVisibilita={cambiaVisibilita}
              disattivato={!online || salva.isPending}
              {...(!online ? { nota: testi.offlineAzioni } : {})}
            />
          )}
          <dl className="dati m-0">
            <dt>{testi.dove}</dt>
            <dd>
              <b>{dati.locale_nome}</b>
              <br />
              <span className="c-2">
                {dati.locale_indirizzo}, {dati.locale_comune}
              </span>
              <br />
              <a
                className="link-in-testo"
                href={linkMappe({
                  lat: dati.locale_lat,
                  lon: dati.locale_lon,
                  nome: dati.locale_nome,
                })}
                target="_blank"
                rel="noopener noreferrer"
              >
                {testi.apriInMappe}
                <Icona icona={ExternalLink} dimensione="s" />
                <span className="sr-only">{testi.apreSitoEsterno}</span>
              </a>
            </dd>
            {dati.artisti.length > 0 && (
              <>
                <dt>{testi.lineUp}</dt>
                <dd>{dati.artisti.join(' · ')}</dd>
              </>
            )}
            <dt>{testi.prezzo}</dt>
            <dd className="mono">{prezzoTesto}</dd>
          </dl>
          <div>
            {dati.fonte_url && (
              <LinkEsterno
                href={dati.fonte_url}
                icona={Globe}
                etichetta={fonteEtichetta}
                destinazione={dominio(dati.fonte_url)}
                disattivato={!online}
              />
            )}
            {dati.url_biglietti && !annullato && (
              <LinkEsterno
                href={dati.url_biglietti}
                icona={Ticket}
                etichetta={testi.biglietti}
                destinazione={testi.sitoEsterno}
                disattivato={!online}
              />
            )}
          </div>
        </Entra>
      </div>

      {foglio === 'amici' && (
        <Foglio aperto titolo={testi.amici.titolo} onChiudi={() => setFoglio(null)}>
          <ul className="m-0 list-none p-0">
            {dati.amici.map((amico) => (
              <RigaPersona
                key={amico.id}
                nome={amico.nome_visualizzato}
                username={amico.username ?? ''}
                href={`/persona/?id=${amico.id}`}
                nota={amico.stato === 'partecipo' ? testi.amici.partecipa : testi.amici.interessato}
              />
            ))}
          </ul>
          <p className="t-didascalia m-0 pt-3">{testi.amici.nota}</p>
        </Foglio>
      )}
      {foglio === 'segnala' && (
        <FoglioSegnalaEvento
          io={io}
          eventoId={dati.id}
          fotoLocaleId={
            datiCopertina.tipo === 'locale' && datiCopertina.url ? dati.locale_id : null
          }
          onChiudi={() => setFoglio(null)}
        />
      )}
    </article>
  );
}
