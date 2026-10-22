'use client';

import { Image as ImageIcon, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Avviso } from '@/components/ui/Avviso';
import { Entra } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { useSessione } from '@/features/account/sessione';
import { messaggi } from '@/lib/messaggi/it';
import { caricaFlyer } from './api-flyer';

const testi = messaggi.scopri.caricaFlyer;

const TIPI_ACCETTATI = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 10 * 1024 * 1024;

function erroreLeggibile(err: unknown): string {
  if (err instanceof Error && 'codice' in err) {
    const codice = (err as { codice: string }).codice;
    if (codice === 'tipo_non_valido') return testi.errori.tipoNonValido;
    if (codice === 'troppo_grande') return testi.errori.troppoGrande;
  }
  if (
    err instanceof Error &&
    'codice' in err &&
    (err as { codice: string }).codice === 'troppi_caricamenti_oggi'
  )
    return testi.errori.troppiOggi;
  return testi.errori.generico;
}

/** Caricamento di un flyer: selezione, anteprima senza EXIF, upload (F-06, R-54). */
export function CaricaFlyer() {
  const sessione = useSessione();
  const utenteId = sessione.stato === 'presente' ? sessione.utenteId : null;

  const inputRef = useRef<HTMLInputElement>(null);
  const [anteprima, setAnteprima] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [erroreFile, setErroreFile] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: () => {
      if (!utenteId || !file) throw new Error('dati mancanti');
      return caricaFlyer(utenteId, file);
    },
  });

  function onSeleziona(e: React.ChangeEvent<HTMLInputElement>) {
    const selezionato = e.target.files?.[0] ?? null;
    setErroreFile(null);
    setAnteprima(null);
    setFile(null);
    upload.reset();
    if (!selezionato) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selezionato.type)) {
      setErroreFile(testi.errori.tipoNonValido);
      return;
    }
    if (selezionato.size > MAX_BYTES) {
      setErroreFile(testi.errori.troppoGrande);
      return;
    }
    setFile(selezionato);
    setAnteprima(URL.createObjectURL(selezionato));
  }

  if (upload.isSuccess) {
    return (
      <Entra>
        <div className="stato-vuoto">
          <div className="cornice-icona cornice-icona-successo">
            <Upload aria-hidden="true" className="ico ico-l" strokeWidth={1.75} />
          </div>
          <h2 className="t-titolo-3 m-0">{testi.successo.titolo}</h2>
          <p className="c-2 m-0 text-center">{testi.successo.testo}</p>
          <Link href="/scopri/miei-flyer/" className="btn btn-principale">
            {testi.successo.azione}
          </Link>
        </div>
      </Entra>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="c-2 m-0">{testi.descrizione}</p>

      {/* Input file nascosto */}
      <input
        ref={inputRef}
        type="file"
        accept={TIPI_ACCETTATI}
        className="sr-only"
        aria-label={testi.seleziona}
        onChange={onSeleziona}
      />

      {/* Anteprima o selettore */}
      {anteprima ? (
        <div className="flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={anteprima}
            alt="Anteprima del flyer selezionato"
            className="w-full rounded-3 object-contain max-h-80 bg-superficie-2"
          />
          <Pulsante variante="secondario" dimensione="s" onClick={() => inputRef.current?.click()}>
            <ImageIcon aria-hidden="true" className="ico ico-s" strokeWidth={1.75} />
            {testi.cambia}
          </Pulsante>
        </div>
      ) : (
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-3 rounded-3 border-2 border-dashed border-linea-forte p-8 transition-colors hover:border-accento hover:bg-accento-tenue"
          onClick={() => inputRef.current?.click()}
          aria-label={testi.seleziona}
        >
          <ImageIcon aria-hidden="true" className="ico ico-l c-3" strokeWidth={1.75} />
          <span className="t-corpo-piccolo c-2">{testi.seleziona}</span>
        </button>
      )}

      {erroreFile && <Avviso tipo="errore">{erroreFile}</Avviso>}

      {upload.isError && <Avviso tipo="errore">{erroreLeggibile(upload.error)}</Avviso>}

      <p className="t-didascalia c-3 m-0">{testi.note}</p>

      <Pulsante
        variante="principale"
        disabled={!file || upload.isPending}
        onClick={() => upload.mutate()}
      >
        {upload.isPending ? testi.caricamento : testi.carica}
      </Pulsante>
    </div>
  );
}
