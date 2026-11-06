'use client';

import { Lock, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Campo } from '@/components/ui/Campo';
import { Foglio } from '@/components/ui/Foglio';
import { Icona } from '@/components/ui/Icona';
import { MappaRitorno } from '@/components/ui/MappaRitorno';
import { dentroLimiti } from '@/components/ui/MappaPosizione';
import { Pillole } from '@/components/ui/Pillole';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento } from '@/components/ui/Stati';
import { useToast } from '@/components/ui/Toast';
import { useMontato } from '@/lib/connessione';
import { messaggi } from '@/lib/messaggi/it';
import type { Coordinate } from './api';
import { useAreeArrivo } from './dati';
import {
  aggiungiArea,
  eliminaArea,
  MASSIMO_AREE,
  RAGGI,
  RAGGIO_PREDEFINITO,
  type Raggio,
} from './dispositivo';
import { ErroreDiPosizione, posizioneAttuale } from './posizione';

const testi = messaggi.ritorno.aree;

/**
 * Aree di arrivo in Profilo › Privacy e dati (design/F-21-ritorno-sicuro §6): restano solo su
 * questo telefono, con un nome scelto da te e un raggio. Nessun indirizzo e nessuna ricerca per
 * via (R-32); il centro parte dalla posizione attuale e si sposta sulla mappa.
 */
export function AreeArrivo() {
  const montato = useMontato();
  const aree = useAreeArrivo();
  const mostraToast = useToast();
  const [foglio, setFoglio] = useState(false);
  if (!montato) return null;
  return (
    <>
      <p className="t-corpo-s m-0">{testi.spiegazione}</p>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="etichetta m-0">{testi.titolo}</h3>
        <span className="ck-mono t-didascalia c-2">{testi.conteggio(aree.length)}</span>
      </div>
      {aree.length === 0 ? (
        <p className="t-corpo-s c-2 m-0">{testi.vuoto}</p>
      ) : (
        <ul className="m-0 list-none p-0" aria-live="polite">
          {aree.map((area) => (
            <li key={area.id} className="rt-area">
              <span className="rt-area-ico" aria-hidden="true">
                <i />
              </span>
              <span className="min-w-0">
                <b>{area.nome}</b>
                <small>{testi.raggio(area.raggio)}</small>
              </span>
              <Pulsante
                variante="secondario"
                dimensione="s"
                aria-label={testi.eliminaArea(area.nome)}
                onClick={() => {
                  eliminaArea(area.id);
                  mostraToast({ testo: testi.eliminata(area.nome) });
                }}
              >
                {testi.elimina}
              </Pulsante>
            </li>
          ))}
        </ul>
      )}
      <Pulsante
        variante="secondario"
        pieno
        disabled={aree.length >= MASSIMO_AREE}
        onClick={() => setFoglio(true)}
      >
        <Icona icona={Plus} />
        {testi.aggiungi}
      </Pulsante>
      {aree.length >= MASSIMO_AREE && <p className="ck-motivo">{testi.limite}</p>}
      <p className="ck-motivo">
        <Icona icona={Trash2} dimensione="s" />
        {testi.cancellazione}
      </p>
      <Foglio aperto={foglio} onChiudi={() => setFoglio(false)} titolo={testi.nuova.titolo}>
        {foglio && <NuovaArea onChiudi={() => setFoglio(false)} />}
      </Foglio>
    </>
  );
}

function NuovaArea({ onChiudi }: { onChiudi: () => void }) {
  const mostraToast = useToast();
  const [centro, setCentro] = useState<Coordinate | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [raggio, setRaggio] = useState<Raggio>(RAGGIO_PREDEFINITO);
  const [cercando, setCercando] = useState(false);
  const [salvataggioFallito, setSalvataggioFallito] = useState(false);

  async function cerca() {
    setCercando(true);
    setErrore(null);
    try {
      const posizione = await posizioneAttuale();
      if (!dentroLimiti(posizione.lat, posizione.lon)) setErrore(testi.nuova.fuoriMappa);
      else setCentro(posizione);
    } catch (motivo) {
      const p = messaggi.ritorno.permessi;
      setErrore(
        motivo instanceof ErroreDiPosizione && motivo.motivo === 'negata'
          ? `${p.negata.avviso}. ${p.negata.avvisoTesto}`
          : `${p.spenta.avviso}. ${p.spenta.avvisoTesto}`,
      );
    } finally {
      setCercando(false);
    }
  }

  if (!centro) {
    return (
      <div className="flex flex-col gap-4">
        <p className="m-0">{testi.nuova.testo}</p>
        {cercando ? (
          <Caricamento descrizione={testi.nuova.cerco} righe={1} />
        ) : (
          <>
            {errore && <Avviso tipo="avviso">{errore}</Avviso>}
            <Pulsante variante="principale" pieno onClick={() => void cerca()}>
              {errore ? messaggi.comune.riprova : testi.aggiungi}
            </Pulsante>
          </>
        )}
      </div>
    );
  }

  const nomeValido = nome.trim().length > 0;
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault();
        if (!nomeValido) return;
        if (aggiungiArea({ nome, lat: centro.lat, lon: centro.lon, raggio })) {
          mostraToast({ testo: testi.nuova.salvata(nome.trim()) });
          onChiudi();
        } else {
          setSalvataggioFallito(true);
        }
      }}
    >
      <p className="m-0">{testi.nuova.testo}</p>
      <MappaRitorno
        lat={centro.lat}
        lon={centro.lon}
        raggio={raggio}
        etichetta={testi.nuova.mappa}
        onCambia={(lat, lon) => {
          if (dentroLimiti(lat, lon)) setCentro({ lat, lon, precisione: centro.precisione });
        }}
        area
      >
        <p className="rt-mappa-etichetta m-0">
          <b>{testi.nuova.centro}</b>
          <span>{testi.raggio(raggio)}</span>
        </p>
      </MappaRitorno>
      <Campo
        etichetta={testi.nuova.nome}
        value={nome}
        maxLength={30}
        placeholder={testi.nuova.segnapostoNome}
        aiuto={testi.nuova.aiutoNome}
        autoComplete="off"
        onChange={(evento) => setNome(evento.target.value)}
      />
      <Pillole<`${Raggio}`>
        etichetta={testi.nuova.raggio}
        opzioni={RAGGI.map((r) => ({ valore: `${r}`, etichetta: `${r} m` }))}
        valore={`${raggio}`}
        onCambia={(valore) => setRaggio(Number(valore) as Raggio)}
      />
      <p className="ck-motivo">
        <Icona icona={Lock} dimensione="s" />
        {testi.nuova.soloQui}
      </p>
      {salvataggioFallito && <Avviso tipo="errore">{testi.nuova.nonSalvata}</Avviso>}
      <div className="rt-due">
        <Pulsante variante="secondario" pieno onClick={onChiudi}>
          {testi.nuova.annulla}
        </Pulsante>
        <Pulsante variante="principale" pieno type="submit" disabled={!nomeValido}>
          {testi.nuova.salva}
        </Pulsante>
      </div>
    </form>
  );
}
