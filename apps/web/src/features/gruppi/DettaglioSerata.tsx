'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarX,
  Car,
  CheckCircle2,
  ChevronLeft,
  Clock,
  ExternalLink,
  Flag,
  List,
  Minus,
  Plus,
  Ticket,
  Undo2,
  Users,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { Avatar } from '@/components/ui/Avatar';
import { Avviso } from '@/components/ui/Avviso';
import { Badge } from '@/components/ui/Badge';
import { Copertina } from '@/components/ui/Copertina';
import { Foglio } from '@/components/ui/Foglio';
import { Icona } from '@/components/ui/Icona';
import { MenuAzioni, type VoceMenu } from '@/components/ui/MenuAzioni';
import { Pillole } from '@/components/ui/Pillole';
import { Pulsante } from '@/components/ui/Pulsante';
import { Segmenti } from '@/components/ui/Segmenti';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { useToast } from '@/components/ui/Toast';
import { useIo } from '@/features/amici/dati';
import { useCopertine } from '@/features/scopri/dati';
import { dominio, etichettaEta, ora, orario } from '@/features/scopri/formato';
import { copertina } from '@/features/scopri/schede';
import { useOnline } from '@/lib/connessione';
import { ErroreValidazione } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import { registraErrore } from '@/lib/registro';
import {
  cambiaStatoSerata,
  salvaPartecipazione,
  type DettaglioSerata as Dati,
  type MezzoTrasporto,
  type MiaPartecipazione,
  type Partecipante,
  type RispostaSerata,
  type StatoBiglietto,
} from './api';
import { CHIAVI, useDettaglioSerata } from './dati';
import { percorsoGruppo } from './DettaglioGruppo';
import { FoglioSegnalaTesto } from './FoglioSegnalaTesto';
import {
  autoDelGruppo,
  contaRisposte,
  dataBreve,
  etichettaMezzo,
  guida,
  oraRitrovo,
  senzaRitorno,
} from './formato';

const testi = messaggi.gruppi.serata;

const MEZZI: readonly MezzoTrasporto[] = [
  'auto_guido',
  'passaggio',
  'mezzi_pubblici',
  'taxi_ncc',
  'a_piedi',
  'altro',
];
const BIGLIETTI: readonly StatoBiglietto[] = ['nessuno', 'prevendita', 'lista', 'alla_cassa'];

/** Dettaglio della serata di gruppo (design/F-14-serata §2), aggiornato dal vivo. */
export function DettaglioSerata() {
  const grezzo = useSearchParams().get('id');
  const id = z.uuid().safeParse(grezzo).success ? grezzo : null;
  const io = useIo();
  const serata = useDettaglioSerata(id);

  if (!id || serata.data === null) return <NonDisponibile />;
  if (!io || serata.isPending) return <Caricamento descrizione={testi.caricamento} />;
  if (serata.isError) {
    return (
      <ErroreConAzione
        titolo={testi.errore.titolo}
        onRiprova={() => void serata.refetch()}
        riprovaInCorso={serata.isFetching}
      >
        {testi.errore.testo}
      </ErroreConAzione>
    );
  }
  return <Serata io={io} dati={serata.data} />;
}

/** Stesso testo per una serata eliminata, un gruppo lasciato e un evento non visibile (R-24). */
function NonDisponibile() {
  return (
    <ElencoVuoto
      icona={CalendarX}
      titolo={testi.nonDisponibile.titolo}
      azione={
        <Link className="btn btn-secondario" href="/organizza/">
          {testi.nonDisponibile.torna}
        </Link>
      }
    >
      {testi.nonDisponibile.testo}
    </ElencoVuoto>
  );
}

const statoPartenza = (io: Partecipante | undefined): MiaPartecipazione => ({
  risposta: io?.risposta ?? 'si',
  biglietto: io?.biglietto ?? 'nessuno',
  trasporto_andata: io?.trasporto_andata ?? null,
  trasporto_ritorno: io?.trasporto_ritorno ?? null,
  posti_liberi: io?.posti_liberi ?? null,
  passaggio_da: io?.passaggio_da ?? null,
});

/** Annuncio discreto di una risposta arrivata dal vivo e riga da evidenziare. */
function useNovita(partecipanti: readonly Partecipante[]) {
  const precedenti = useRef<Map<string, RispostaSerata | null> | null>(null);
  const [novita, setNovita] = useState<{ id: string; testo: string } | null>(null);
  useEffect(() => {
    const attuali = new Map(partecipanti.map((p) => [p.id, p.risposta]));
    const prima = precedenti.current;
    precedenti.current = attuali;
    if (!prima) return;
    const cambiato = partecipanti.find(
      (p) => !p.io && p.risposta !== null && prima.get(p.id) !== p.risposta,
    );
    if (cambiato?.risposta) {
      setNovita({
        id: cambiato.id,
        testo: testi.aggiornamento(
          cambiato.nome_visualizzato,
          testi.risposte[cambiato.risposta].toLowerCase(),
        ),
      });
    }
  }, [partecipanti]);
  return novita;
}

function Serata({ io, dati }: { io: string; dati: Dati }) {
  const online = useOnline();
  const client = useQueryClient();
  const toast = useToast();
  const [foglio, setFoglio] = useState<'annulla' | 'segnala' | { link: string } | null>(null);
  const copertine = useCopertine(
    dati.evento ? [{ tipo: dati.evento.copertina_tipo, path: dati.evento.copertina_path }] : [],
  );
  const novita = useNovita(dati.partecipanti);

  const mio = dati.partecipanti.find((p) => p.io);
  const sola = dati.stato === 'annullata' || dati.passata;
  const modificabile = online && !sola;
  const titolo = dati.titolo ?? dati.evento?.titolo ?? testi.libera;
  const chiave = CHIAVI.serata(io, dati.id);

  const salva = useMutation({
    mutationFn: (dopo: MiaPartecipazione) => salvaPartecipazione(io, dati.id, dopo),
    onMutate: async (dopo) => {
      await client.cancelQueries({ queryKey: chiave });
      const prima = client.getQueryData<Dati | null>(chiave);
      client.setQueryData<Dati | null>(chiave, (vecchi) =>
        vecchi
          ? {
              ...vecchi,
              partecipanti: vecchi.partecipanti.map((p) => (p.io ? { ...p, ...dopo } : p)),
            }
          : vecchi,
      );
      return { prima };
    },
    onError: (errore, _dopo, contesto) => {
      registraErrore('risposta alla serata', errore);
      if (contesto?.prima !== undefined) client.setQueryData(chiave, contesto.prima);
      const codice = errore instanceof ErroreValidazione ? errore.codice : null;
      toast({
        testo:
          codice === 'guida_solo_maggiorenni' ||
          codice === 'posti_esauriti' ||
          codice === 'passaggio_non_disponibile'
            ? testi.erroriTrasporto[codice]
            : testi.erroreRisposta,
      });
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: chiave });
      void client.invalidateQueries({ queryKey: CHIAVI.gruppi, refetchType: 'none' });
    },
  });

  const cambia = (parziale: Partial<MiaPartecipazione>) =>
    salva.mutate({ ...statoPartenza(mio), ...parziale });

  const stato = useMutation({
    mutationFn: (nuovo: 'confermata' | 'annullata') => cambiaStatoSerata(dati.id, nuovo),
    onSuccess: (_esito, nuovo) => {
      setFoglio(null);
      toast({ testo: nuovo === 'confermata' ? testi.confermataToast : testi.annullataToast });
    },
    onError: () => toast({ testo: messaggi.gruppi.dettaglio.erroreAzione }),
    onSettled: () => client.invalidateQueries({ queryKey: CHIAVI.gruppi }),
  });

  const voci: VoceMenu[] = [
    ...(dati.posso_gestire && !sola && dati.stato === 'proposta'
      ? [
          {
            etichetta: testi.conferma,
            icona: <Icona icona={CheckCircle2} />,
            onScegli: () => stato.mutate('confermata'),
          },
        ]
      : []),
    {
      etichetta: testi.segnala,
      icona: <Icona icona={Flag} />,
      onScegli: () => setFoglio('segnala'),
    },
    ...(dati.posso_gestire && !sola
      ? [
          {
            etichetta: testi.annulla,
            icona: <Icona icona={XCircle} />,
            onScegli: () => setFoglio('annulla'),
            pericolo: true,
            separata: true,
          },
        ]
      : []),
  ];

  const conti = contaRisposte(dati.partecipanti);
  const badgeStato = dati.passata && dati.stato !== 'annullata' ? 'passata' : dati.stato;
  const ritrovo = testi.ritrovo(oraRitrovo(dati.ora_ritrovo), dati.luogo_ritrovo);

  return (
    <article className="flex flex-col">
      <div className="flex items-center justify-between">
        <Link className="btn btn-testo btn-s -ml-3" href={percorsoGruppo(dati.gruppo_id)}>
          <Icona icona={ChevronLeft} dimensione="s" />
          {dati.gruppo_nome}
        </Link>
        <MenuAzioni
          etichetta={testi.menu(titolo)}
          titolo={`${titolo} · ${dataBreve(dati.data_serata)}`}
          voci={voci}
        />
      </div>

      {dati.evento ? (
        <Copertina
          copertina={copertina(dati.evento, copertine.data)}
          forma="dettaglio"
          ora={ora(dati.evento.inizio)}
          titolo={dati.evento.titolo}
          sopra={`${dataBreve(dati.data_serata)} · ${dati.evento.locale_comune}`}
        />
      ) : (
        <div className="se-cop se-cop-tipo">
          <span className="se-data-grande" aria-hidden="true">
            {dataBreve(dati.data_serata).split(' ')[1]}
          </span>
        </div>
      )}

      <div className="se-meta">
        <div className="se-cop-badge flex flex-wrap gap-2">
          <Badge className={`badge-se-${badgeStato}`}>{testi[badgeStato]}</Badge>
          {dati.evento ? (
            <Badge>{etichettaEta(dati.evento.eta_minima, dati.evento.eta_minima_dichiarata)}</Badge>
          ) : (
            <Badge>{testi.libera}</Badge>
          )}
        </div>
        <h1 className="t-titolo-1 m-0">{titolo}</h1>
        <p className="t-mono m-0">
          {dataBreve(dati.data_serata)}
          {dati.evento ? ` · ${orario(dati.evento.inizio, dati.evento.fine)}` : ''}
          {dati.evento ? ` · ${dati.evento.locale_nome}` : ''}
        </p>
        <p className="se-riga m-0">
          <Icona icona={Clock} />
          <span>{ritrovo}</span>
        </p>
        <p className="se-riga m-0">
          <Icona icona={Users} />
          <span>
            {messaggi.gruppi.serata.gruppoProposta(
              dati.gruppo_nome,
              dati.creata_da?.nome_visualizzato ?? null,
            )}
          </span>
        </p>
      </div>

      {!online && <Avviso tipo="info">{testi.offline}</Avviso>}
      {dati.stato === 'annullata' && <Avviso tipo="avviso">{testi.annullataAvviso}</Avviso>}
      {dati.passata && dati.stato !== 'annullata' && (
        <Avviso tipo="info">{testi.passataAvviso}</Avviso>
      )}
      {dati.evento?.stato === 'annullato' && dati.stato !== 'annullata' && (
        <Avviso tipo="avviso">{testi.eventoAnnullato}</Avviso>
      )}

      <p className="sr-only" aria-live="polite">
        {novita?.testo ?? ''}
      </p>

      <fieldset className="se-risposta m-0 border-0" disabled={!modificabile}>
        <legend className="sr-only">{testi.miaRisposta}</legend>
        <div className="se-testa-riga">
          <span className="etichetta" aria-hidden="true">
            {testi.miaRisposta}
          </span>
          <span className="se-conti">{testi.conti(conti.si, conti.forse, conti.no)}</span>
        </div>
        <Segmenti<RispostaSerata>
          etichetta={testi.miaRisposta}
          valore={mio?.risposta ?? null}
          onCambia={(risposta) => {
            if (modificabile && risposta !== mio?.risposta) cambia({ risposta });
          }}
          opzioni={[
            { valore: 'si', etichetta: testi.risposte.si },
            { valore: 'forse', etichetta: testi.risposte.forse },
            { valore: 'no', etichetta: testi.risposte.no },
          ]}
        />
        <p className="se-stato">{mio?.risposta ? testi.rispostaAiuto : testi.nonRisposto}</p>
      </fieldset>

      <ChiCe dati={dati} novita={novita?.id ?? null} />

      <Biglietti
        dati={dati}
        mio={mio}
        modificabile={modificabile}
        onCambia={(biglietto) => cambia({ biglietto })}
        onApri={(link) => setFoglio({ link })}
      />

      <Trasporto dati={dati} mio={mio} modificabile={modificabile} onCambia={cambia} />

      {dati.note && (
        <section className="se-sez" aria-labelledby="titolo-note">
          <h2 className="etichetta-riga m-0" id="titolo-note">
            {testi.note}
          </h2>
          <p className="se-note m-0">{dati.note}</p>
        </section>
      )}

      {foglio === 'segnala' && (
        <FoglioSegnalaTesto
          io={io}
          tipo="serata_gruppo"
          oggetto={dati.id}
          onChiudi={() => setFoglio(null)}
        />
      )}
      {foglio === 'annulla' && (
        <Foglio aperto titolo={testi.annullaTitolo(titolo)} onChiudi={() => setFoglio(null)}>
          <div className="flex flex-col gap-4">
            <p className="gr-effetto m-0">
              <Icona icona={Users} dimensione="s" />
              <span>{testi.annullaEffetto}</span>
            </p>
            <div className="azioni-doppie">
              <Pulsante variante="secondario" onClick={() => setFoglio(null)}>
                {testi.indietro}
              </Pulsante>
              <Pulsante
                variante="pericolo"
                caricamento={stato.isPending}
                disabled={stato.isPending}
                onClick={() => stato.mutate('annullata')}
              >
                {testi.annulla}
              </Pulsante>
            </div>
          </div>
        </Foglio>
      )}
      {foglio !== null && typeof foglio === 'object' && (
        <Foglio aperto titolo={testi.esterno.titolo} onChiudi={() => setFoglio(null)}>
          <div className="flex flex-col gap-4">
            <p className="t-corpo m-0">{testi.esterno.testo(dominio(foglio.link))}</p>
            <div className="azioni-doppie">
              <Pulsante variante="secondario" onClick={() => setFoglio(null)}>
                {testi.esterno.resta}
              </Pulsante>
              <a
                className="btn btn-principale"
                href={foglio.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setFoglio(null)}
              >
                {testi.esterno.apri}
                <span className="sr-only">{messaggi.evento.apreSitoEsterno}</span>
              </a>
            </div>
          </div>
        </Foglio>
      )}
    </article>
  );
}

const GRUPPI_RISPOSTA = ['si', 'forse', 'no', 'nessuna'] as const;

function ChiCe({ dati, novita }: { dati: Dati; novita: string | null }) {
  return (
    <section className="se-sez" aria-labelledby="titolo-chi">
      <h2 className="etichetta-riga m-0" id="titolo-chi">
        {testi.chiCe}
      </h2>
      {GRUPPI_RISPOSTA.map((gruppo) => {
        const persone = dati.partecipanti.filter((p) => (p.risposta ?? 'nessuna') === gruppo);
        if (persone.length === 0) return null;
        return (
          <div key={gruppo}>
            <h3 className="se-chi-testa etichetta m-0">
              {testi.gruppiRisposta[gruppo]} · {persone.length}
            </h3>
            <ul className="m-0 list-none p-0">
              {persone.map((p) => (
                <li key={p.id} className={p.id === novita ? 'pr-riga is-nuova' : 'pr-riga'}>
                  <Avatar nome={p.nome_visualizzato} foto={p.avatar_path} decorativo />
                  <span className="min-w-0">
                    <span className="pr-nome">
                      {p.nome_visualizzato}
                      {p.io ? ` ${messaggi.gruppi.dettaglio.tu}` : ''}
                    </span>
                    <span className="pr-username">@{p.username}</span>
                  </span>
                  {gruppo !== 'no' && gruppo !== 'nessuna' && (
                    <span className="pr-icone">
                      <span
                        className={
                          p.biglietto && p.biglietto !== 'nessuno' ? 'pr-ico ok' : 'pr-ico'
                        }
                      >
                        <Icona icona={Ticket} />
                        <span className="sr-only">{testi.mioBiglietto}: </span>
                        {testi.statiBiglietto[p.biglietto ?? 'nessuno']}
                      </span>
                      <span className={p.trasporto_ritorno ? 'pr-ico ok' : 'pr-ico manca'}>
                        <Icona icona={Undo2} />
                        <span className="sr-only">{testi.comeTorni} </span>
                        {p.trasporto_ritorno === 'passaggio' && p.passaggio_da
                          ? nomeConducente(dati, p.passaggio_da)
                          : etichettaMezzo(p.trasporto_ritorno)}
                      </span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {dati.altri > 0 && <p className="mb-altri m-0">{testi.altri(dati.altri)}</p>}
    </section>
  );
}

function nomeConducente(dati: Dati, id: string): string {
  const conducente = dati.partecipanti.find((p) => p.id === id);
  return conducente
    ? `${testi.mezzi.passaggio}: ${conducente.nome_visualizzato}`
    : testi.mezzi.passaggio;
}

function Biglietti({
  dati,
  mio,
  modificabile,
  onCambia,
  onApri,
}: {
  dati: Dati;
  mio: Partecipante | undefined;
  modificabile: boolean;
  onCambia: (biglietto: StatoBiglietto) => void;
  onApri: (link: string) => void;
}) {
  const conta = (stato: StatoBiglietto) =>
    dati.partecipanti.filter((p) => p.biglietto === stato).length;
  const link: Array<{ url: string; etichetta: string; icona: LucideIcon }> = [];
  if (dati.url_prevendita)
    link.push({ url: dati.url_prevendita, etichetta: testi.prevendita, icona: Ticket });
  if (dati.url_lista) link.push({ url: dati.url_lista, etichetta: testi.lista, icona: List });
  return (
    <section className="se-sez" aria-labelledby="titolo-biglietti">
      <h2 className="etichetta-riga m-0" id="titolo-biglietti">
        {testi.biglietti}
      </h2>
      {link.map((voce) => (
        <button
          key={voce.etichetta}
          type="button"
          className="se-link"
          onClick={() => onApri(voce.url)}
        >
          <Icona icona={voce.icona} />
          <span className="min-w-0">
            <b>{voce.etichetta}</b>
            <small>{dominio(voce.url)}</small>
          </span>
          <span className="se-fuori">
            <Icona icona={ExternalLink} dimensione="s" />
            {testi.fuoriNoxa}
          </span>
        </button>
      ))}
      {mio && mio.risposta !== 'no' && mio.risposta !== null && (
        <div className="flex flex-col gap-2">
          <span className="t-corpo-s" id="etichetta-biglietto">
            {testi.mioBiglietto}
          </span>
          <Pillole<StatoBiglietto>
            etichetta={testi.mioBiglietto}
            valore={mio.biglietto ?? 'nessuno'}
            disattivato={!modificabile}
            onCambia={(valore) => {
              if (valore !== mio.biglietto) onCambia(valore);
            }}
            opzioni={BIGLIETTI.map((valore) => ({
              valore,
              etichetta: testi.statiBiglietto[valore],
            }))}
          />
        </div>
      )}
      <p className="se-conti m-0">
        {testi.riepilogoBiglietti(conta('prevendita'), conta('lista'), conta('alla_cassa'))}
      </p>
      <p className="t-didascalia c-2 m-0">{testi.nessunPagamento}</p>
    </section>
  );
}

function Trasporto({
  dati,
  mio,
  modificabile,
  onCambia,
}: {
  dati: Dati;
  mio: Partecipante | undefined;
  modificabile: boolean;
  onCambia: (parziale: Partial<MiaPartecipazione>) => void;
}) {
  const auto = autoDelGruppo(dati.partecipanti);
  const mancanti = senzaRitorno(dati.partecipanti);
  const vengo = mio?.risposta === 'si' || mio?.risposta === 'forse';
  // "Guido" non compare per chi non può guidare (F-16): lo decide il database (posso_guidare).
  const mezzi = MEZZI.filter((m) => m !== 'auto_guido' || dati.posso_guidare);
  const opzioni = mezzi.map((valore) => ({ valore, etichetta: testi.mezzi[valore] }));
  const guidoIo = mio ? guida(mio) : false;
  const vuolePassaggio =
    mio?.trasporto_andata === 'passaggio' || mio?.trasporto_ritorno === 'passaggio';
  const conducenti = auto.filter((a) => !a.conducente.io);

  return (
    <section className="se-sez" aria-labelledby="titolo-trasporto">
      <h2 className="etichetta-riga m-0" id="titolo-trasporto">
        {testi.trasporto}
      </h2>
      {mancanti > 0 && (
        <p className="se-avviso-ritorno m-0" role="note">
          <Icona icona={Undo2} dimensione="s" />
          <span>
            <b>{testi.avvisoRitorno(mancanti)}</b>
            {testi.avvisoRitornoTesto}
          </span>
        </p>
      )}

      {mio && vengo && (
        <>
          <div className="se-mezzo">
            <div className="se-mezzo-testa">
              <span id="come-vai">{testi.comeVai}</span>
              <small aria-hidden="true">{testi.andata}</small>
            </div>
            <Pillole<MezzoTrasporto>
              etichetta={testi.comeVai}
              valore={mio.trasporto_andata}
              disattivato={!modificabile}
              onCambia={(valore) => onCambia({ trasporto_andata: valore })}
              opzioni={opzioni}
            />
          </div>
          <div className="se-mezzo">
            <div className="se-mezzo-testa">
              <span id="come-torni">{testi.comeTorni}</span>
              <small aria-hidden="true">{testi.ritorno}</small>
            </div>
            <Pillole<MezzoTrasporto>
              etichetta={testi.comeTorni}
              valore={mio.trasporto_ritorno}
              disattivato={!modificabile}
              onCambia={(valore) => onCambia({ trasporto_ritorno: valore })}
              opzioni={opzioni}
            />
          </div>

          {guidoIo && (
            <div className="se-posti" role="group" aria-label={testi.postiLiberi}>
              <Pulsante
                variante="secondario"
                soloIcona
                aria-label={testi.postiMeno}
                disabled={!modificabile || (mio.posti_liberi ?? 0) <= 0}
                onClick={() => onCambia({ posti_liberi: (mio.posti_liberi ?? 0) - 1 })}
              >
                <Icona icona={Minus} />
              </Pulsante>
              <span className="se-valore" aria-live="polite">
                {mio.posti_liberi ?? 0}
              </span>
              <Pulsante
                variante="secondario"
                soloIcona
                aria-label={testi.postiPiu}
                disabled={!modificabile || (mio.posti_liberi ?? 0) >= 8}
                onClick={() => onCambia({ posti_liberi: (mio.posti_liberi ?? 0) + 1 })}
              >
                <Icona icona={Plus} />
              </Pulsante>
              <span className="se-posti-etichetta">{testi.postiLiberi}</span>
            </div>
          )}

          {vuolePassaggio && (
            <div className="flex flex-col gap-1">
              <span className="t-corpo-s" id="passaggio-da">
                {testi.passaggioDa}
              </span>
              {conducenti.length === 0 ? (
                <p className="t-corpo-s c-2 m-0">{testi.nessunoGuida}</p>
              ) : (
                <div role="radiogroup" aria-labelledby="passaggio-da">
                  {conducenti.map(({ conducente, rimasti }) => {
                    const scelto = mio.passaggio_da === conducente.id;
                    const pieno = rimasti === 0 && !scelto;
                    return (
                      <button
                        key={conducente.id}
                        type="button"
                        role="radio"
                        aria-checked={scelto}
                        className="se-passaggio"
                        disabled={!modificabile || pieno}
                        onClick={() => onCambia({ passaggio_da: conducente.id })}
                      >
                        <span
                          className={scelto ? 'se-radio is-on' : 'se-radio'}
                          aria-hidden="true"
                        />
                        <Avatar
                          nome={conducente.nome_visualizzato}
                          foto={conducente.avatar_path}
                          decorativo
                        />
                        <span>
                          <b>{conducente.nome_visualizzato}</b>
                          <small>{testi.postiRimasti(rimasti)}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {auto.length > 0 && (
        <>
          <h3 className="etichetta m-0 pt-2">{testi.autoDelGruppo}</h3>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {auto.map(({ conducente, passeggeri, rimasti }) => (
              <li key={conducente.id} className="se-auto">
                <div className="se-auto-testa">
                  <Avatar
                    nome={conducente.nome_visualizzato}
                    foto={conducente.avatar_path}
                    dimensione="s"
                    decorativo
                  />
                  <span>
                    <b>{conducente.nome_visualizzato}</b>
                    <small>
                      <Icona icona={Car} dimensione="s" /> {testi.guida}
                    </small>
                  </span>
                  <span className="se-auto-posti">{testi.liberi(rimasti)}</span>
                </div>
                <ul className="se-sedili">
                  {passeggeri.map((p) => (
                    <li key={p.id} className="se-sedile">
                      <Avatar
                        nome={p.nome_visualizzato}
                        foto={p.avatar_path}
                        dimensione="s"
                        decorativo
                      />
                      {p.nome_visualizzato}
                    </li>
                  ))}
                  {Array.from({ length: rimasti }, (_, indice) => (
                    <li key={`libero-${indice}`} className="se-sedile libero">
                      {testi.libero}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
