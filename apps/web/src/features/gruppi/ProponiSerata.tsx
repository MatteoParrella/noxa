'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, Search, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Avviso } from '@/components/ui/Avviso';
import { Badge } from '@/components/ui/Badge';
import { Campo } from '@/components/ui/Campo';
import { Copertina } from '@/components/ui/Copertina';
import { Icona } from '@/components/ui/Icona';
import { TitoloRivelato } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { Segmenti } from '@/components/ui/Segmenti';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { useIo } from '@/features/amici/dati';
import { useCopertine } from '@/features/scopri/dati';
import { etichettaEta, ora } from '@/features/scopri/formato';
import { copertina } from '@/features/scopri/schede';
import { useOnline } from '@/lib/connessione';
import { dataIso, serataInCorso } from '@/lib/date';
import { ErroreAutorizzazione, ErroreValidazione } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import { proponiSerata, type EventoAdatto } from './api';
import { CHIAVI, useDettaglioGruppo, useEventiAdatti } from './dati';
import { percorsoGruppo } from './DettaglioGruppo';
import { dataBreve } from './formato';

const testi = messaggi.gruppi.proponi;
const URL_VALIDO = /^https:\/\/\S+$/;

type Modo = 'evento' | 'libera';

/** Proponi una serata (design/F-14-serata §1): da un evento adatto a tutti (R-24) o libera. */
export function ProponiSerata() {
  const grezzo = useSearchParams().get('gruppo');
  const gruppo = z.uuid().safeParse(grezzo).success ? grezzo : null;
  const io = useIo();
  const dettaglio = useDettaglioGruppo(gruppo);

  if (!gruppo || dettaglio.data === null) {
    return (
      <ElencoVuoto icona={CalendarDays} titolo={messaggi.gruppi.dettaglio.nonDisponibile.titolo}>
        {messaggi.gruppi.dettaglio.nonDisponibile.testo}
      </ElencoVuoto>
    );
  }
  if (!io || dettaglio.isPending)
    return <Caricamento descrizione={messaggi.gruppi.dettaglio.caricamento} />;
  if (dettaglio.isError) {
    return (
      <ErroreConAzione
        titolo={messaggi.gruppi.dettaglio.errore.titolo}
        onRiprova={() => void dettaglio.refetch()}
        riprovaInCorso={dettaglio.isFetching}
      >
        {messaggi.gruppi.dettaglio.errore.testo}
      </ErroreConAzione>
    );
  }
  return <Modulo io={io} gruppo={gruppo} nomeGruppo={dettaglio.data.nome} />;
}

type Errori = Partial<Record<'evento' | 'titolo' | 'data' | 'urlPrevendita' | 'urlLista', string>>;

function Modulo({ io, gruppo, nomeGruppo }: { io: string; gruppo: string; nomeGruppo: string }) {
  const client = useQueryClient();
  const online = useOnline();
  const oggi = dataIso(serataInCorso());
  const [modo, setModo] = useState<Modo>('evento');
  const [cerca, setCerca] = useState('');
  const [evento, setEvento] = useState<EventoAdatto | null>(null);
  const [titolo, setTitolo] = useState('');
  const [data, setData] = useState(oggi);
  const [oraRitrovo, setOraRitrovo] = useState('');
  const [luogo, setLuogo] = useState('');
  const [urlPrevendita, setUrlPrevendita] = useState('');
  const [urlLista, setUrlLista] = useState('');
  const [note, setNote] = useState('');
  const [inviato, setInviato] = useState(false);
  const [proposta, setProposta] = useState<string | null>(null);

  const errori: Errori = {};
  if (modo === 'evento' && !evento) errori.evento = testi.errori.eventoMancante;
  if (modo === 'libera' && titolo.trim() === '') errori.titolo = testi.errori.titoloMancante;
  if (modo === 'libera' && !data) errori.data = testi.errori.dataMancante;
  else if (modo === 'libera' && data < oggi) errori.data = testi.errori.dataPassata;
  if (urlPrevendita.trim() && !URL_VALIDO.test(urlPrevendita.trim()))
    errori.urlPrevendita = testi.errori.link;
  if (urlLista.trim() && !URL_VALIDO.test(urlLista.trim())) errori.urlLista = testi.errori.link;
  const mostra = (campo: keyof Errori) => (inviato ? errori[campo] : undefined);

  const invio = useMutation({
    mutationFn: () =>
      proponiSerata(io, {
        gruppo,
        evento: modo === 'evento' ? (evento?.id ?? null) : null,
        titolo,
        data: modo === 'evento' && evento ? evento.data_serata : data,
        ora: oraRitrovo,
        luogo,
        urlPrevendita,
        urlLista,
        note,
      }),
    onSuccess: (id) => {
      void client.invalidateQueries({ queryKey: CHIAVI.gruppi });
      setProposta(id);
    },
  });

  const scegliEvento = (scelto: EventoAdatto) => {
    setEvento(scelto);
    if (!urlPrevendita && scelto.url_biglietti && URL_VALIDO.test(scelto.url_biglietti))
      setUrlPrevendita(scelto.url_biglietti);
  };

  const invia = (e: FormEvent) => {
    e.preventDefault();
    setInviato(true);
    if (Object.keys(errori).length > 0) return;
    invio.mutate();
  };

  if (proposta) {
    return (
      <div className="flex flex-col gap-4 pt-3" role="status">
        <span className="cornice-icona" aria-hidden="true">
          <Icona icona={Check} />
        </span>
        <h2 className="t-titolo-1 m-0">{testi.fatto.titolo}</h2>
        <p className="t-corpo m-0">{testi.fatto.testo(nomeGruppo)}</p>
        <Link className="btn btn-principale btn-pieno" href={`/serata/?id=${proposta}`}>
          {testi.fatto.apri}
        </Link>
        <Link className="link self-center" href={percorsoGruppo(gruppo)}>
          {testi.fatto.torna}
        </Link>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={invia} noValidate>
      <div className="flex flex-col gap-1">
        <span className="etichetta">{nomeGruppo}</span>
        <TitoloRivelato testo={testi.titolo} className="t-display m-0" />
      </div>
      <Segmenti
        etichetta={testi.modo}
        valore={modo}
        onCambia={setModo}
        opzioni={[
          { valore: 'evento', etichetta: testi.daEvento },
          { valore: 'libera', etichetta: testi.libera },
        ]}
      />

      {modo === 'evento' ? (
        <SceltaEvento
          gruppo={gruppo}
          cerca={cerca}
          onCerca={setCerca}
          scelto={evento}
          onScegli={scegliEvento}
          errore={mostra('evento')}
          onLibera={() => setModo('libera')}
        />
      ) : (
        <>
          <Campo
            etichetta={testi.titoloSerata}
            value={titolo}
            maxLength={80}
            conteggio={{ attuale: titolo.length, massimo: 80 }}
            errore={mostra('titolo')}
            onChange={(e) => setTitolo(e.target.value)}
            autoComplete="off"
          />
          <Campo
            etichetta={testi.data}
            type="date"
            min={oggi}
            value={data}
            errore={mostra('data')}
            onChange={(e) => setData(e.target.value)}
          />
        </>
      )}

      <h2 className="etichetta-riga m-0">
        {testi.ritrovo} · {testi.facoltativo}
      </h2>
      <Campo
        etichetta={testi.ora}
        type="time"
        value={oraRitrovo}
        facoltativo
        onChange={(e) => setOraRitrovo(e.target.value)}
      />
      <Campo
        etichetta={testi.luogo}
        value={luogo}
        maxLength={120}
        facoltativo
        conteggio={{ attuale: luogo.length, massimo: 120 }}
        onChange={(e) => setLuogo(e.target.value)}
        autoComplete="off"
      />

      <h2 className="etichetta-riga m-0">
        {testi.bigliettiSezione} · {testi.facoltativo}
      </h2>
      <Campo
        etichetta={testi.urlPrevendita}
        type="url"
        inputMode="url"
        placeholder="https://"
        value={urlPrevendita}
        facoltativo
        aiuto={testi.urlAiuto}
        errore={mostra('urlPrevendita')}
        maxLength={500}
        onChange={(e) => setUrlPrevendita(e.target.value)}
      />
      <Campo
        etichetta={testi.urlLista}
        type="url"
        inputMode="url"
        placeholder="https://"
        value={urlLista}
        facoltativo
        errore={mostra('urlLista')}
        maxLength={500}
        onChange={(e) => setUrlLista(e.target.value)}
      />

      <div className="campo-area">
        <label className="campo-riga" htmlFor="serata-note">
          <span className="campo-etichetta">
            {testi.note} <span className="campo-opz">({testi.facoltativo})</span>
          </span>
          <span className="campo-conta" aria-hidden="true">
            {note.length}/500
          </span>
        </label>
        <textarea
          id="serata-note"
          maxLength={500}
          value={note}
          aria-describedby="serata-note-aiuto"
          onChange={(e) => setNote(e.target.value)}
        />
        <p className="campo-aiuto m-0" id="serata-note-aiuto">
          {testi.noteAiuto}
        </p>
      </div>

      {invio.isError && (
        <Avviso tipo="errore" portaInVista>
          {erroreProposta(invio.error)}
        </Avviso>
      )}
      <div className="gr-barra-fondo">
        <span className="t-corpo-s c-2">{testi.piede}</span>
        <Pulsante
          type="submit"
          variante="principale"
          disabled={!online || invio.isPending}
          caricamento={invio.isPending}
        >
          {testi.conferma}
        </Pulsante>
      </div>
    </form>
  );
}

function erroreProposta(errore: unknown): string {
  if (errore instanceof ErroreValidazione) {
    if (errore.codice === 'data_passata') return testi.errori.dataPassata;
    if (errore.codice === 'evento_non_adatto') return testi.errori.eventoNonAdatto;
    if (errore.codice === 'valore_non_ammesso') return testi.errori.link;
  }
  // La policy rifiuta un evento non più adatto a tutto il gruppo (R-24).
  if (errore instanceof ErroreAutorizzazione) return testi.errori.eventoNonAdatto;
  return testi.errori.generico;
}

function SceltaEvento({
  gruppo,
  cerca,
  onCerca,
  scelto,
  onScegli,
  errore,
  onLibera,
}: {
  gruppo: string;
  cerca: string;
  onCerca: (testo: string) => void;
  scelto: EventoAdatto | null;
  onScegli: (evento: EventoAdatto) => void;
  errore: string | undefined;
  onLibera: () => void;
}) {
  const eventi = useEventiAdatti(gruppo, cerca);
  const copertine = useCopertine(
    (eventi.data ?? []).map((e) => ({ tipo: e.copertina_tipo, path: e.copertina_path })),
  );
  return (
    <div className="flex flex-col gap-3">
      <Campo
        etichetta={testi.cerca}
        type="search"
        value={cerca}
        onChange={(e) => onCerca(e.target.value)}
        prefisso={<Icona icona={Search} dimensione="s" />}
        autoComplete="off"
      />
      <p className="sel-regola m-0">
        <Icona icona={ShieldCheck} />
        <span>{testi.regola}</span>
      </p>
      {eventi.isPending ? (
        <Caricamento descrizione={testi.caricamento} righe={3} />
      ) : eventi.isError ? (
        <Avviso tipo="errore">{testi.erroreEventi}</Avviso>
      ) : eventi.data.length === 0 ? (
        <ElencoVuoto
          icona={CalendarDays}
          titolo={testi.nessunEvento.titolo}
          azione={
            <Pulsante variante="principale" onClick={onLibera}>
              {testi.nessunEvento.azione}
            </Pulsante>
          }
        >
          {testi.nessunEvento.testo}
        </ElencoVuoto>
      ) : (
        <div
          role="radiogroup"
          aria-label={testi.daEvento}
          aria-describedby={errore ? 'errore-evento' : undefined}
        >
          {eventi.data.map((e) => {
            const selezionato = scelto?.id === e.id;
            return (
              <button
                key={e.id}
                type="button"
                role="radio"
                className="ev-scelta"
                aria-checked={selezionato}
                onClick={() => onScegli(e)}
              >
                <Copertina
                  copertina={copertina(e, copertine.data)}
                  forma="miniatura"
                  ora={ora(e.inizio)}
                  titolo={e.titolo}
                  className="ev-miniatura"
                />
                <span className="min-w-0">
                  <b>{e.titolo}</b>
                  <small>
                    {e.locale_nome} · {e.locale_comune}
                  </small>
                  <span className="ev-tag">
                    {dataBreve(e.data_serata)}
                    <Badge>{etichettaEta(e.eta_minima, e.eta_minima_dichiarata)}</Badge>
                  </span>
                </span>
                <span className={selezionato ? 'se-radio is-on' : 'se-radio'} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}
      {errore && (
        <p className="campo-errore m-0" id="errore-evento" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}
