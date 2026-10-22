'use client';

import { MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { messaggi } from '@/lib/messaggi/it';
import { decidiReclamo, esamiReclamo, type ReclamoModerazione } from './api';
import { CHIAVI, useReclamiModerazione } from './dati';
import { dataOra } from './formato';
import { useQueryClient, useMutation } from '@tanstack/react-query';

const testi = messaggi.moderazione.codaReclami;

type StatoReclamo = 'inviato' | 'in_esame' | 'deciso';
type VarianteStato = 'tenue' | 'accento' | 'successo';
function statoVariante(s: StatoReclamo): VarianteStato {
  if (s === 'deciso') return 'successo';
  if (s === 'in_esame') return 'accento';
  return 'tenue';
}

/** Coda dei reclami (DSA art. 20) con form di decisione inline. */
export function Reclami() {
  const reclami = useReclamiModerazione();

  if (reclami.isPending) return <Caricamento descrizione={testi.caricamento} />;
  if (reclami.isError) {
    return (
      <ErroreConAzione
        titolo={messaggi.comune.erroreRete.titolo}
        onRiprova={() => void reclami.refetch()}
        riprovaInCorso={reclami.isFetching}
      >
        {messaggi.comune.erroreRete.testo}
      </ErroreConAzione>
    );
  }
  if (reclami.data.length === 0) {
    return (
      <ElencoVuoto icona={MessageSquare} titolo={testi.vuoto.titolo}>
        {testi.vuoto.testo}
      </ElencoVuoto>
    );
  }

  return (
    <div className="md-tabella-contenitore" role="region" aria-label={testi.titolo}>
      <table className="md-tabella">
        <thead>
          <tr>
            <th scope="col">{testi.colonne.stato}</th>
            <th scope="col">{testi.colonne.tipo}</th>
            <th scope="col">{testi.colonne.decisioneOriginale}</th>
            <th scope="col">{testi.colonne.ricevuto}</th>
            <th scope="col">
              <span className="sr-only">{testi.colonne.azioni}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {reclami.data.map((r) => (
            <RigaReclamo key={r.id} reclamo={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RigaReclamo({ reclamo: r }: { reclamo: ReclamoModerazione }) {
  const client = useQueryClient();
  const [aperta, setAperta] = useState(false);
  const [motivazione, setMotivazione] = useState('');
  const [errore, setErrore] = useState('');

  const esamina = useMutation({
    mutationFn: () => esamiReclamo(r.id),
    onSuccess: () => void client.invalidateQueries({ queryKey: CHIAVI.reclamiMod }),
  });

  const decidi = useMutation({
    mutationFn: ({ cambia }: { cambia: boolean }) => decidiReclamo(r.id, cambia, motivazione),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: CHIAVI.reclamiMod });
      setAperta(false);
      setMotivazione('');
    },
    onError: () => setErrore(testi.errore),
  });

  function apriForm() {
    if (r.stato === 'inviato') esamina.mutate();
    setAperta(true);
  }

  function inviaDecisione(cambia: boolean) {
    if (!motivazione.trim()) {
      setErrore(messaggi.moderazione.comune.motivazioneMancante);
      return;
    }
    setErrore('');
    decidi.mutate({ cambia });
  }

  return (
    <>
      <tr>
        <td>
          <Badge variante={statoVariante(r.stato)}>{testi.stati[r.stato]}</Badge>
          {!r.puo_decidere && (
            <span className="t-corpo-piccolo c-tenue ml-2">{testi.non_puo_decidere}</span>
          )}
        </td>
        <td className="t-corpo-piccolo">{r.tipo_oggetto.replace(/_/g, ' ')}</td>
        <td className="t-corpo-piccolo">
          <span>{r.decisione_azione.replace(/_/g, ' ')}</span>
          {r.decisione_autore && <small className="block c-tenue">{r.decisione_autore}</small>}
        </td>
        <td>
          <time dateTime={r.creato_il} className="t-corpo-piccolo">
            {dataOra(r.creato_il)}
          </time>
        </td>
        <td>
          {r.stato !== 'deciso' && r.puo_decidere && (
            <button
              type="button"
              className="btn btn-testo btn-s"
              onClick={apriForm}
              aria-expanded={aperta}
            >
              {r.stato === 'inviato' ? testi.esamina : testi.conferma}
            </button>
          )}
        </td>
      </tr>
      {aperta && (
        <tr>
          <td colSpan={5}>
            <div
              className="md-form-inline"
              role="region"
              aria-label={testi.etichettaDecisione(r.id)}
            >
              <p className="t-corpo-piccolo">
                <strong>{testi.testoReclamo}:</strong> {r.testo}
              </p>
              {r.decisione_motivazione && (
                <p className="t-corpo-piccolo">
                  <strong>{testi.motivazioneDecisione}:</strong> {r.decisione_motivazione}
                </p>
              )}
              <label className="md-label" htmlFor={`mot-${r.id}`}>
                {testi.motivazione}
              </label>
              <textarea
                id={`mot-${r.id}`}
                className="md-textarea"
                rows={3}
                value={motivazione}
                onChange={(e) => setMotivazione(e.target.value)}
              />
              {errore && (
                <p className="t-errore" role="alert">
                  {errore}
                </p>
              )}
              <div className="md-azioni-riga">
                <button
                  type="button"
                  className="btn btn-principale btn-s"
                  onClick={() => inviaDecisione(false)}
                  aria-busy={decidi.isPending || undefined}
                >
                  {testi.conferma}
                </button>
                <button
                  type="button"
                  className="btn btn-secondario btn-s"
                  onClick={() => inviaDecisione(true)}
                  aria-busy={decidi.isPending || undefined}
                >
                  {testi.cambia}
                </button>
                <button
                  type="button"
                  className="btn btn-testo btn-s"
                  onClick={() => {
                    setAperta(false);
                    setMotivazione('');
                    setErrore('');
                  }}
                >
                  {messaggi.moderazione.comune.annulla}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
