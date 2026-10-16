'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Campo } from '@/components/ui/Campo';
import { Pulsante } from '@/components/ui/Pulsante';
import { registraErrore } from '@/lib/registro';
import { messaggi } from '@/lib/messaggi/it';

const testi = messaggi.scansione;

type RilevatoreCodici = {
  detect: (sorgente: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
};
type CostruttoreRilevatore = new (opzioni: { formats: string[] }) => RilevatoreCodici;

function rilevatore(): CostruttoreRilevatore | null {
  const candidato = (window as unknown as { BarcodeDetector?: CostruttoreRilevatore })
    .BarcodeDetector;
  return candidato ?? null;
}

/** Dal contenuto del QR (il link d'invito) o dal testo scritto ricava il codice. */
export function estraiCodice(testo: string): string | null {
  const pulito = testo.trim();
  try {
    const indirizzo = new URL(pulito);
    const daLink = indirizzo.searchParams.get('c');
    if (daLink) return estraiCodice(daLink);
  } catch {
    // Non è un link: si tratta come codice scritto.
  }
  const codice = pulito.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return codice.length === 10 ? codice : null;
}

type StatoFotocamera = 'avvio' | 'attiva' | 'senza_permesso';

const nessunaIscrizione = () => () => undefined;

/** Scansione del QR di chi è con te; se la fotocamera non c'è o non è permessa, si scrive. */
export function ScansionaCodice() {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  // Lettura dei QR disponibile nel browser (BarcodeDetector); nel prerender non lo è.
  const supportata = useSyncExternalStore(
    nessunaIscrizione,
    () => Boolean(rilevatore() && navigator.mediaDevices),
    () => false,
  );
  const [stato, setStato] = useState<StatoFotocamera>('avvio');
  const [scritto, setScritto] = useState('');
  const [errore, setErrore] = useState<string | null>(null);

  const apri = (codice: string) => router.push(`/amici/invito/?c=${encodeURIComponent(codice)}`);

  useEffect(() => {
    const Costruttore = rilevatore();
    if (!Costruttore || !navigator.mediaDevices) return;
    let flusso: MediaStream | null = null;
    let timer: number | undefined;
    let fermo = false;
    const lettore = new Costruttore({ formats: ['qr_code'] });

    const cerca = async () => {
      if (fermo || !video.current) return;
      try {
        const trovati = await lettore.detect(video.current);
        const codice = trovati.map((voce) => estraiCodice(voce.rawValue)).find(Boolean);
        if (codice) {
          fermo = true;
          router.push(`/amici/invito/?c=${encodeURIComponent(codice)}`);
          return;
        }
      } catch (motivo) {
        registraErrore('lettura del QR', motivo);
      }
      timer = window.setTimeout(() => void cerca(), 300);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((ottenuto) => {
        if (fermo) {
          ottenuto.getTracks().forEach((traccia) => traccia.stop());
          return;
        }
        flusso = ottenuto;
        if (video.current) {
          video.current.srcObject = ottenuto;
          void video.current.play();
        }
        setStato('attiva');
        void cerca();
      })
      .catch(() => setStato('senza_permesso'));

    return () => {
      fermo = true;
      window.clearTimeout(timer);
      flusso?.getTracks().forEach((traccia) => traccia.stop());
    };
  }, [router]);

  const invia = (evento: FormEvent) => {
    evento.preventDefault();
    const codice = estraiCodice(scritto);
    if (!codice) {
      setErrore(testi.formato);
      return;
    }
    apri(codice);
  };

  return (
    <div className="flex flex-col gap-5">
      {supportata && (stato === 'avvio' || stato === 'attiva') && (
        <div className="mirino">
          <video ref={video} muted playsInline aria-hidden="true" />
          <div className="mirino-riquadro" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
          <p className="mirino-testo" role="status">
            {testi.inquadra}
          </p>
        </div>
      )}
      {supportata && stato === 'senza_permesso' && (
        <Avviso tipo="info">{testi.senzaPermesso}</Avviso>
      )}
      {!supportata && <Avviso tipo="info">{testi.nonSupportata}</Avviso>}
      <form noValidate onSubmit={invia} className="flex flex-col gap-3">
        <Campo
          etichetta={testi.scrivi}
          className="campo-codice"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          placeholder="K7Q4-M2XP-9H"
          maxLength={14}
          value={scritto}
          onChange={(evento) => {
            setScritto(evento.target.value);
            setErrore(null);
          }}
          {...(errore ? { errore } : {})}
        />
        <Pulsante variante="principale" type="submit" pieno>
          {testi.continua}
        </Pulsante>
      </form>
    </div>
  );
}
