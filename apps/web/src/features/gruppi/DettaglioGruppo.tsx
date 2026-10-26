'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  ChevronDown,
  ChevronLeft,
  CircleAlert,
  Flag,
  LogOut,
  Pencil,
  Shield,
  Trash2,
  User,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { z } from 'zod';
import { Avatar, GruppoAvatar } from '@/components/ui/Avatar';
import { Avviso } from '@/components/ui/Avviso';
import { Badge } from '@/components/ui/Badge';
import { Campo } from '@/components/ui/Campo';
import { Foglio } from '@/components/ui/Foglio';
import { Icona } from '@/components/ui/Icona';
import { MenuAzioni, type VoceMenu } from '@/components/ui/MenuAzioni';
import { Entra, TitoloRivelato } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { Selezione } from '@/components/ui/Selezione';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { useToast } from '@/components/ui/Toast';
import { blocca } from '@/features/amici/api';
import { CHIAVI as CHIAVI_AMICI, useIo } from '@/features/amici/dati';
import { percorsoPersona } from '@/features/amici/ElencoAmici';
import { FoglioSegnala } from '@/features/amici/FoglioSegnala';
import { useOnline } from '@/lib/connessione';
import { messaggi } from '@/lib/messaggi/it';
import {
  cambiaRuolo,
  eliminaGruppo,
  invitaNelGruppo,
  rinominaGruppo,
  togliDalGruppo,
  type DettaglioGruppo as Dati,
  type Membro,
} from './api';
import { erroreInviti } from './CreaGruppo';
import { CHIAVI, useDettaglioGruppo } from './dati';
import { FoglioSegnalaTesto } from './FoglioSegnalaTesto';
import { RigaSerata } from './RigaSerata';
import { SelettoreAmici } from './SelettoreAmici';

const testi = messaggi.gruppi;

/** Pagina di un gruppo dall'identificativo: /gruppo/?id=… */
export function percorsoGruppo(id: string): string {
  return `/gruppo/?id=${encodeURIComponent(id)}`;
}

/** Dettaglio del gruppo (design/F-13-gruppi §3): serate, membri e azioni secondo il ruolo. */
export function DettaglioGruppo() {
  const grezzo = useSearchParams().get('id');
  const id = z.uuid().safeParse(grezzo).success ? grezzo : null;
  const io = useIo();
  const gruppo = useDettaglioGruppo(id);

  if (!id || gruppo.data === null) return <NonDisponibile />;
  if (!io || gruppo.isPending) return <Caricamento descrizione={testi.dettaglio.caricamento} />;
  if (gruppo.isError) {
    return (
      <ErroreConAzione
        titolo={testi.dettaglio.errore.titolo}
        onRiprova={() => void gruppo.refetch()}
        riprovaInCorso={gruppo.isFetching}
      >
        {testi.dettaglio.errore.testo}
      </ErroreConAzione>
    );
  }
  return <Gruppo io={io} dati={gruppo.data} />;
}

function NonDisponibile() {
  return (
    <ElencoVuoto
      icona={Users}
      titolo={testi.dettaglio.nonDisponibile.titolo}
      azione={
        <Link className="btn btn-secondario" href="/organizza/">
          {testi.dettaglio.nonDisponibile.torna}
        </Link>
      }
    >
      {testi.dettaglio.nonDisponibile.testo}
    </ElencoVuoto>
  );
}

type FoglioAperto =
  | { tipo: 'invita' }
  | { tipo: 'rinomina' }
  | { tipo: 'esci' }
  | { tipo: 'elimina' }
  | { tipo: 'segnalaNome' }
  | { tipo: 'togli'; membro: Membro }
  | { tipo: 'segnalaMembro'; membro: Membro }
  | { tipo: 'bloccaMembro'; membro: Membro }
  | null;

function Gruppo({ io, dati }: { io: string; dati: Dati }) {
  const online = useOnline();
  const router = useRouter();
  const client = useQueryClient();
  const toast = useToast();
  const [foglio, setFoglio] = useState<FoglioAperto>(null);
  const [passateAperte, setPassateAperte] = useState(false);
  const admin = dati.mio_ruolo === 'admin';

  const aggiorna = () => client.invalidateQueries({ queryKey: CHIAVI.gruppi });
  const chiudi = () => setFoglio(null);

  const ruolo = useMutation({
    mutationFn: (membro: Membro) => cambiaRuolo(dati.id, membro.id, 'admin'),
    onSuccess: (_esito, membro) =>
      toast({ testo: testi.dettaglio.adminNominato(membro.nome_visualizzato) }),
    onError: () => toast({ testo: testi.dettaglio.erroreAzione }),
    onSettled: aggiorna,
  });

  const prossime = dati.serate.filter((s) => !s.passata);
  const passate = dati.serate.filter((s) => s.passata);
  const attivi = dati.membri.filter((m) => m.stato === 'attivo');
  const creatore = dati.creato_da;

  const vociGruppo: VoceMenu[] = [
    ...(admin
      ? [
          {
            etichetta: testi.dettaglio.rinomina,
            icona: <Icona icona={Pencil} />,
            onScegli: () => setFoglio({ tipo: 'rinomina' }),
          },
        ]
      : []),
    {
      etichetta: testi.dettaglio.segnalaNome,
      icona: <Icona icona={Flag} />,
      onScegli: () => setFoglio({ tipo: 'segnalaNome' }),
    },
    {
      etichetta: testi.dettaglio.esci,
      icona: <Icona icona={LogOut} />,
      onScegli: () => setFoglio({ tipo: 'esci' }),
    },
    ...(admin
      ? [
          {
            etichetta: testi.dettaglio.elimina,
            icona: <Icona icona={Trash2} />,
            onScegli: () => setFoglio({ tipo: 'elimina' }),
            pericolo: true,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Link className="btn btn-testo btn-s -ml-3" href="/organizza/">
          <Icona icona={ChevronLeft} dimensione="s" />
          {messaggi.gruppi.organizza.titolo}
        </Link>
        <MenuAzioni
          etichetta={testi.dettaglio.altreAzioni(dati.nome)}
          titolo={dati.nome}
          voci={vociGruppo}
        />
      </div>

      <header className="gr-testa">
        <span className="etichetta">{testi.dettaglio.etichetta}</span>
        <TitoloRivelato testo={dati.nome} className="t-display m-0" />
        <div className="gr-membri">
          <GruppoAvatar
            persone={attivi.map((m) => ({ nome: m.nome_visualizzato, foto: m.avatar_path }))}
            massimo={4}
            altri={Math.max(dati.membri_totale - Math.min(attivi.length, 4), 0)}
            decorativo
          />
          <span className="gr-conteggio">
            <span aria-hidden="true">{testi.elenco.conteggioMembri(dati.membri_totale)}</span>
            <span className="sr-only">{testi.elenco.conteggioAccessibile(dati.membri_totale)}</span>
          </span>
        </div>
        {creatore && (
          <p className="gr-meta m-0">
            {testi.dettaglio.creatoDa(
              creatore.id === io
                ? `${creatore.nome_visualizzato} ${testi.dettaglio.tu}`
                : creatore.nome_visualizzato,
            )}
            {admin && <Badge className="badge-ruolo">{testi.elenco.admin}</Badge>}
          </p>
        )}
        {!online && <Avviso tipo="info">{testi.dettaglio.offline}</Avviso>}
        <div className="azioni-doppie">
          <Pulsante
            variante="secondario"
            disabled={!online}
            onClick={() => setFoglio({ tipo: 'invita' })}
          >
            <Icona icona={UserPlus} dimensione="s" />
            {testi.dettaglio.invitaAmici}
          </Pulsante>
          {online ? (
            <Link className="btn btn-principale" href={`/serata/nuova/?gruppo=${dati.id}`}>
              {testi.dettaglio.proponi}
            </Link>
          ) : (
            <span className="btn btn-principale is-disabilitato" aria-disabled="true">
              {testi.dettaglio.proponi}
            </span>
          )}
        </div>
      </header>

      <Entra indice={1}>
        <section aria-labelledby="titolo-serate">
          <h2 className="etichetta-riga m-0" id="titolo-serate">
            {testi.dettaglio.serate}
          </h2>
          {prossime.length === 0 ? (
            <p className="t-corpo-s c-2 m-0 py-3">{testi.dettaglio.nessunaSerata}</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {prossime.map((s) => (
                <RigaSerata
                  key={s.id}
                  id={s.id}
                  titolo={s.titolo}
                  dataSerata={s.data_serata}
                  ora={s.ora_ritrovo}
                  stato={s.stato}
                  sotto={s.locale_nome ? `${s.locale_nome} · ${s.locale_comune ?? ''}` : null}
                  risposte={{ si: s.si, forse: s.forse }}
                />
              ))}
            </ul>
          )}
          {passate.length > 0 && (
            <>
              <button
                type="button"
                className="gr-compressa"
                aria-expanded={passateAperte}
                aria-controls="serate-passate"
                onClick={() => setPassateAperte((v) => !v)}
              >
                {testi.dettaglio.passate(passate.length)}
                <Icona icona={ChevronDown} dimensione="s" />
              </button>
              <ul id="serate-passate" className="m-0 list-none p-0" hidden={!passateAperte}>
                {passate.map((s) => (
                  <RigaSerata
                    key={s.id}
                    id={s.id}
                    titolo={s.titolo}
                    dataSerata={s.data_serata}
                    ora={s.ora_ritrovo}
                    stato={s.stato}
                    sotto={s.locale_nome}
                    risposte={{ si: s.si, forse: s.forse }}
                  />
                ))}
              </ul>
            </>
          )}
        </section>
      </Entra>

      <Entra indice={2}>
        <section aria-labelledby="titolo-membri" className="pt-4">
          <h2 className="etichetta-riga m-0" id="titolo-membri">
            {testi.dettaglio.membri} · {testi.elenco.conteggio(dati.membri_totale)}
          </h2>
          <ul className="m-0 list-none p-0">
            {dati.membri.map((membro) => (
              <RigaMembro
                key={membro.id}
                io={io}
                membro={membro}
                admin={admin}
                online={online}
                onAzione={(tipo) =>
                  tipo === 'admin' ? ruolo.mutate(membro) : setFoglio({ tipo, membro })
                }
              />
            ))}
          </ul>
          {dati.altri > 0 && <p className="mb-altri m-0">{testi.dettaglio.altri(dati.altri)}</p>}
        </section>
      </Entra>

      {foglio?.tipo === 'invita' && (
        <FoglioInvita
          gruppo={dati}
          onChiudi={chiudi}
          onFatto={(n) => {
            chiudi();
            void aggiorna();
            toast({ testo: testi.dettaglio.invitiInviati(n) });
          }}
        />
      )}
      {foglio?.tipo === 'rinomina' && (
        <FoglioRinomina
          gruppo={dati}
          onChiudi={chiudi}
          onFatto={() => {
            chiudi();
            void aggiorna();
            toast({ testo: testi.dettaglio.rinominato });
          }}
        />
      )}
      {foglio?.tipo === 'segnalaNome' && (
        <FoglioSegnalaTesto io={io} tipo="gruppo" oggetto={dati.id} onChiudi={chiudi} />
      )}
      {foglio?.tipo === 'esci' && (
        <FoglioEsci
          io={io}
          gruppo={dati}
          onChiudi={chiudi}
          onFatto={() => {
            void aggiorna();
            router.replace('/organizza/');
          }}
        />
      )}
      {foglio?.tipo === 'elimina' && (
        <FoglioEffetto
          titolo={testi.conferme.elimina.titolo(dati.nome)}
          effetto={testi.conferme.elimina.effetto}
          conferma={testi.conferme.elimina.conferma}
          serio
          onConferma={() => eliminaGruppo(dati.id)}
          onChiudi={chiudi}
          onFatto={() => {
            void aggiorna();
            router.replace('/organizza/');
          }}
        />
      )}
      {foglio?.tipo === 'togli' && (
        <FoglioEffetto
          titolo={testi.conferme.togli.titolo(foglio.membro.nome_visualizzato)}
          effetto={testi.conferme.togli.effetto}
          conferma={testi.conferme.togli.conferma}
          onConferma={() => togliDalGruppo(dati.id, foglio.membro.id)}
          onChiudi={chiudi}
          onFatto={() => {
            toast({ testo: testi.dettaglio.tolto(foglio.membro.nome_visualizzato) });
            chiudi();
            void aggiorna();
          }}
        />
      )}
      {foglio?.tipo === 'segnalaMembro' && (
        <FoglioSegnala
          io={io}
          persona={foglio.membro}
          onChiudi={chiudi}
          onFatto={() => {
            chiudi();
            void aggiorna();
          }}
        />
      )}
      {foglio?.tipo === 'bloccaMembro' && (
        <FoglioEffetto
          titolo={messaggi.blocca.titolo(foglio.membro.username)}
          effetto={messaggi.blocca.testo}
          conferma={messaggi.blocca.conferma}
          serio
          onConferma={() => blocca(io, foglio.membro.id)}
          onChiudi={chiudi}
          onFatto={() => {
            toast({ testo: messaggi.blocca.fatto, icona: <Icona icona={Ban} /> });
            chiudi();
            void aggiorna();
            void client.invalidateQueries({ queryKey: CHIAVI_AMICI.relazioni });
          }}
        />
      )}
    </div>
  );
}

type AzioneMembro = 'segnalaMembro' | 'bloccaMembro' | 'togli' | 'admin';

function RigaMembro({
  io,
  membro,
  admin,
  online,
  onAzione,
}: {
  io: string;
  membro: Membro;
  admin: boolean;
  online: boolean;
  onAzione: (azione: AzioneMembro) => void;
}) {
  const router = useRouter();
  const sonoIo = membro.id === io;
  const voci: VoceMenu[] = [
    {
      etichetta: testi.dettaglio.vediProfilo,
      icona: <Icona icona={User} />,
      onScegli: () => router.push(percorsoPersona(membro.id)),
    },
    {
      etichetta: testi.dettaglio.segnala,
      icona: <Icona icona={Flag} />,
      onScegli: () => onAzione('segnalaMembro'),
    },
    {
      etichetta: testi.dettaglio.blocca,
      icona: <Icona icona={Ban} />,
      onScegli: () => onAzione('bloccaMembro'),
    },
    ...(admin && online && membro.stato === 'attivo' && membro.ruolo === 'membro'
      ? [
          {
            etichetta: testi.dettaglio.rendiAdmin,
            icona: <Icona icona={Shield} />,
            onScegli: () => onAzione('admin'),
            separata: true,
          },
        ]
      : []),
    ...(admin && online
      ? [
          {
            etichetta: testi.dettaglio.togli,
            icona: <Icona icona={UserMinus} />,
            onScegli: () => onAzione('togli'),
            pericolo: true,
            separata: membro.ruolo !== 'membro' || membro.stato !== 'attivo',
          },
        ]
      : []),
  ];
  return (
    <li className="mb-riga">
      <Avatar nome={membro.nome_visualizzato} foto={membro.avatar_path} decorativo />
      <span className="min-w-0">
        {sonoIo ? (
          <span className="mb-nome">
            {membro.nome_visualizzato} {testi.dettaglio.tu}
          </span>
        ) : (
          <Link className="mb-nome" href={percorsoPersona(membro.id)}>
            {membro.nome_visualizzato}
          </Link>
        )}
        <span className="sel-username">@{membro.username}</span>
        {(membro.ruolo === 'admin' || membro.stato === 'invitato') && (
          <span className="mb-badge">
            {membro.ruolo === 'admin' && (
              <Badge className="badge-ruolo">{testi.elenco.admin}</Badge>
            )}
            {membro.stato === 'invitato' && (
              <Badge className="badge-attesa">{testi.dettaglio.invitato}</Badge>
            )}
          </span>
        )}
      </span>
      {!sonoIo && (
        <MenuAzioni
          etichetta={testi.dettaglio.altreAzioniMembro(membro.username)}
          titolo={`@${membro.username}`}
          voci={voci}
        />
      )}
    </li>
  );
}

/** Foglio di conferma con l'effetto scritto; "Annulla" ha lo stesso peso. */
function FoglioEffetto({
  titolo,
  effetto,
  conferma,
  serio = false,
  onConferma,
  onChiudi,
  onFatto,
}: {
  titolo: string;
  effetto: string;
  conferma: string;
  serio?: boolean;
  onConferma: () => Promise<void>;
  onChiudi: () => void;
  onFatto: () => void;
}) {
  const azione = useMutation({ mutationFn: onConferma, onSuccess: onFatto });
  return (
    <Foglio aperto titolo={titolo} onChiudi={onChiudi}>
      <div className="flex flex-col gap-4">
        <p className={serio ? 'gr-effetto serio m-0' : 'gr-effetto m-0'}>
          <Icona icona={CircleAlert} dimensione="s" />
          <span>{effetto}</span>
        </p>
        {azione.isError && <Avviso tipo="errore">{testi.dettaglio.erroreAzione}</Avviso>}
        <div className="azioni-doppie">
          <Pulsante variante="secondario" onClick={onChiudi}>
            {testi.conferme.annulla}
          </Pulsante>
          <Pulsante
            variante={serio ? 'pericolo' : 'secondario'}
            caricamento={azione.isPending}
            disabled={azione.isPending}
            onClick={() => azione.mutate()}
          >
            {conferma}
          </Pulsante>
        </div>
      </div>
    </Foglio>
  );
}

/** Uscita: l'ultimo admin sceglie chi lo sostituisce; l'ultima persona elimina il gruppo. */
function FoglioEsci({
  io,
  gruppo,
  onChiudi,
  onFatto,
}: {
  io: string;
  gruppo: Dati;
  onChiudi: () => void;
  onFatto: () => void;
}) {
  const altriAttivi = gruppo.membri.filter((m) => m.stato === 'attivo' && m.id !== io);
  const ultimoAdmin = gruppo.mio_ruolo === 'admin' && !altriAttivi.some((m) => m.ruolo === 'admin');
  const [successore, setSuccessore] = useState<string>(altriAttivi[0]?.id ?? '');
  const esci = async () => {
    if (ultimoAdmin && successore) await cambiaRuolo(gruppo.id, successore, 'admin');
    await togliDalGruppo(gruppo.id, io);
  };
  const azione = useMutation({ mutationFn: esci, onSuccess: onFatto });
  const testo = testi.conferme.esci;
  return (
    <Foglio aperto titolo={testo.titolo(gruppo.nome)} onChiudi={onChiudi}>
      <div className="flex flex-col gap-4">
        <p className="gr-effetto m-0">
          <Icona icona={CircleAlert} dimensione="s" />
          <span>{altriAttivi.length === 0 ? testo.nessunAltro : testo.effetto}</span>
        </p>
        {ultimoAdmin && altriAttivi.length > 0 && (
          <Selezione
            etichetta={testo.nuovoAdmin}
            aiuto={testo.scegliAdmin}
            valore={successore}
            opzioni={altriAttivi.map((m) => ({
              valore: m.id,
              etichetta: `${m.nome_visualizzato} · @${m.username}`,
            }))}
            onCambia={setSuccessore}
          />
        )}
        {azione.isError && <Avviso tipo="errore">{testi.dettaglio.erroreAzione}</Avviso>}
        <div className="azioni-doppie">
          <Pulsante variante="secondario" onClick={onChiudi}>
            {testi.conferme.annulla}
          </Pulsante>
          <Pulsante
            variante="pericolo"
            caricamento={azione.isPending}
            disabled={azione.isPending}
            onClick={() => azione.mutate()}
          >
            {testo.conferma}
          </Pulsante>
        </div>
      </div>
    </Foglio>
  );
}

function FoglioRinomina({
  gruppo,
  onChiudi,
  onFatto,
}: {
  gruppo: Dati;
  onChiudi: () => void;
  onFatto: () => void;
}) {
  const [nome, setNome] = useState(gruppo.nome);
  const pulito = nome.trim();
  const errore =
    pulito === ''
      ? testi.crea.errori.nomeMancante
      : pulito.length > 40
        ? testi.crea.errori.nomeLungo
        : undefined;
  const azione = useMutation({
    mutationFn: () => rinominaGruppo(gruppo.id, pulito),
    onSuccess: onFatto,
  });
  return (
    <Foglio aperto titolo={testi.conferme.rinomina.titolo} onChiudi={onChiudi}>
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          if (!errore) azione.mutate();
        }}
      >
        <Campo
          etichetta={testi.crea.nome}
          value={nome}
          maxLength={40}
          errore={errore}
          conteggio={{ attuale: nome.length, massimo: 40 }}
          onChange={(evento) => setNome(evento.target.value)}
          autoComplete="off"
        />
        {azione.isError && <Avviso tipo="errore">{testi.dettaglio.erroreAzione}</Avviso>}
        <div className="azioni-doppie">
          <Pulsante type="button" variante="secondario" onClick={onChiudi}>
            {testi.conferme.annulla}
          </Pulsante>
          <Pulsante
            type="submit"
            variante="principale"
            disabled={Boolean(errore) || azione.isPending}
            caricamento={azione.isPending}
          >
            {testi.conferme.rinomina.conferma}
          </Pulsante>
        </div>
      </form>
    </Foglio>
  );
}

function FoglioInvita({
  gruppo,
  onChiudi,
  onFatto,
}: {
  gruppo: Dati;
  onChiudi: () => void;
  onFatto: (inviti: number) => void;
}) {
  const [selezionati, setSelezionati] = useState<string[]>([]);
  const azione = useMutation({
    mutationFn: () => invitaNelGruppo(gruppo.id, selezionati),
    onSuccess: onFatto,
  });
  const totale = gruppo.membri_totale + selezionati.length;
  const testo = testi.conferme.invita;
  return (
    <Foglio aperto titolo={testo.titolo} onChiudi={onChiudi}>
      <div className="flex flex-col gap-3">
        <p className="t-corpo-s c-2 m-0">{testo.sottotitolo(gruppo.nome)}</p>
        <SelettoreAmici gruppo={gruppo.id} selezionati={selezionati} onCambia={setSelezionati} />
        {azione.isError && <Avviso tipo="errore">{erroreInviti(azione.error)}</Avviso>}
        <div className="gr-barra-fondo">
          <span className="sel-conta" aria-live="polite">
            <span aria-hidden="true">
              {testi.selettore.selezionati(selezionati.length, totale)}
            </span>
            <span className="sr-only">
              {testi.selettore.selezionatiAccessibile(selezionati.length, totale)}
            </span>
          </span>
          <Pulsante
            variante="principale"
            disabled={selezionati.length === 0 || azione.isPending}
            caricamento={azione.isPending}
            onClick={() => azione.mutate()}
          >
            {testo.conferma(selezionati.length)}
          </Pulsante>
        </div>
      </div>
    </Foglio>
  );
}
