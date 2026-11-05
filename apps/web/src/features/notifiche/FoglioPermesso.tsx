'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Check, Info, Share, SquarePlus, TriangleAlert, X } from 'lucide-react';
import { useState } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Foglio } from '@/components/ui/Foglio';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { messaggi } from '@/lib/messaggi/it';
import { registraErrore } from '@/lib/registro';
import { attivaPush, statoPush } from './push';
import { CHIAVI_PUSH } from './datiPush';

const testi = messaggi.push.foglio;

type Fase =
  'spiegazione' | 'attesa' | 'attivate' | 'negato' | 'non_compatibile' | 'iphone' | 'errore';

function faseIniziale(): Fase {
  const stato = statoPush();
  if (stato === 'negato') return 'negato';
  if (stato === 'iphone_da_installare') return 'iphone';
  if (stato === 'non_compatibile') return 'non_compatibile';
  return 'spiegazione';
}

/**
 * Foglio "Ricevi le notifiche sul telefono" (design/F-22-notifiche §1): prima spiega cosa
 * arriva e cosa no, poi, solo dopo il tocco su "Attiva", chiede il permesso del sistema.
 * "Attiva" e "Non ora" hanno lo stesso peso (R-43). Gli esiti sono annunciati.
 */
export function FoglioPermesso({ aperto, onChiudi }: { aperto: boolean; onChiudi: () => void }) {
  return (
    <Foglio aperto={aperto} onChiudi={onChiudi} titolo={testi.titolo}>
      {/* Il contenuto si rimonta a ogni apertura, così la fase riparte dallo stato attuale. */}
      {aperto && <Contenuto onChiudi={onChiudi} />}
    </Foglio>
  );
}

function Contenuto({ onChiudi }: { onChiudi: () => void }) {
  const client = useQueryClient();
  const [fase, setFase] = useState<Fase>(faseIniziale);

  const attiva = async () => {
    setFase('attesa');
    try {
      const esito = await attivaPush();
      setFase(
        esito === 'attivate'
          ? 'attivate'
          : esito === 'iphone_da_installare'
            ? 'iphone'
            : esito === 'negato'
              ? 'negato'
              : 'non_compatibile',
      );
    } catch (errore) {
      registraErrore('attivazione notifiche', errore);
      setFase('errore');
    } finally {
      void client.invalidateQueries({ queryKey: CHIAVI_PUSH.push });
    }
  };

  return (
    <div className="nf-corpo" aria-live="polite">
      <span className="etichetta">{testi.sopratitolo}</span>
      {(fase === 'spiegazione' || fase === 'attesa' || fase === 'errore') && (
        <>
          {fase === 'attesa' ? (
            <div className="nf-attesa">
              <b>{testi.attesa.titolo}</b>
              <p className="t-corpo-s c-2">{testi.attesa.testo}</p>
            </div>
          ) : (
            <Spiegazione />
          )}
          {fase === 'errore' && (
            <Avviso tipo="errore" titolo={testi.errore.titolo}>
              {testi.errore.testo}
            </Avviso>
          )}
          <div className="nf-azioni">
            <Pulsante variante="secondario" pieno onClick={onChiudi}>
              {testi.nonOra}
            </Pulsante>
            <Pulsante
              variante="secondario"
              pieno
              disabled={fase === 'attesa'}
              onClick={() => void attiva()}
            >
              {fase === 'errore' ? testi.riprova : testi.attiva}
            </Pulsante>
          </div>
        </>
      )}
      {fase === 'attivate' && (
        <>
          <Avviso tipo="successo" titolo={testi.attive.avviso}>
            {testi.attive.testo}
          </Avviso>
          <h3 className="etichetta m-0">{testi.attive.anteprima}</h3>
          <AnteprimaNotifica
            titolo={testi.attive.esempioTitolo}
            testo={testi.attive.esempioTesto}
          />
          <p className="nf-piede">{testi.attive.nota}</p>
          <Pulsante variante="secondario" pieno onClick={onChiudi}>
            {testi.attive.fatto}
          </Pulsante>
        </>
      )}
      {fase === 'negato' && (
        <>
          <PermessoNegato titolo={testi.negato.avviso} testo={testi.negato.testo} />
          <p className="nf-piede">{testi.negato.nota}</p>
          <Pulsante variante="secondario" pieno onClick={onChiudi}>
            {testi.hoCapito}
          </Pulsante>
        </>
      )}
      {fase === 'non_compatibile' && (
        <>
          <div className="nf-avviso">
            <p className="nf-avviso-testa m-0">
              <Icona icona={TriangleAlert} />
              <span>
                <b>{testi.nonCompatibile.avviso}</b>
                {testi.nonCompatibile.testo}
              </span>
            </p>
          </div>
          <Pulsante variante="secondario" pieno onClick={onChiudi}>
            {testi.hoCapito}
          </Pulsante>
        </>
      )}
      {fase === 'iphone' && (
        <>
          <AggiungiAllaHome titolo={testi.iphone.avviso} testo={testi.iphone.testo} conPoi />
          <Pulsante variante="secondario" pieno onClick={onChiudi}>
            {testi.hoCapito}
          </Pulsante>
        </>
      )}
    </div>
  );
}

function Spiegazione() {
  return (
    <>
      <p className="t-corpo-s c-2">{testi.intro}</p>
      <section className="nf-blocco" aria-labelledby="nf-arriva">
        <h3 className="etichetta" id="nf-arriva">
          {testi.cosaArriva}
        </h3>
        <ul className="nf-lista">
          {testi.arriva.map((voce) => (
            <li key={voce}>
              <Icona icona={Check} dimensione="s" />
              {voce}
            </li>
          ))}
        </ul>
      </section>
      <section className="nf-blocco mai" aria-labelledby="nf-mai">
        <h3 className="etichetta" id="nf-mai">
          {testi.cosaNo}
        </h3>
        <ul className="nf-lista mai">
          {testi.no.map((voce) => (
            <li key={voce}>
              <Icona icona={X} dimensione="s" />
              {voce}
            </li>
          ))}
        </ul>
      </section>
      <p className="nf-piede">{testi.spegni}</p>
    </>
  );
}

/** Anteprima neutra di una notifica di sistema, senza imitare un sistema operativo. */
export function AnteprimaNotifica({ titolo, testo }: { titolo: string; testo: string }) {
  return (
    <div className="nf-anteprima">
      <span className="nf-app" aria-hidden="true">
        n
      </span>
      <span>
        <span className="nf-ant-testa">
          <span>Noxa</span>
          <span>{testi.attive.ora}</span>
        </span>
        <span className="nf-ant-titolo">{titolo}</span>
        <span className="nf-ant-testo">{testo}</span>
      </span>
    </div>
  );
}

/** Avviso "permesso negato" con i percorsi delle impostazioni (design/F-22-notifiche). */
export function PermessoNegato({ titolo, testo }: { titolo: string; testo: string }) {
  return (
    <div className="nf-avviso">
      <p className="nf-avviso-testa m-0">
        <Icona icona={TriangleAlert} />
        <span>
          <b>{titolo}</b>
          {testo}
        </span>
      </p>
      {messaggi.push.percorsi.map((percorso) => (
        <ol key={percorso.join()} className="nf-percorso">
          {percorso.map((passo) => (
            <li key={passo}>{passo}</li>
          ))}
        </ol>
      ))}
    </div>
  );
}

/** I due passi per aggiungere Noxa alla schermata Home di iPhone, con testo oltre alle icone. */
export function AggiungiAllaHome({
  titolo,
  testo,
  conPoi = false,
}: {
  titolo: string;
  testo: string;
  conPoi?: boolean;
}) {
  return (
    <div className="nf-avviso home">
      <p className="nf-avviso-testa m-0">
        <Icona icona={Info} />
        <span>
          <b>{titolo}</b>
          {testo}
        </span>
      </p>
      <ol className="nf-passi">
        {testi.iphone.passi.map((passo, indice) => (
          <li key={passo.grassetto}>
            <span>
              {passo.prima}
              <b>{passo.grassetto}</b>
              {passo.dopo}
            </span>
            <Icona icona={indice === 0 ? Share : SquarePlus} />
          </li>
        ))}
      </ol>
      {conPoi && <p className="nf-piede">{testi.iphone.poi}</p>}
    </div>
  );
}
