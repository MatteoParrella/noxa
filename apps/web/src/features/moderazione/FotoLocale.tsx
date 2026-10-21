'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, ImageUp } from 'lucide-react';
import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Campo } from '@/components/ui/Campo';
import { DialogoMotivazione } from '@/components/ui/DialogoMotivazione';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { classi } from '@/lib/classi';
import { messaggi } from '@/lib/messaggi/it';
import {
  caricaFotoLocale,
  rimuoviFotoLocale,
  salvaFotoLocale,
  type FonteImmagine,
  type Locale,
} from './api';
import { CHIAVI, useFotoFirmate } from './dati';
import { dataOra, testoErrore } from './formato';
import { ErroreFoto, TIPI_AMMESSI, convertiFoto, peso, type FotoConvertita } from './fotoLocale';

const testi = messaggi.moderazione;
const f = testi.foto;
const FONTI: FonteImmagine[] = ['autorizzazione_locale', 'noxa', 'licenza_libera'];

type Scelta = { file: File; foto: FotoConvertita; anteprima: string };

/**
 * Foto del locale (ADR-0018, R-56): una sola foto, caricata da un moderatore con la fonte
 * lecita e le due conferme sul contenuto; il caricamento resta nel registro.
 */
export function FotoLocale({ locale }: { locale: Locale }) {
  const id = useId();
  const client = useQueryClient();
  const inputFile = useRef<HTMLInputElement>(null);
  const [scelta, setScelta] = useState<Scelta | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  const [sopra, setSopra] = useState(false);
  const [fonte, setFonte] = useState<FonteImmagine>('autorizzazione_locale');
  const [riferimento, setRiferimento] = useState('');
  const [attribuzione, setAttribuzione] = useState('');
  const [senzaPersone, setSenzaPersone] = useState(false);
  const [senzaAlcol, setSenzaAlcol] = useState(false);
  const [mancanti, setMancanti] = useState<string | null>(null);
  const [avanzamento, setAvanzamento] = useState(0);
  const [rimozione, setRimozione] = useState(false);
  const [fatto, setFatto] = useState<string | null>(null);
  const firmata = useFotoFirmate(locale.immagine_path ? [locale.immagine_path] : []);
  const urlAttuale = locale.immagine_path ? firmata.data?.[locale.immagine_path] : undefined;

  useEffect(
    () => () => {
      if (scelta) URL.revokeObjectURL(scelta.anteprima);
    },
    [scelta],
  );

  async function scegli(file: File | undefined) {
    setProblema(null);
    setFatto(null);
    if (!file) return;
    try {
      const foto = await convertiFoto(file);
      setScelta({ file, foto, anteprima: URL.createObjectURL(foto.blob) });
    } catch (errore) {
      setScelta(null);
      setProblema(
        errore instanceof ErroreFoto && errore.motivo === 'formato'
          ? f.formatoNonValido(file.name)
          : f.illeggibile,
      );
    }
  }

  const salvataggio = useMutation({
    mutationFn: async (foto: FotoConvertita) => {
      setAvanzamento(40);
      const percorso = await caricaFotoLocale(locale.id, foto.blob);
      setAvanzamento(80);
      await salvaFotoLocale(locale.id, percorso, {
        fonte,
        attribuzione,
        riferimento,
        senzaPersone,
        senzaAlcol,
      });
      setAvanzamento(100);
    },
    onSuccess: () => {
      setScelta(null);
      setFatto(f.salvata);
      void client.invalidateQueries({ queryKey: CHIAVI.tutto });
    },
    onSettled: () => setAvanzamento(0),
  });

  function salva() {
    if (!scelta) return;
    if (fonte === 'autorizzazione_locale' && !riferimento.trim())
      return setMancanti(f.erroreRiferimento);
    if (fonte === 'licenza_libera' && !attribuzione.trim())
      return setMancanti(f.erroreAttribuzione);
    if (!senzaPersone || !senzaAlcol) return setMancanti(f.erroreConferme);
    setMancanti(null);
    salvataggio.mutate(scelta.foto);
  }

  function rilascia(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault();
    setSopra(false);
    void scegli(evento.dataTransfer.files[0]);
  }

  const anteprima = scelta?.anteprima ?? urlAttuale;
  const mostraModulo = scelta !== null;

  return (
    <section className="md-sezione" aria-labelledby={`${id}-titolo`}>
      <h2 id={`${id}-titolo`} className="etichetta-riga">
        {f.titolo}
      </h2>
      {fatto && (
        <div className="conferma-riga" role="status">
          <Icona icona={CircleCheck} dimensione="s" />
          {fatto}
        </div>
      )}

      {anteprima ? (
        <div className="anteprima-1610">
          {/* eslint-disable-next-line @next/next/no-img-element -- anteprima locale o URL firmato */}
          <img src={anteprima} alt="" />
          <span className="velatura" aria-hidden="true" />
          <span className="etichetta">{scelta ? f.ritaglio : f.anteprima}</span>
          <b className="t-titolo-3">{locale.nome}</b>
        </div>
      ) : (
        <p className="guida">{f.nessuna}</p>
      )}

      {(!locale.immagine_path || mostraModulo) && (
        <div
          className={classi('carica', sopra && 'is-sopra')}
          onDragOver={(evento) => {
            evento.preventDefault();
            setSopra(true);
          }}
          onDragLeave={() => setSopra(false)}
          onDrop={rilascia}
        >
          <Icona icona={ImageUp} />
          <span>
            <b>{f.trascina}</b> {f.oppure}{' '}
            <button
              type="button"
              className="link-accesso is-in-linea"
              onClick={() => inputFile.current?.click()}
            >
              {f.scegli}
            </button>
          </span>
          <span>{f.formati}</span>
          <input
            ref={inputFile}
            type="file"
            accept={TIPI_AMMESSI.join(',')}
            className="sr-only"
            tabIndex={-1}
            aria-label={f.scegli}
            onChange={(evento) => {
              void scegli(evento.target.files?.[0]);
              evento.target.value = '';
            }}
          />
        </div>
      )}
      {problema && (
        <Avviso tipo="errore" portaInVista>
          {problema}
        </Avviso>
      )}
      {scelta?.foto.pesoPrimaDellaRiduzione && (
        <Avviso tipo="info" titolo={f.ridotta.titolo}>
          {f.ridotta.testo(peso(scelta.foto.pesoPrimaDellaRiduzione), peso(scelta.foto.blob.size))}
        </Avviso>
      )}

      {mostraModulo && (
        <div className="flex flex-col gap-3">
          <fieldset className="m-0 flex flex-col border-0 p-0">
            <legend className="campo-etichetta pb-1">{f.fonte}</legend>
            {FONTI.map((valore) => (
              <label key={valore} className="scelta-riga">
                <input
                  type="radio"
                  name={`${id}-fonte`}
                  checked={fonte === valore}
                  onChange={() => setFonte(valore)}
                />
                <span>{f.fonti[valore]}</span>
              </label>
            ))}
          </fieldset>
          {fonte === 'autorizzazione_locale' && (
            <Campo
              etichetta={f.riferimento}
              aiuto={f.riferimentoAiuto}
              value={riferimento}
              maxLength={200}
              onChange={(evento) => setRiferimento(evento.target.value)}
            />
          )}
          {fonte === 'licenza_libera' && (
            <Campo
              etichetta={f.attribuzione}
              aiuto={f.attribuzioneAiuto}
              value={attribuzione}
              maxLength={200}
              onChange={(evento) => setAttribuzione(evento.target.value)}
            />
          )}
          <fieldset className="m-0 flex flex-col border-0 p-0">
            <legend className="campo-etichetta pb-1">{f.conferme}</legend>
            <label className="scelta-riga">
              <input
                type="checkbox"
                checked={senzaPersone}
                onChange={(e) => setSenzaPersone(e.target.checked)}
              />
              <span>{f.senzaPersone}</span>
            </label>
            <label className="scelta-riga">
              <input
                type="checkbox"
                checked={senzaAlcol}
                onChange={(e) => setSenzaAlcol(e.target.checked)}
              />
              <span>{f.senzaAlcol}</span>
            </label>
          </fieldset>
          {mancanti && (
            <Avviso tipo="errore" portaInVista>
              {mancanti}
            </Avviso>
          )}
          {salvataggio.isError && (
            <Avviso tipo="errore" portaInVista>
              {testoErrore(salvataggio.error)}
            </Avviso>
          )}
          {salvataggio.isPending && (
            <div className="flex flex-col gap-1" role="status">
              <span className="guida">{f.caricamento(avanzamento)}</span>
              <div className="barra-avanz" aria-hidden="true">
                <i style={{ width: `${avanzamento}%` }} />
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Pulsante variante="principale" caricamento={salvataggio.isPending} onClick={salva}>
              {f.salva}
            </Pulsante>
            <Pulsante variante="secondario" onClick={() => setScelta(null)}>
              {testi.comune.annulla}
            </Pulsante>
          </div>
        </div>
      )}

      {locale.immagine_path && !mostraModulo && (
        <>
          <div>
            <div className="riga-dato">
              <span className="lbl">{f.fonte.replace(' (obbligatoria)', '')}</span>
              <span>
                {locale.immagine_fonte ? f.fonti[locale.immagine_fonte] : ''}
                {locale.immagine_riferimento && (
                  <span className="t-mono-dato c-2"> · {locale.immagine_riferimento}</span>
                )}
                {locale.immagine_attribuzione && (
                  <span className="c-2"> · {locale.immagine_attribuzione}</span>
                )}
              </span>
              <span />
            </div>
            <div className="riga-dato">
              <span className="lbl">{f.approvata}</span>
              <span className="t-mono-dato">
                {f.approvataDa(
                  locale.immagine_approvata_da ?? testi.comune.sistema,
                  locale.immagine_approvata_il ? dataOra(locale.immagine_approvata_il) : '',
                )}
              </span>
              <span />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pulsante variante="secondario" onClick={() => inputFile.current?.click()}>
              {f.sostituisci}
            </Pulsante>
            <Pulsante variante="pericolo" onClick={() => setRimozione(true)}>
              {f.rimuovi}
            </Pulsante>
          </div>
          <input
            ref={inputFile}
            type="file"
            accept={TIPI_AMMESSI.join(',')}
            className="sr-only"
            tabIndex={-1}
            aria-label={f.sostituisci}
            onChange={(evento) => {
              void scegli(evento.target.files?.[0]);
              evento.target.value = '';
            }}
          />
        </>
      )}

      <DialogoMotivazione
        aperto={rimozione}
        onChiudi={() => setRimozione(false)}
        titolo={f.rimuoviTitolo(locale.nome)}
        sopratitolo={f.titolo}
        effetto={f.rimuoviEffetto}
        etichettaMotivazione={testi.comune.motivazione}
        aiutoMotivazione={testi.comune.restaNelRegistro}
        erroreMotivazioneMancante={testi.comune.motivazioneMancante}
        etichettaConferma={f.rimuoviAzione}
        etichettaAnnulla={testi.comune.annulla}
        variante="pericolo"
        testoErrore={testoErrore}
        onConferma={async (motivazione) => {
          await rimuoviFotoLocale(locale.id, motivazione);
          setRimozione(false);
          setFatto(f.rimossa);
          await client.invalidateQueries({ queryKey: CHIAVI.tutto });
        }}
      />
    </section>
  );
}
