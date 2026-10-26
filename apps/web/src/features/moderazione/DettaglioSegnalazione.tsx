'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Lock, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Avviso } from '@/components/ui/Avviso';
import { Badge } from '@/components/ui/Badge';
import { DialogoMotivazione } from '@/components/ui/DialogoMotivazione';
import { Icona } from '@/components/ui/Icona';
import { MenuAzioni } from '@/components/ui/MenuAzioni';
import { Pulsante } from '@/components/ui/Pulsante';
import { Registro } from '@/components/ui/Registro';
import { Caricamento, ErroreConAzione } from '@/components/ui/Stati';
import { useToast } from '@/components/ui/Toast';
import { useSessione } from '@/features/account/sessione';
import { messaggi } from '@/lib/messaggi/it';
import {
  decidiSegnalazione,
  escalationSegnalazione,
  leggiMioNome,
  prendiInCaricoSegnalazione,
  SchemaOggettoEvento,
  SchemaOggettoFlyer,
  SchemaOggettoGruppo,
  SchemaOggettoLocale,
  SchemaOggettoProfilo,
  SchemaOggettoSerata,
  type AzioneSegnalazione,
  type ContenutoRimovibile,
  type BucketModerazione,
  type DettaglioSegnalazione as Dettaglio,
} from './api';
import { CHIAVI, useAdesso, useDettaglioSegnalazione, useFirme } from './dati';
import { BadgeAlcol, BadgeEta } from './Eventi';
import { dataBreve } from '@/features/gruppi/formato';
import { dataOra, testoErrore } from './formato';
import { PERCORSI_MODERAZIONE } from './GuscioModerazione';
import { AnteprimaMessaggio, DialogoEscalation, ImmagineSfocata } from './Riservato';
import { BadgePriorita, BadgeStatoSegnalazione, TempoRimanente } from './Segnalazioni';

const testi = messaggi.moderazione;
const d = testi.dettaglioSegnalazione;
const c = testi.codaSegnalazioni;
const esiti = messaggi.notifiche.esiti;

type Dialogo = AzioneSegnalazione | 'escalation' | null;

function codice(id: string): string {
  return `SEG-${id.slice(0, 4).toUpperCase()}`;
}

/** Dettaglio di una segnalazione (tavola 14): l'apertura è registrata (R-69). */
export function DettaglioSegnalazione() {
  const id = useSearchParams().get('id');
  const dettaglio = useDettaglioSegnalazione(id);
  if (!id || dettaglio.isPending) return <Caricamento descrizione={d.caricamento} righe={6} />;
  if (dettaglio.isError) {
    return (
      <div className="md-scorre pt-6">
        <ErroreConAzione
          titolo={testi.comune.erroreCaricamento.titolo}
          onRiprova={() => void dettaglio.refetch()}
          riprovaInCorso={dettaglio.isFetching}
        >
          {testi.comune.erroreCaricamento.testo}
        </ErroreConAzione>
      </div>
    );
  }
  if (!dettaglio.data) {
    return (
      <div className="md-scorre pt-6">
        <Avviso tipo="avviso">{testi.comune.nonTrovato}</Avviso>
      </div>
    );
  }
  return <Scheda s={dettaglio.data} apertaIl={dettaglio.dataUpdatedAt} />;
}

function Scheda({ s, apertaIl }: { s: Dettaglio; apertaIl: number }) {
  const client = useQueryClient();
  const mostraToast = useToast();
  const sessione = useSessione();
  const utenteId = sessione.stato === 'presente' ? sessione.utenteId : null;
  const mioNome = useQuery({
    queryKey: ['moderazione', 'nome', utenteId],
    queryFn: () => leggiMioNome(utenteId as string),
    enabled: utenteId !== null,
  });
  const adesso = useAdesso();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const profilo = SchemaOggettoProfilo.safeParse(s.oggetto).data ?? null;
  // Per un profilo senza foto la prima scelta è il nome.
  // Gruppi e serate: solo i testi scritti dagli utenti (R-16), mai l'elenco dei membri (R-69).
  const gruppo =
    s.tipo_oggetto === 'gruppo' ? (SchemaOggettoGruppo.safeParse(s.oggetto).data ?? null) : null;
  const serata =
    s.tipo_oggetto === 'serata_gruppo'
      ? (SchemaOggettoSerata.safeParse(s.oggetto).data ?? null)
      : null;
  const [contenuto, setContenuto] = useState<ContenutoRimovibile>(
    serata
      ? serata.note
        ? 'note'
        : serata.luogo_ritrovo
          ? 'luogo'
          : 'titolo'
      : gruppo || (s.tipo_oggetto === 'profilo' && !profilo?.avatar_path)
        ? 'nome'
        : 'foto',
  );
  const evento =
    s.tipo_oggetto === 'evento' ? (SchemaOggettoEvento.safeParse(s.oggetto).data ?? null) : null;
  const locale =
    s.tipo_oggetto === 'immagine_locale'
      ? (SchemaOggettoLocale.safeParse(s.oggetto).data ?? null)
      : null;
  const flyer =
    s.tipo_oggetto === 'caricamento_flyer'
      ? (SchemaOggettoFlyer.safeParse(s.oggetto).data ?? null)
      : null;
  const testoSerata = (campo: 'titolo' | 'luogo' | 'note') =>
    campo === 'titolo' ? serata?.titolo : campo === 'luogo' ? serata?.luogo_ritrovo : serata?.note;
  const eProfilo = s.tipo_oggetto === 'profilo' || s.tipo_oggetto === 'foto_profilo';

  const aggiorna = async (testo: string) => {
    setDialogo(null);
    mostraToast({ testo });
    await Promise.all([
      client.invalidateQueries({ queryKey: CHIAVI.segnalazione(s.segnalazione_id) }),
      client.invalidateQueries({ queryKey: CHIAVI.codaSegnalazioni }),
      client.invalidateQueries({ queryKey: CHIAVI.contatori }),
    ]);
  };

  const presa = useMutation({
    mutationFn: () => prendiInCaricoSegnalazione(s.segnalazione_id),
    onSuccess: () => void aggiorna(d.fatto.presa),
  });

  const chiusa = s.stato === 'chiusa';
  const inCaricoAltro = !chiusa && s.presa_da !== null && !s.presa_da_me;
  const puoDecidere = !chiusa && !inCaricoAltro && !s.in_escalation;
  const nome = profilo?.nome_visualizzato ?? '';

  // Azioni previste dal database per ogni tipo di oggetto (decidi_segnalazione).
  const azioni: AzioneSegnalazione[] = ['nessuna_violazione'];
  if (
    eProfilo ||
    evento?.immagine_path ||
    locale?.immagine_path ||
    gruppo ||
    (['titolo', 'luogo', 'note'] as const).some((campo) => testoSerata(campo))
  )
    azioni.push('rimuovi_contenuto');
  if (s.tipo_oggetto === 'evento') azioni.push('modifica_evento');
  if (eProfilo) azioni.push('sospendi_account');

  const titoloCoinvolto = (azione: AzioneSegnalazione): string | null => {
    if (azione === 'rimuovi_contenuto' && gruppo) return esiti.contenuto_rimosso_gruppo ?? null;
    if (azione === 'rimuovi_contenuto' && serata) return esiti.contenuto_rimosso_serata ?? null;
    if (!eProfilo) return null;
    if (azione === 'sospendi_account') return esiti.account_sospeso ?? null;
    if (azione === 'rimuovi_contenuto') {
      return (
        (contenuto === 'foto' ? esiti.contenuto_rimosso_foto : esiti.contenuto_rimosso) ?? null
      );
    }
    return null;
  };

  const anteprime = (azione: AzioneSegnalazione) =>
    function Anteprime(motivazione: string) {
      const coinvolto = titoloCoinvolto(azione);
      return (
        <div className="msg-due">
          <AnteprimaMessaggio
            destinatario={d.anteprima.segnalante}
            titolo={esiti.segnalazione_decisa ?? ''}
            motivazione={motivazione}
          />
          {coinvolto && (
            <AnteprimaMessaggio
              destinatario={d.anteprima.coinvolto}
              titolo={coinvolto}
              motivazione={motivazione}
            />
          )}
        </div>
      );
    };

  const chiaveRimozione = gruppo
    ? 'nome_gruppo'
    : serata && (contenuto === 'titolo' || contenuto === 'luogo' || contenuto === 'note')
      ? contenuto
      : eProfilo && (contenuto === 'foto' || contenuto === 'nome' || contenuto === 'username')
        ? contenuto
        : 'immagine';
  const effettoRimozione = d.dialoghi.rimuovi_contenuto.effetto[chiaveRimozione];
  const confermaRimozione = d.dialoghi.rimuovi_contenuto.conferma[chiaveRimozione];

  return (
    <>
      <header className="md-testa">
        <nav className="briciole" aria-label={c.titolo}>
          <Link href={PERCORSI_MODERAZIONE.segnalazioni}>{c.titolo}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="mono">
            {codice(s.segnalazione_id)}
          </span>
        </nav>
        <div className="md-titolo-riga">
          <div className="flex flex-col gap-2">
            <h1 className="md-titolo">{d.titolo[s.tipo_oggetto] ?? c.titolo}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <BadgePriorita priorita={s.priorita} />
              <TempoRimanente scadenza={s.scadenza} adesso={adesso} chiusa={chiusa} />
              <BadgeStatoSegnalazione
                stato={s.stato}
                presaDaMe={s.presa_da_me}
                presaDa={s.presa_da}
                inEscalation={s.in_escalation}
              />
            </div>
          </div>
          <div className="md-strumenti">
            {puoDecidere && s.stato === 'aperta' && (
              <Pulsante
                variante="secondario"
                caricamento={presa.isPending}
                onClick={() => presa.mutate()}
              >
                {d.prendiInCarico}
              </Pulsante>
            )}
            {puoDecidere && (
              <MenuAzioni
                etichetta={d.altreAzioni}
                voci={[
                  {
                    etichetta: testi.escalation.voce,
                    icona: <Icona icona={ShieldAlert} dimensione="s" />,
                    pericolo: true,
                    onScegli: () => setDialogo('escalation'),
                  },
                ]}
              />
            )}
          </div>
        </div>
      </header>
      <p className="banda-reg m-0" role="note">
        <Icona icona={Eye} dimensione="s" />
        <span>{d.registrata(mioNome.data ?? '', dataOra(new Date(apertaIl).toISOString()))}</span>
      </p>
      <div className="md-scorre">
        {presa.isError && (
          <div className="pt-4">
            <Avviso tipo="errore" titolo={testi.comune.erroreSalvataggio.titolo} portaInVista>
              {testoErrore(presa.error)}
            </Avviso>
          </div>
        )}
        <div className="md-due">
          <div className="md-col">
            <section className="md-sezione" aria-labelledby="oggetto-segnalato">
              <h2 id="oggetto-segnalato" className="etichetta-riga">
                {d.oggetto}
              </h2>
              {s.occultato && <Avviso tipo="info">{d.nascosto}</Avviso>}
              {!s.oggetto && <p className="guida m-0">{d.oggettoRimosso}</p>}
              {profilo && <OggettoProfilo profilo={profilo} tipo={s.tipo_oggetto} />}
              {evento && <OggettoEvento evento={evento} />}
              {gruppo && (
                <div className="flex flex-col gap-1">
                  <b className="t-titolo-2">{gruppo.nome}</b>
                  <span className="c-2">
                    {d.gruppo.membri(gruppo.membri)}
                    {gruppo.autore ? ` · ${d.gruppo.autore(gruppo.autore)}` : ''}
                  </span>
                  <p className="guida m-0">{d.gruppo.nota}</p>
                </div>
              )}
              {serata && (
                <div className="flex flex-col gap-2">
                  <span className="c-2">
                    {d.serata.gruppo(serata.gruppo_nome)} · {dataBreve(serata.data_serata)}
                    {serata.evento_titolo ? ` · ${d.serata.evento(serata.evento_titolo)}` : ''}
                  </span>
                  <dl className="m-0 flex flex-col gap-2">
                    {(['titolo', 'luogo', 'note'] as const).map((campo) => (
                      <div key={campo}>
                        <dt className="etichetta">{d.serata[campo]}</dt>
                        <dd className="md-testo-libero m-0">
                          {testoSerata(campo) ?? d.serata.vuoto}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {serata.autore && <span className="c-2">{d.serata.autore(serata.autore)}</span>}
                </div>
              )}
              {locale && (
                <>
                  <p className="m-0">
                    <b>{locale.nome}</b>
                    {locale.comune && <span className="c-2"> · {locale.comune}</span>}
                  </p>
                  <ImmagineFirmata
                    bucket="immagini-locali"
                    percorso={locale.immagine_path}
                    forma="largo"
                  />
                </>
              )}
              {flyer && (
                <ImmagineFirmata
                  bucket="flyer-caricati"
                  percorso={flyer.storage_path}
                  forma="flyer"
                />
              )}
            </section>

            <section className="md-sezione" aria-labelledby="motivo-segnalazione">
              <h2 id="motivo-segnalazione" className="etichetta-riga">
                {d.motivo}
              </h2>
              <div>
                <Badge variante="tenue">{c.motivi[s.motivo] ?? s.motivo}</Badge>
              </div>
              {s.dettagli ? (
                <blockquote className="citazione">«{s.dettagli}»</blockquote>
              ) : (
                <p className="guida m-0">{d.senzaTesto}</p>
              )}
              <p className="riservato m-0">
                <Icona icona={Lock} dimensione="s" />
                {d.anonimo}
              </p>
            </section>

            {s.altre.length > 0 && (
              <section className="md-sezione" aria-labelledby="altre-segnalazioni">
                <h2 id="altre-segnalazioni" className="etichetta-riga">
                  {d.altre(s.altre.length)}
                </h2>
                <ol className="registro">
                  {s.altre.map((a) => (
                    <li key={a.id} className="reg-riga">
                      <span className="quando">{dataOra(a.creata_il)}</span>
                      <span className="cosa">
                        <b>{c.motivi[a.motivo] ?? a.motivo}</b> · {c.stati[a.stato]}
                      </span>
                      {a.dettagli && <span className="perche">«{a.dettagli}»</span>}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>

          <div className="md-col">
            <section className="md-sezione" aria-labelledby="decisione">
              <h2 id="decisione" className="etichetta-riga">
                {d.decisione}
              </h2>
              {chiusa && <p className="m-0">{d.chiusa}</p>}
              {inCaricoAltro && s.presa_da && (
                <Avviso tipo="info">{d.inCaricoAltro(s.presa_da)}</Avviso>
              )}
              {!chiusa && (
                <div className="flex flex-wrap gap-2">
                  {azioni.map((azione) => (
                    <Pulsante
                      key={azione}
                      variante={azione === 'sospendi_account' ? 'pericolo' : 'secondario'}
                      dimensione="s"
                      disabled={!puoDecidere}
                      onClick={() => setDialogo(azione)}
                    >
                      {d.azioni[azione]}
                    </Pulsante>
                  ))}
                </div>
              )}
              {inCaricoAltro && s.presa_da && (
                <p className="motivo-spento m-0">
                  <Icona icona={Lock} dimensione="s" />
                  {d.pulsantiSpenti(s.presa_da)}
                </p>
              )}
              {!chiusa && <p className="guida m-0">{d.decisioneAiuto}</p>}
            </section>
            <section className="md-sezione" aria-labelledby="registro-segnalazione">
              <h2 id="registro-segnalazione" className="etichetta-riga">
                {testi.comune.registro}
              </h2>
              <Registro
                voci={s.registro.map((v) => ({
                  quando: dataOra(v.creata_il),
                  autore: v.autore,
                  cosa:
                    (testi.registroAzioni as Record<string, string>)[v.azione] ??
                    testi.registroAzioni.altro,
                  perche: v.motivazione,
                }))}
                etichettaSistema={testi.comune.sistema}
                vuoto={testi.comune.registroVuoto}
              />
            </section>
          </div>
        </div>
      </div>

      <DialogoMotivazione
        aperto={dialogo === 'nessuna_violazione'}
        onChiudi={() => setDialogo(null)}
        titolo={d.dialoghi.nessuna_violazione.titolo}
        sopratitolo={`${d.decisione} · ${codice(s.segnalazione_id)}`}
        effetto={d.dialoghi.nessuna_violazione.effetto}
        etichettaMotivazione={testi.comune.motivazione}
        aiutoMotivazione={testi.comune.restaNelRegistro}
        erroreMotivazioneMancante={testi.comune.motivazioneMancante}
        etichettaConferma={d.dialoghi.nessuna_violazione.conferma}
        etichettaAnnulla={testi.comune.annulla}
        testoErrore={testoErrore}
        anteprima={anteprime('nessuna_violazione')}
        onConferma={async (motivazione) => {
          await decidiSegnalazione(s.segnalazione_id, 'nessuna_violazione', motivazione);
          await aggiorna(d.fatto.decisa);
        }}
      />

      <DialogoMotivazione
        aperto={dialogo === 'rimuovi_contenuto'}
        onChiudi={() => setDialogo(null)}
        titolo={d.dialoghi.rimuovi_contenuto.titolo(
          nome ||
            gruppo?.nome ||
            serata?.titolo ||
            serata?.evento_titolo ||
            (d.titolo[s.tipo_oggetto] ?? ''),
        )}
        sopratitolo={`${d.decisione} · ${codice(s.segnalazione_id)}`}
        effetto={effettoRimozione}
        etichettaMotivazione={testi.comune.motivazione}
        aiutoMotivazione={testi.comune.restaNelRegistro}
        erroreMotivazioneMancante={testi.comune.motivazioneMancante}
        etichettaConferma={confermaRimozione}
        etichettaAnnulla={testi.comune.annulla}
        variante="pericolo"
        testoErrore={testoErrore}
        anteprima={anteprime('rimuovi_contenuto')}
        onConferma={async (motivazione) => {
          await decidiSegnalazione(
            s.segnalazione_id,
            'rimuovi_contenuto',
            motivazione,
            s.tipo_oggetto === 'profilo' || s.tipo_oggetto === 'serata_gruppo'
              ? contenuto
              : s.tipo_oggetto === 'gruppo'
                ? 'nome'
                : undefined,
          );
          await aggiorna(d.fatto.decisa);
        }}
      >
        {s.tipo_oggetto === 'profilo' && (
          <fieldset className="scelte-radio una">
            {(['foto', 'nome', 'username'] as const)
              .filter((scelta) => scelta !== 'foto' || profilo?.avatar_path)
              .map((scelta) => (
                <label key={scelta}>
                  <input
                    type="radio"
                    name="contenuto-da-rimuovere"
                    checked={contenuto === scelta}
                    onChange={() => setContenuto(scelta)}
                  />
                  {d.dialoghi.rimuovi_contenuto.scelte[scelta]}
                </label>
              ))}
          </fieldset>
        )}
        {serata && (
          <fieldset className="scelte-radio una">
            {(['titolo', 'luogo', 'note'] as const)
              .filter((campo) => testoSerata(campo))
              .map((campo) => (
                <label key={campo}>
                  <input
                    type="radio"
                    name="contenuto-da-rimuovere"
                    checked={contenuto === campo}
                    onChange={() => setContenuto(campo)}
                  />
                  {d.dialoghi.rimuovi_contenuto.scelte[campo]}
                </label>
              ))}
          </fieldset>
        )}
      </DialogoMotivazione>

      <DialogoMotivazione
        aperto={dialogo === 'modifica_evento'}
        onChiudi={() => setDialogo(null)}
        titolo={d.dialoghi.modifica_evento.titolo}
        sopratitolo={`${d.decisione} · ${codice(s.segnalazione_id)}`}
        effetto={
          <>
            {d.dialoghi.modifica_evento.effetto}{' '}
            <Link href={PERCORSI_MODERAZIONE.evento(s.oggetto_id)}>
              {d.dialoghi.modifica_evento.scheda}
            </Link>
          </>
        }
        etichettaMotivazione={testi.comune.motivazione}
        aiutoMotivazione={testi.comune.restaNelRegistro}
        erroreMotivazioneMancante={testi.comune.motivazioneMancante}
        etichettaConferma={d.dialoghi.modifica_evento.conferma}
        etichettaAnnulla={testi.comune.annulla}
        testoErrore={testoErrore}
        anteprima={anteprime('modifica_evento')}
        onConferma={async (motivazione) => {
          await decidiSegnalazione(s.segnalazione_id, 'modifica_evento', motivazione);
          await aggiorna(d.fatto.decisa);
        }}
      />

      <DialogoMotivazione
        aperto={dialogo === 'sospendi_account'}
        onChiudi={() => setDialogo(null)}
        titolo={d.dialoghi.sospendi_account.titolo(nome)}
        sopratitolo={`${d.decisione} · ${codice(s.segnalazione_id)}`}
        effetto={d.dialoghi.sospendi_account.effetto}
        etichettaMotivazione={testi.comune.motivazione}
        aiutoMotivazione={testi.comune.restaNelRegistro}
        erroreMotivazioneMancante={testi.comune.motivazioneMancante}
        etichettaConferma={d.dialoghi.sospendi_account.conferma}
        etichettaAnnulla={testi.comune.annulla}
        variante="pericolo"
        testoErrore={testoErrore}
        anteprima={anteprime('sospendi_account')}
        onConferma={async (motivazione) => {
          await decidiSegnalazione(s.segnalazione_id, 'sospendi_account', motivazione);
          await aggiorna(d.fatto.decisa);
        }}
      />

      <DialogoEscalation
        aperto={dialogo === 'escalation'}
        onChiudi={() => setDialogo(null)}
        sopratitolo={`${codice(s.segnalazione_id)} · R-55`}
        onConferma={async (motivazione) => {
          await escalationSegnalazione(s.segnalazione_id, motivazione);
          await aggiorna(d.fatto.escalation);
        }}
      />
    </>
  );
}

function ImmagineFirmata({
  bucket,
  percorso,
  forma,
  didascalia,
}: {
  bucket: BucketModerazione;
  percorso: string | null;
  forma: 'quadrata' | 'flyer' | 'largo';
  didascalia?: string;
}) {
  const firme = useFirme(bucket, percorso ? [percorso] : []);
  if (!percorso) return <p className="guida m-0">{d.sfocata.nessuna}</p>;
  return (
    <ImmagineSfocata
      url={firme.data?.[percorso] ?? null}
      alt={d.sfocata.alt}
      forma={forma}
      didascalia={didascalia}
    />
  );
}

function OggettoProfilo({
  profilo,
  tipo,
}: {
  profilo: NonNullable<ReturnType<typeof SchemaOggettoProfilo.safeParse>['data']>;
  tipo: string;
}) {
  return (
    <>
      <div className="ogg-profilo">
        {/* Solo le iniziali: la foto si guarda sfocata qui sotto, con «Mostra». */}
        <Avatar nome={profilo.nome_visualizzato} dimensione="l" decorativo />
        <span>
          <b>{profilo.nome_visualizzato}</b>
          <span className="mono">@{profilo.username}</span>
        </span>
        <span className="fine flex flex-wrap gap-1">
          <Badge variante="testo">{c.tipi[tipo] ?? tipo}</Badge>
          {profilo.stato_account === 'sospeso' && <Badge variante="errore">{d.sospeso}</Badge>}
        </span>
      </div>
      {profilo.avatar_path && (
        <ImmagineFirmata bucket="avatar" percorso={profilo.avatar_path} forma="quadrata" />
      )}
    </>
  );
}

function OggettoEvento({
  evento,
}: {
  evento: NonNullable<ReturnType<typeof SchemaOggettoEvento.safeParse>['data']>;
}): ReactNode {
  return (
    <>
      <div className="ogg-profilo">
        <span className="flex flex-col gap-1">
          <span className="mono">{dataOra(evento.inizio)}</span>
          <b>{evento.titolo}</b>
          <span className="c-2">
            {evento.locale_nome}
            {evento.locale_comune ? ` · ${evento.locale_comune}` : ''}
          </span>
          <span className="flex flex-wrap gap-1">
            <BadgeEta eta={evento.eta_minima} dichiarata={evento.eta_minima_dichiarata} />
            {evento.riferimenti_alcol && <BadgeAlcol alcol />}
          </span>
        </span>
        <Link className="fine btn btn-testo btn-s" href={PERCORSI_MODERAZIONE.evento(evento.id)}>
          {d.dialoghi.modifica_evento.scheda}
        </Link>
      </div>
      {evento.immagine_path && (
        <ImmagineFirmata bucket="flyer-pubblicati" percorso={evento.immagine_path} forma="largo" />
      )}
    </>
  );
}
