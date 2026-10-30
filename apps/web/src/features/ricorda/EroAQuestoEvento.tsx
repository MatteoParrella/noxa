'use client';

import { BookOpen, Check } from 'lucide-react';
import Link from 'next/link';
import { Icona } from '@/components/ui/Icona';
import { oggiARoma } from '@/lib/date';
import { messaggi } from '@/lib/messaggi/it';
import { useDiario } from './dati';

const testi = messaggi.ricorda.ero;
const due = (n: number) => String(n).padStart(2, '0');

/**
 * «Ero a questo evento» nel dettaglio di un evento passato (design/F-30-tracker §4): apre il
 * modulo del diario già compilato, oppure porta alla voce se la serata è già annotata.
 */
export function EroAQuestoEvento({ eventoId }: { eventoId: string }) {
  const diario = useDiario();
  const voce =
    diario.stato === 'pronto' ? diario.voci.find((v) => v.evento?.id === eventoId) : undefined;

  if (voce) {
    const annotata = oggiARoma(new Date(voce.creato_il));
    return (
      <section className="ri-ero" aria-labelledby="ero-titolo">
        <h2 className="ri-ero-titolo" id="ero-titolo">
          <Icona icona={Check} className="successo" />
          {testi.giaTitolo}
        </h2>
        <p className="t-corpo-s c-2 m-0">
          {testi.giaTesto(`${due(annotata.giorno)}.${due(annotata.mese)}`, voce.voto)}
        </p>
        <Link className="btn btn-secondario btn-pieno" href={`/ricorda/serata/?id=${voce.id}`}>
          {testi.apri}
        </Link>
      </section>
    );
  }

  return (
    <section className="ri-ero" aria-labelledby="ero-titolo">
      <h2 className="ri-ero-titolo" id="ero-titolo">
        <Icona icona={BookOpen} />
        {testi.titolo}
      </h2>
      <p className="t-corpo-s c-2 m-0">{testi.testo}</p>
      <Link className="btn btn-principale btn-pieno" href={`/ricorda/modifica/?evento=${eventoId}`}>
        {testi.azione}
      </Link>
    </section>
  );
}
