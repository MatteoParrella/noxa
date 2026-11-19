'use client';

import { ArrowRight, ChevronRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { useToast } from '@/components/ui/Toast';
import { useMontato, useOnline } from '@/lib/connessione';
import { ErroreValidazione, converti } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import type { VoceMostrata } from './coda';
import { useAggiornaRiepilogo, useRiepiloghi } from './dati-anno';
import { annoAggiornabile } from './Wrapped';

const testi = messaggi.ricorda.riepilogo;

const data = (iso: string) =>
  new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
    .format(new Date(iso))
    .replaceAll('/', '.');

/**
 * Tessera in cima al diario dal 1° dicembre al 31 gennaio (design/F-33-wrapped §1): apre il
 * riepilogo, propone di crearlo se mancano solo le serate aggiunte dopo, oppure invita al
 * diario se le serate sono meno di 3. Negli altri mesi non c'è.
 */
export function TesseraAnno({ voci }: { voci: readonly VoceMostrata[] }) {
  const montato = useMontato();
  const riepiloghi = useRiepiloghi();
  const aggiorna = useAggiornaRiepilogo();
  const online = useOnline();
  const mostraToast = useToast();
  const anno = montato ? annoAggiornabile() : null;
  if (anno === null || !riepiloghi.data) return null;

  const riepilogo = riepiloghi.data.find((r) => r.anno === anno);
  if (riepilogo) {
    return (
      <Link className="ri-tessera-anno" href={`/ricorda/wrapped/?anno=${anno}`}>
        <span className="ri-tessera-anno-sfondo" aria-hidden="true">
          {anno}
        </span>
        <span className="ri-tessera-anno-sopra">{testi.tessera.sopra}</span>
        <b>{testi.tessera.pronto(anno)}</b>
        <small>
          {testi.tessera.riassunto(riepilogo.dati.serate, riepilogo.dati.locali_diversi)}
        </small>
        <span className="ri-tessera-anno-azione" aria-hidden="true">
          {testi.tessera.guarda}
          <Icona icona={ArrowRight} dimensione="s" />
        </span>
      </Link>
    );
  }

  const serate = voci.filter((v) => v.data_serata.startsWith(`${anno}-`)).length;
  if (serate >= 3) {
    return (
      <div className="ri-tessera-anno is-quasi">
        <span className="ri-tessera-anno-sopra">
          {testi.tessera.sopra} · {anno}
        </span>
        <small>{testi.tessera.daCreare(anno)}</small>
        <Pulsante
          variante="secondario"
          dimensione="s"
          disabled={!online || aggiorna.isPending}
          caricamento={aggiorna.isPending}
          onClick={() =>
            aggiorna.mutate(undefined, {
              onError: (errore) => {
                const dominio = converti(errore);
                mostraToast({
                  testo:
                    dominio instanceof ErroreValidazione &&
                    dominio.codice === 'riepilogo_gia_aggiornato'
                      ? testi.domani
                      : testi.erroreAggiorna,
                });
              },
            })
          }
        >
          <Icona icona={Sparkles} dimensione="s" />
          {testi.tessera.crea}
        </Pulsante>
      </div>
    );
  }
  return (
    <div className="ri-tessera-anno is-quasi">
      <span className="ri-tessera-anno-sopra">
        {testi.tessera.sopra} · {anno}
      </span>
      <small>{testi.tessera.quasiVuoto}</small>
    </div>
  );
}

/** Collegamento all'elenco dei riepiloghi, in fondo al diario, solo se ce n'è almeno uno. */
export function LinkRiepiloghi() {
  const riepiloghi = useRiepiloghi();
  if (!riepiloghi.data || riepiloghi.data.length === 0) return null;
  return (
    <Link className="ri-link-riepiloghi" href="/ricorda/riepiloghi/">
      <Icona icona={Sparkles} />
      {testi.elenco.apri}
      <Icona icona={ChevronRight} dimensione="s" />
    </Link>
  );
}

/** Ricorda › I tuoi riepiloghi (design/F-33-wrapped §3, anni passati). */
export function ElencoRiepiloghi() {
  const riepiloghi = useRiepiloghi();
  if (!riepiloghi.data) {
    if (riepiloghi.isError) {
      return (
        <ErroreConAzione
          titolo={testi.errore.titolo}
          onRiprova={() => void riepiloghi.refetch()}
          riprovaInCorso={riepiloghi.isFetching}
        >
          {testi.errore.testo}
        </ErroreConAzione>
      );
    }
    return <Caricamento descrizione={testi.caricamento} righe={2} />;
  }
  if (riepiloghi.data.length === 0) {
    return (
      <ElencoVuoto icona={Sparkles} titolo={testi.elenco.vuoto.titolo}>
        {testi.elenco.vuoto.testo}
      </ElencoVuoto>
    );
  }
  return (
    <div>
      <ul className="m-0 list-none p-0">
        {riepiloghi.data.map((r) => (
          <li key={r.anno}>
            <Link className="ri-riga-anno" href={`/ricorda/wrapped/?anno=${r.anno}`}>
              <span className="ri-riga-anno-numero">{r.anno}</span>
              <span className="flex flex-col">
                {testi.elenco.voce(r.dati.serate, r.dati.locali_diversi)}
                <small>{testi.elenco.aggiornato(data(r.generato_il))}</small>
              </span>
              <Icona icona={ChevronRight} dimensione="s" />
            </Link>
          </li>
        ))}
      </ul>
      <p className="ri-st-nota">{testi.elenco.nota}</p>
    </div>
  );
}
