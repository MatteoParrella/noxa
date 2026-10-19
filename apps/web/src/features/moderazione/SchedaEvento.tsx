'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Badge } from '@/components/ui/Badge';
import { Campo } from '@/components/ui/Campo';
import { DialogoMotivazione } from '@/components/ui/DialogoMotivazione';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { Selezione } from '@/components/ui/Selezione';
import { Caricamento, ErroreConAzione } from '@/components/ui/Stati';
import { messaggi } from '@/lib/messaggi/it';
import {
  cambiaStatoEvento,
  correggiEtaAlcol,
  salvaEvento,
  type EventoModerazione,
  type StatoEvento,
} from './api';
import { CHIAVI, useEvento, useGeneri, useLocali } from './dati';
import { BadgeAlcol, BadgeEta, BadgeStatoEvento } from './Eventi';
import { daCampoDataOra, etichettaEta, perCampoDataOra, testoErrore, urlBreve } from './formato';
import { PERCORSI_MODERAZIONE } from './GuscioModerazione';
import { RegistroOggetto } from './RegistroOggetto';
import { Filtro, Testata } from './Testata';

const testi = messaggi.moderazione;
const v = testi.evento;
const ETA = [14, 15, 16, 17, 18, 19, 20, 21, 23, 25] as const;

type Modulo = {
  titolo: string;
  descrizione: string;
  locale_id: string;
  inizio: string;
  fine: string;
  prezzo: string;
  url_biglietti: string;
  generi: string[];
};

type Errori = Partial<Record<'titolo' | 'inizio' | 'fine' | 'prezzo' | 'url_biglietti', string>>;

type Dialogo = 'eta' | 'alcol' | 'annulla' | 'rifiuta' | null;

function moduloDa(evento: EventoModerazione): Modulo {
  return {
    titolo: evento.titolo,
    descrizione: evento.descrizione ?? '',
    locale_id: evento.locale_id,
    inizio: perCampoDataOra(evento.inizio),
    fine: perCampoDataOra(evento.fine),
    prezzo:
      evento.prezzo_min_centesimi === null
        ? ''
        : (evento.prezzo_min_centesimi / 100).toLocaleString('it-IT', { maximumFractionDigits: 2 }),
    url_biglietti: evento.url_biglietti ?? '',
    generi: evento.generi.map((g) => g.genere_codice),
  };
}

function valida(modulo: Modulo): Errori {
  const errori: Errori = {};
  if (!modulo.titolo.trim() || modulo.titolo.trim().length > 200) errori.titolo = v.errori.titolo;
  const inizio = daCampoDataOra(modulo.inizio);
  if (!inizio) errori.inizio = v.errori.inizio;
  if (modulo.fine) {
    const fine = daCampoDataOra(modulo.fine);
    const durata = fine && inizio ? new Date(fine).getTime() - new Date(inizio).getTime() : -1;
    if (durata <= 0 || durata > 24 * 3600_000) errori.fine = v.errori.fine;
  }
  if (modulo.prezzo.trim() && !/^\d{1,4}([.,]\d{1,2})?$/.test(modulo.prezzo.trim())) {
    errori.prezzo = v.errori.prezzo;
  }
  if (modulo.url_biglietti.trim() && !/^https:\/\/\S+$/.test(modulo.url_biglietti.trim())) {
    errori.url_biglietti = v.errori.biglietti;
  }
  return errori;
}

/** Scheda evento del moderatore (tavola 06): correzioni e operazioni delicate (R-22, R-23). */
export function SchedaEvento() {
  const id = useSearchParams().get('id');
  const evento = useEvento(id);
  if (!id || evento.isPending) return <Caricamento descrizione={v.caricamento} righe={6} />;
  if (evento.isError) {
    return (
      <div className="md-scorre pt-6">
        <ErroreConAzione
          titolo={testi.comune.erroreCaricamento.titolo}
          onRiprova={() => void evento.refetch()}
          riprovaInCorso={evento.isFetching}
        >
          {testi.comune.erroreCaricamento.testo}
        </ErroreConAzione>
      </div>
    );
  }
  if (!evento.data) {
    return (
      <div className="md-scorre pt-6">
        <Avviso tipo="avviso">{testi.comune.nonTrovato}</Avviso>
      </div>
    );
  }
  return <ModuloEvento key={JSON.stringify(evento.data)} evento={evento.data} />;
}

function ModuloEvento({ evento }: { evento: EventoModerazione }) {
  const client = useQueryClient();
  const locali = useLocali();
  const generi = useGeneri();
  const [modulo, setModulo] = useState<Modulo>(() => moduloDa(evento));
  const [errori, setErrori] = useState<Errori>({});
  const [fatto, setFatto] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [nuovaEta, setNuovaEta] = useState<string>(
    evento.eta_minima_dichiarata ? String(evento.eta_minima) : 'non_dichiarata',
  );
  const cambia = <K extends keyof Modulo>(chiave: K, valore: Modulo[K]) => {
    setModulo((attuale) => ({ ...attuale, [chiave]: valore }));
    setFatto(null);
  };
  const aggiorna = (messaggio: string) => {
    setDialogo(null);
    setFatto(messaggio);
    return client.invalidateQueries({ queryKey: CHIAVI.tutto });
  };

  const salvataggio = useMutation({
    mutationFn: () =>
      salvaEvento(
        evento.id,
        {
          titolo: modulo.titolo.trim(),
          descrizione: modulo.descrizione.trim() || null,
          inizio: daCampoDataOra(modulo.inizio) as string,
          fine: modulo.fine ? daCampoDataOra(modulo.fine) : null,
          locale_id: modulo.locale_id,
          prezzo_min_centesimi: modulo.prezzo.trim()
            ? Math.round(Number(modulo.prezzo.trim().replace(',', '.')) * 100)
            : null,
          url_biglietti: modulo.url_biglietti.trim() || null,
          generi: modulo.generi,
        },
        evento.generi.map((g) => g.genere_codice),
      ),
    onSuccess: () => void aggiorna(testi.comune.salvato),
  });
  const pubblicazione = useMutation({
    mutationFn: () => cambiaStatoEvento(evento.id, 'pubblicato', ''),
    onSuccess: () => void aggiorna(v.fatto.pubblicato),
  });

  function invia(e: FormEvent) {
    e.preventDefault();
    const trovati = valida(modulo);
    setErrori(trovati);
    if (Object.keys(trovati).length === 0) salvataggio.mutate();
  }

  const dichiarataNuova = nuovaEta !== 'non_dichiarata';
  const etaNuova = dichiarataNuova ? Number(nuovaEta) : 18;
  const abbassa = etaNuova < evento.eta_minima;
  const effettoEta = abbassa
    ? etaNuova < 18
      ? v.effettoEta(etaNuova)
      : v.effettoEtaAdulti(etaNuova)
    : v.effettoEtaAlza;
  const puoAnnullare = evento.stato === 'pubblicato';
  const puoRifiutare = evento.stato === 'in_revisione' || evento.stato === 'pubblicato';
  const puoPubblicare = evento.stato === 'in_revisione' || evento.stato === 'annullato';
  const statoDialogo: Record<'annulla' | 'rifiuta', StatoEvento> = {
    annulla: 'annullato',
    rifiuta: 'rifiutato',
  };

  return (
    <>
      <Testata
        briciole={
          <nav className="briciole" aria-label={testi.eventi.titolo}>
            <Link href={PERCORSI_MODERAZIONE.eventi}>{testi.eventi.titolo}</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{evento.titolo}</span>
          </nav>
        }
        titolo={
          <>
            {evento.titolo}
            <BadgeStatoEvento stato={evento.stato} />
          </>
        }
        strumenti={
          <>
            {puoRifiutare && (
              <Pulsante variante="secondario" onClick={() => setDialogo('rifiuta')}>
                {v.rifiuta}
              </Pulsante>
            )}
            {puoAnnullare && (
              <Pulsante variante="pericolo" onClick={() => setDialogo('annulla')}>
                {v.annulla}
              </Pulsante>
            )}
            {puoPubblicare && (
              <Pulsante
                variante="principale"
                caricamento={pubblicazione.isPending}
                onClick={() => pubblicazione.mutate()}
              >
                {evento.stato === 'annullato' ? v.ripristina : v.pubblica}
              </Pulsante>
            )}
          </>
        }
      />
      <div className="md-scorre">
        <div className="md-due">
          <div className="md-col">
            {fatto && (
              <div className="conferma-riga" role="status">
                <Icona icona={CircleCheck} dimensione="s" />
                {fatto}
              </div>
            )}
            {(salvataggio.isError || pubblicazione.isError) && (
              <Avviso tipo="errore" titolo={testi.comune.erroreSalvataggio.titolo} portaInVista>
                {testoErrore(salvataggio.error ?? pubblicazione.error)}
              </Avviso>
            )}
            <form className="md-sezione" onSubmit={invia} noValidate>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="etichetta-riga flex-1">{v.dati}</h2>
                <Badge variante="testo">
                  {v.fonti(evento.fonti.length)}
                  {evento.fonti[0]?.url_originale
                    ? ` · ${urlBreve(evento.fonti[0].url_originale)}`
                    : ''}
                </Badge>
              </div>
              <div className="campi2">
                <Campo
                  etichetta={v.titoloCampo}
                  value={modulo.titolo}
                  maxLength={200}
                  errore={errori.titolo}
                  onChange={(e) => cambia('titolo', e.target.value)}
                />
                <Selezione
                  etichetta={v.locale}
                  valore={modulo.locale_id}
                  opzioni={(locali.data ?? []).map((l) => ({
                    valore: l.id,
                    etichetta: `${l.nome} · ${l.comune}`,
                  }))}
                  onCambia={(valore) => cambia('locale_id', valore)}
                />
                <Campo
                  etichetta={v.inizio}
                  type="datetime-local"
                  value={modulo.inizio}
                  errore={errori.inizio}
                  onChange={(e) => cambia('inizio', e.target.value)}
                />
                <Campo
                  etichetta={v.fine}
                  type="datetime-local"
                  value={modulo.fine}
                  errore={errori.fine}
                  facoltativo
                  onChange={(e) => cambia('fine', e.target.value)}
                />
                <Campo
                  etichetta={v.prezzo}
                  inputMode="decimal"
                  value={modulo.prezzo}
                  aiuto={v.prezzoAiuto}
                  errore={errori.prezzo}
                  onChange={(e) => cambia('prezzo', e.target.value)}
                />
                <Campo
                  etichetta={v.biglietti}
                  type="url"
                  value={modulo.url_biglietti}
                  placeholder="https://"
                  errore={errori.url_biglietti}
                  facoltativo
                  onChange={(e) => cambia('url_biglietti', e.target.value)}
                />
              </div>
              <div className="motivazione">
                <label className="campo-etichetta" htmlFor="descrizione-evento">
                  {v.descrizione}
                </label>
                <textarea
                  id="descrizione-evento"
                  value={modulo.descrizione}
                  maxLength={500}
                  onChange={(e) => cambia('descrizione', e.target.value)}
                />
              </div>
              <div className="md-filtri" role="group" aria-label={v.generi}>
                <span className="etichetta" aria-hidden="true">
                  {v.generi}
                </span>
                {(generi.data ?? []).map((genere) => (
                  <Filtro
                    key={genere.codice}
                    attivo={modulo.generi.includes(genere.codice)}
                    onCambia={() =>
                      cambia(
                        'generi',
                        modulo.generi.includes(genere.codice)
                          ? modulo.generi.filter((g) => g !== genere.codice)
                          : [...modulo.generi, genere.codice].slice(0, 5),
                      )
                    }
                  >
                    {genere.nome}
                  </Filtro>
                ))}
              </div>
              <div>
                <Pulsante type="submit" variante="principale" caricamento={salvataggio.isPending}>
                  {testi.comune.salva}
                </Pulsante>
              </div>
            </form>

            <section className="md-sezione" aria-labelledby="operazioni-delicate">
              <h2 id="operazioni-delicate" className="etichetta-riga">
                {v.delicate}
              </h2>
              <div className="riga-dato">
                <span className="lbl">{v.etaMinima}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <BadgeEta eta={evento.eta_minima} dichiarata={evento.eta_minima_dichiarata} />
                  {!evento.eta_minima_dichiarata && <span className="guida">{v.vale18}</span>}
                </span>
                <Pulsante variante="secondario" dimensione="s" onClick={() => setDialogo('eta')}>
                  {evento.eta_minima > 14 ? v.abbassa : v.alza}
                </Pulsante>
              </div>
              <div className="riga-dato">
                <span className="lbl">{v.alcol}</span>
                <span>
                  <BadgeAlcol alcol={evento.riferimenti_alcol} />
                </span>
                <Pulsante variante="secondario" dimensione="s" onClick={() => setDialogo('alcol')}>
                  {evento.riferimenti_alcol ? v.togliAlcol : v.aggiungiAlcol}
                </Pulsante>
              </div>
              <p className="guida">{v.delicateAiuto}</p>
            </section>
          </div>
          <div className="md-col">
            <RegistroOggetto tipo="evento" id={evento.id} />
          </div>
        </div>
      </div>

      <DialogoMotivazione
        aperto={dialogo === 'eta'}
        onChiudi={() => setDialogo(null)}
        titolo={abbassa ? v.abbassaTitolo(evento.titolo) : v.etaTitolo(evento.titolo)}
        sopratitolo={`${v.delicate.split(' · ')[0]} · R-22`}
        effetto={effettoEta}
        etichettaMotivazione={testi.comune.motivazione}
        aiutoMotivazione={testi.comune.restaNelRegistro}
        erroreMotivazioneMancante={testi.comune.motivazioneMancante}
        etichettaConferma={
          abbassa && dichiarataNuova ? v.abbassaAzione(etaNuova) : v.correggiAzione
        }
        etichettaAnnulla={testi.comune.annulla}
        testoErrore={testoErrore}
        onConferma={async (motivazione) => {
          await correggiEtaAlcol(
            evento.id,
            { eta: etaNuova, dichiarata: dichiarataNuova, alcol: evento.riferimenti_alcol },
            motivazione,
          );
          await aggiorna(v.fatto.eta);
        }}
      >
        <div className="prima-dopo" aria-live="polite">
          <Badge variante="eta">
            {etichettaEta(evento.eta_minima, evento.eta_minima_dichiarata)}
          </Badge>
          <Icona icona={ArrowRight} dimensione="s" />
          <Badge variante="eta">{etichettaEta(etaNuova, dichiarataNuova)}</Badge>
        </div>
        <Selezione
          etichetta={v.nuovaEta}
          valore={nuovaEta}
          opzioni={[
            { valore: 'non_dichiarata', etichetta: v.nonDichiarata },
            ...ETA.map((eta) => ({ valore: String(eta), etichetta: `${eta}+` })),
          ]}
          onCambia={setNuovaEta}
        />
      </DialogoMotivazione>

      <DialogoMotivazione
        aperto={dialogo === 'alcol'}
        onChiudi={() => setDialogo(null)}
        titolo={evento.riferimenti_alcol ? v.alcolTitolo : v.segnaAlcolTitolo}
        sopratitolo={`${v.delicate.split(' · ')[0]} · R-23`}
        effetto={evento.riferimenti_alcol ? v.effettoAlcol(evento.eta_minima) : v.effettoSegnaAlcol}
        etichettaMotivazione={testi.comune.motivazione}
        aiutoMotivazione={testi.comune.restaNelRegistro}
        erroreMotivazioneMancante={testi.comune.motivazioneMancante}
        etichettaConferma={evento.riferimenti_alcol ? v.alcolAzione : v.segnaAlcolAzione}
        etichettaAnnulla={testi.comune.annulla}
        testoErrore={testoErrore}
        onConferma={async (motivazione) => {
          await correggiEtaAlcol(
            evento.id,
            {
              eta: evento.eta_minima,
              dichiarata: evento.eta_minima_dichiarata,
              alcol: !evento.riferimenti_alcol,
            },
            motivazione,
          );
          await aggiorna(v.fatto.alcol);
        }}
      />

      {(['annulla', 'rifiuta'] as const).map((tipo) => (
        <DialogoMotivazione
          key={tipo}
          aperto={dialogo === tipo}
          onChiudi={() => setDialogo(null)}
          titolo={
            tipo === 'annulla' ? v.annullaTitolo(evento.titolo) : v.rifiutaTitolo(evento.titolo)
          }
          effetto={tipo === 'annulla' ? v.effettoAnnulla : v.effettoRifiuta}
          etichettaMotivazione={testi.comune.motivazione}
          aiutoMotivazione={testi.comune.restaNelRegistro}
          erroreMotivazioneMancante={testi.comune.motivazioneMancante}
          etichettaConferma={tipo === 'annulla' ? v.annullaAzione : v.rifiutaAzione}
          etichettaAnnulla={testi.comune.annulla}
          variante="pericolo"
          testoErrore={testoErrore}
          onConferma={async (motivazione) => {
            await cambiaStatoEvento(evento.id, statoDialogo[tipo], motivazione);
            await aggiorna(tipo === 'annulla' ? v.fatto.annullato : v.fatto.rifiutato);
          }}
        />
      ))}
    </>
  );
}
