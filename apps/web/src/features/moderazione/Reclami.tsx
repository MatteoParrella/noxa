'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Lock, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { Badge, type VarianteBadge } from '@/components/ui/Badge';
import { DialogoMotivazione } from '@/components/ui/DialogoMotivazione';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { useToast } from '@/components/ui/Toast';
import { classi } from '@/lib/classi';
import { messaggi } from '@/lib/messaggi/it';
import { decidiReclamo, esamiReclamo, type ReclamoModerazione } from './api';
import { CHIAVI, useContatori, useReclamiModerazione } from './dati';
import { dataOra, testoErrore } from './formato';
import { AnteprimaMessaggio } from './Riservato';
import { schedeSegnalazioni } from './Segnalazioni';
import { Testata } from './Testata';

const testi = messaggi.moderazione;
const t = testi.codaReclami;
const esiti = messaggi.notifiche.esiti;

const VARIANTI: Record<ReclamoModerazione['stato'], VarianteBadge> = {
  inviato: 'info',
  in_esame: 'accento',
  deciso: 'testo',
};

/**
 * Reclami (tavola 16, DSA art. 20): elenco a sinistra, scheda a destra. Chi ha preso la
 * decisione contestata vede il reclamo ma non può deciderlo (lo impone anche il database).
 */
export function Reclami() {
  const reclami = useReclamiModerazione();
  const contatori = useContatori();
  const [scelto, setScelto] = useState<string | null>(null);
  const attivo = reclami.data?.find((r) => r.id === scelto) ?? reclami.data?.[0] ?? null;
  const daDecidere = (reclami.data ?? []).filter((r) => r.stato !== 'deciso').length;

  return (
    <>
      <Testata
        titolo={t.titolo}
        conta={reclami.data ? String(daDecidere) : undefined}
        schede={schedeSegnalazioni('reclami', contatori.data?.reclami)}
        etichettaSchede={testi.codaSegnalazioni.titolo}
      />
      <div className="md-scorre">
        {reclami.isPending && <Caricamento descrizione={t.caricamento} righe={4} />}
        {reclami.isError && (
          <div className="pt-6">
            <ErroreConAzione
              titolo={testi.comune.erroreCaricamento.titolo}
              onRiprova={() => void reclami.refetch()}
              riprovaInCorso={reclami.isFetching}
            >
              {testi.comune.erroreCaricamento.testo}
            </ErroreConAzione>
          </div>
        )}
        {reclami.data?.length === 0 && (
          <div className="pt-6">
            <ElencoVuoto icona={MessageSquare} titolo={t.vuoto.titolo}>
              {t.vuoto.testo}
            </ElencoVuoto>
          </div>
        )}
        {reclami.data && attivo && (
          <div className="md-due">
            <nav className="md-col" aria-label={t.elenco}>
              <ul className="m-0 list-none p-0">
                {reclami.data.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className={classi('rec-voce', r.id === attivo.id && 'is-on')}
                      aria-current={r.id === attivo.id ? 'true' : undefined}
                      onClick={() => setScelto(r.id)}
                    >
                      <b>{r.descrizione ?? testi.codaSegnalazioni.tipi[r.tipo_oggetto]}</b>
                      <Badge variante={VARIANTI[r.stato]}>{t.stati[r.stato]}</Badge>
                      <span>
                        {azione(r.decisione_azione)} ·{' '}
                        <span className="mono">{t.ricevuto(dataOra(r.creato_il))}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            <SchedaReclamo key={attivo.id} reclamo={attivo} />
          </div>
        )}
      </div>
    </>
  );
}

function azione(codice: string): string {
  const azioni = testi.registroAzioni as Record<string, string>;
  return azioni[codice] ?? testi.registroAzioni.altro;
}

function SchedaReclamo({ reclamo: r }: { reclamo: ReclamoModerazione }) {
  const client = useQueryClient();
  const mostraToast = useToast();
  const [dialogo, setDialogo] = useState<'conferma' | 'cambia' | null>(null);

  async function decidi(cambia: boolean, motivazione: string) {
    // "In esame" prima della decisione, così un altro moderatore vede che è in lavorazione.
    if (r.stato === 'inviato') await esamiReclamo(r.id);
    await decidiReclamo(r.id, cambia, motivazione);
    setDialogo(null);
    mostraToast({ testo: t.fatto });
    await Promise.all([
      client.invalidateQueries({ queryKey: CHIAVI.reclamiMod }),
      client.invalidateQueries({ queryKey: CHIAVI.contatori }),
    ]);
  }

  return (
    <section className="md-col" aria-labelledby={`reclamo-${r.id}`}>
      <div className="md-sezione">
        <h2 id={`reclamo-${r.id}`} className="etichetta-riga">
          {t.decisioneOriginale}
        </h2>
        <p className="m-0">
          <b>{r.decisione_autore ?? t.sistema}</b> {azione(r.decisione_azione)}
          <span className="c-2 mono"> · {dataOra(r.decisione_il)}</span>
        </p>
        {r.decisione_motivazione && (
          <>
            <p className="campo-etichetta m-0">{t.motivazioneOriginale}</p>
            <blockquote className="citazione">{r.decisione_motivazione}</blockquote>
          </>
        )}
      </div>
      <div className="md-sezione">
        <h2 className="etichetta-riga">{t.testoReclamo}</h2>
        <blockquote className="citazione">«{r.testo}»</blockquote>
        <p className="riservato m-0">
          <Icona icona={Lock} dimensione="s" />
          {t.ricevuto(dataOra(r.creato_il))}
        </p>
      </div>
      <div className="md-sezione">
        <h2 className="etichetta-riga">{t.esito}</h2>
        {r.stato === 'deciso' ? (
          <>
            <p className="m-0 font-medium">{r.esito ? t.esiti[r.esito] : t.stati.deciso}</p>
            {r.motivazione_esito && <p className="m-0 c-2">{r.motivazione_esito}</p>}
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Pulsante
                variante="secondario"
                disabled={!r.puo_decidere}
                onClick={() => setDialogo('conferma')}
              >
                {t.conferma}
              </Pulsante>
              <Pulsante
                variante="secondario"
                disabled={!r.puo_decidere}
                onClick={() => setDialogo('cambia')}
              >
                {t.cambia}
              </Pulsante>
            </div>
            {!r.puo_decidere && (
              <p className="motivo-spento m-0">
                <Icona icona={Lock} dimensione="s" />
                {t.stessoModeratore}
              </p>
            )}
          </>
        )}
      </div>

      {(['conferma', 'cambia'] as const).map((tipo) => (
        <DialogoMotivazione
          key={tipo}
          aperto={dialogo === tipo}
          onChiudi={() => setDialogo(null)}
          titolo={t.dialoghi[tipo].titolo}
          sopratitolo={t.titolo}
          effetto={t.dialoghi[tipo].effetto}
          etichettaMotivazione={testi.comune.motivazione}
          aiutoMotivazione={testi.comune.restaNelRegistro}
          erroreMotivazioneMancante={testi.comune.motivazioneMancante}
          etichettaConferma={t.dialoghi[tipo].azione}
          etichettaAnnulla={testi.comune.annulla}
          testoErrore={testoErrore}
          anteprima={(motivazione) => (
            <AnteprimaMessaggio
              destinatario={t.destinatario}
              titolo={esiti.reclamo_deciso ?? ''}
              motivazione={motivazione}
              reclamo={false}
            />
          )}
          onConferma={(motivazione) => decidi(tipo === 'cambia', motivazione)}
        />
      ))}
    </section>
  );
}
