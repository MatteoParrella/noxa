'use client';

import { CalendarDays, MapPin } from 'lucide-react';
import { useState } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Foglio } from '@/components/ui/Foglio';
import { Icona } from '@/components/ui/Icona';
import { Interruttore } from '@/components/ui/Interruttore';
import { Pulsante } from '@/components/ui/Pulsante';
import { Segmenti } from '@/components/ui/Segmenti';
import { classi } from '@/lib/classi';
import type { DataCalendario } from '@/lib/date';
import { messaggi } from '@/lib/messaggi/it';
import { suggerisciComuni } from './comuni';
import { nomeGenere, useEventi, useGeneri } from './dati';
import {
  DISTANZE,
  ETA_MASSIME,
  FILTRI_INIZIALI,
  parametriRicerca,
  type Distanza,
  type EtaMassima,
  type Filtri,
} from './filtri';
import { FoglioData } from './FoglioData';
import type { StatoPosizione } from './posizione';
import { OPZIONI_QUANDO, valoreQuando } from './quando';

const testi = messaggi.scopri.foglio;

type Props = {
  iniziali: Filtri;
  oggi: DataCalendario;
  posizione: StatoPosizione;
  chiediPosizione: () => Promise<StatoPosizione>;
  onApplica: (filtri: Filtri) => void;
  onChiudi: () => void;
};

/**
 * Foglio dei filtri (design/F-01-scopri, tavola 02): le scelte valgono solo con "Mostra N
 * eventi", che conta già i risultati. La posizione si chiede solo con un tocco esplicito e
 * non viene salvata (R-33).
 */
export function FoglioFiltri({
  iniziali,
  oggi,
  posizione,
  chiediPosizione,
  onApplica,
  onChiudi,
}: Props) {
  const [bozza, setBozza] = useState<Filtri>(iniziali);
  const [testoComune, setTestoComune] = useState(
    iniziali.dove.tipo === 'comune' ? iniziali.dove.comune : '',
  );
  const [calendario, setCalendario] = useState(false);
  const generi = useGeneri();
  const nomi = Object.fromEntries((generi.data ?? []).map((g) => [g.codice, g.nome]));

  const coordinate = posizione.stato === 'pronta' ? posizione.coordinate : null;
  const conteggio = useEventi(
    bozza.dove.tipo === 'posizione' && !coordinate
      ? null
      : parametriRicerca(bozza, coordinate, oggi),
  );
  const numero =
    conteggio.isPlaceholderData || conteggio.isPending ? null : (conteggio.data?.length ?? null);

  const cambia = (modifica: Partial<Filtri>) =>
    setBozza((attuale) => ({ ...attuale, ...modifica }));

  const usaPosizione = async () => {
    cambia({ dove: { tipo: 'posizione' }, distanzaKm: bozza.distanzaKm ?? 10 });
    const esito = posizione.stato === 'pronta' ? posizione : await chiediPosizione();
    if (esito.stato !== 'pronta') {
      cambia({ dove: { tipo: 'ovunque' } });
    }
  };

  const suggerimenti =
    bozza.dove.tipo === 'comune' && testoComune !== bozza.dove.comune
      ? suggerisciComuni(testoComune)
      : [];

  return (
    <>
      <Foglio aperto titolo={testi.titolo} onChiudi={onChiudi}>
        <div className="foglio-filtri">
          <section className="foglio-sezione" aria-labelledby="filtri-quando">
            <h3 id="filtri-quando" className="etichetta m-0">
              {testi.quando}
            </h3>
            <div className="scopri-barra">
              <Segmenti
                etichetta={testi.quando}
                opzioni={OPZIONI_QUANDO}
                valore={valoreQuando(bozza.quando)}
                onCambia={(valore) => cambia({ quando: { tipo: valore } })}
                className="flex-1"
              />
              <Pulsante
                variante="secondario"
                dimensione="s"
                className={classi(bozza.quando.tipo === 'data' && 'is-on')}
                aria-pressed={bozza.quando.tipo === 'data'}
                onClick={() => setCalendario(true)}
              >
                <Icona icona={CalendarDays} dimensione="s" />
                {messaggi.scopri.scegliData}
              </Pulsante>
            </div>
          </section>

          <section className="foglio-sezione" aria-labelledby="filtri-dove">
            <h3 id="filtri-dove" className="etichetta m-0">
              {testi.dove}
            </h3>
            {(posizione.stato === 'negata' || posizione.stato === 'non_disponibile') && (
              <Avviso
                tipo="info"
                titolo={
                  posizione.stato === 'negata'
                    ? testi.posizioneNegata.titolo
                    : testi.posizioneAssente.titolo
                }
              >
                {posizione.stato === 'negata'
                  ? testi.posizioneNegata.testo
                  : testi.posizioneAssente.testo}
              </Avviso>
            )}
            <div role="radiogroup" aria-labelledby="filtri-dove" className="flex flex-col">
              <OpzioneRadio
                selezionata={bozza.dove.tipo === 'ovunque'}
                onScegli={() => cambia({ dove: { tipo: 'ovunque' }, distanzaKm: null })}
              >
                {testi.ovunque}
              </OpzioneRadio>
              <OpzioneRadio
                selezionata={bozza.dove.tipo === 'posizione'}
                onScegli={() => void usaPosizione()}
              >
                {posizione.stato === 'attesa' ? testi.posizioneAttesa : testi.usaPosizione}
              </OpzioneRadio>
              <OpzioneRadio
                selezionata={bozza.dove.tipo === 'comune'}
                onScegli={() => {
                  // Si parte da Milano finché non se ne sceglie un altro: campo e filtro coincidono.
                  const comune = testoComune || 'Milano';
                  setTestoComune(comune);
                  cambia({ dove: { tipo: 'comune', comune }, distanzaKm: bozza.distanzaKm ?? 10 });
                }}
              >
                {testi.scegliComune}
              </OpzioneRadio>
            </div>
            {bozza.dove.tipo === 'comune' && (
              <div className="campo">
                <label className="campo-etichetta" htmlFor="filtri-comune">
                  {testi.comune}
                </label>
                <span className="campo-box">
                  <Icona icona={MapPin} dimensione="s" className="c-2" />
                  <input
                    id="filtri-comune"
                    value={testoComune}
                    placeholder={testi.comuneSegnaposto}
                    autoComplete="off"
                    aria-describedby="filtri-nota-posizione"
                    onFocus={(evento) => evento.target.select()}
                    onChange={(evento) => setTestoComune(evento.target.value)}
                  />
                </span>
                {testoComune.trim() !== '' &&
                  testoComune !== bozza.dove.comune &&
                  (suggerimenti.length > 0 ? (
                    <div className="suggerimenti">
                      {suggerimenti.map((comune) => (
                        <button
                          key={comune.nome}
                          type="button"
                          onClick={() => {
                            setTestoComune(comune.nome);
                            cambia({ dove: { tipo: 'comune', comune: comune.nome } });
                          }}
                        >
                          {comune.nome}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="campo-aiuto m-0" role="status">
                      {testi.nessunComune}
                    </p>
                  ))}
              </div>
            )}
            <p id="filtri-nota-posizione" className="t-didascalia m-0">
              {testi.posizioneNota}
            </p>
            {bozza.dove.tipo !== 'ovunque' && (
              <div className="flex flex-col gap-2">
                <span className="t-corpo-s" id="filtri-distanza">
                  {testi.distanza}
                </span>
                <Segmenti
                  etichetta={testi.distanza}
                  opzioni={[
                    ...DISTANZE.map((km) => ({ valore: String(km), etichetta: `${km} km` })),
                    { valore: 'tutte', etichetta: messaggi.scopri.distanze.tutteBreve },
                  ]}
                  valore={bozza.distanzaKm === null ? 'tutte' : String(bozza.distanzaKm)}
                  onCambia={(valore) =>
                    cambia({
                      distanzaKm: valore === 'tutte' ? null : (Number(valore) as Distanza),
                    })
                  }
                  className="segmenti-mono"
                />
              </div>
            )}
          </section>

          <section className="foglio-sezione" aria-labelledby="filtri-generi">
            <h3 id="filtri-generi" className="etichetta m-0">
              {testi.generi}
            </h3>
            <div className="chips-avvolte" role="group" aria-labelledby="filtri-generi">
              {(generi.data ?? []).map((genere) => {
                const scelto = bozza.generi.includes(genere.codice);
                return (
                  <button
                    key={genere.codice}
                    type="button"
                    className={classi('chip', scelto && 'is-on')}
                    aria-pressed={scelto}
                    onClick={() =>
                      cambia({
                        generi: scelto
                          ? bozza.generi.filter((codice) => codice !== genere.codice)
                          : [...bozza.generi, genere.codice],
                      })
                    }
                  >
                    {nomeGenere(nomi, genere.codice)}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="foglio-sezione" aria-labelledby="filtri-eta">
            <h3 id="filtri-eta" className="etichetta m-0">
              {testi.eta}
            </h3>
            <p className="t-didascalia m-0" id="filtri-eta-spiegazione">
              {testi.etaSpiegazione}
            </p>
            <Segmenti
              etichetta={testi.eta}
              opzioni={[
                { valore: 'tutte', etichetta: testi.etaTutte },
                ...ETA_MASSIME.map((eta) => ({ valore: String(eta), etichetta: `${eta}+` })),
              ]}
              valore={bozza.etaMassima === null ? 'tutte' : String(bozza.etaMassima)}
              onCambia={(valore) =>
                cambia({ etaMassima: valore === 'tutte' ? null : (Number(valore) as EtaMassima) })
              }
              className="segmenti-mono"
            />
          </section>

          <section className="foglio-sezione">
            <Interruttore
              etichetta={testi.soloAmici}
              descrizione={testi.soloAmiciDescrizione}
              attivo={bozza.soloAmici}
              onCambia={(soloAmici) => cambia({ soloAmici })}
            />
          </section>
        </div>
        <div className="foglio-piede">
          <Pulsante
            variante="secondario"
            onClick={() => {
              setBozza({ ...FILTRI_INIZIALI, quando: bozza.quando });
              setTestoComune('');
            }}
          >
            {testi.azzera}
          </Pulsante>
          <Pulsante
            variante="secondario"
            onClick={() => onApplica(bozza)}
            disabled={bozza.dove.tipo === 'posizione' && !coordinate}
          >
            <span aria-live="polite">{testi.mostra(numero)}</span>
          </Pulsante>
        </div>
      </Foglio>
      {calendario && (
        <FoglioData
          oggi={oggi}
          scelta={bozza.quando.tipo === 'data' ? bozza.quando.data : undefined}
          onChiudi={() => setCalendario(false)}
          onConferma={(data) => {
            cambia({ quando: { tipo: 'data', data } });
            setCalendario(false);
          }}
        />
      )}
    </>
  );
}

function OpzioneRadio({
  selezionata,
  onScegli,
  children,
}: {
  selezionata: boolean;
  onScegli: () => void;
  children: string;
}) {
  return (
    <label className="opz-riga">
      <input
        type="radio"
        name="filtri-dove"
        className="opz-input"
        checked={selezionata}
        onChange={onScegli}
      />
      <span className={classi('opzione', selezionata && 'is-on')} aria-hidden="true" />
      {children}
    </label>
  );
}
