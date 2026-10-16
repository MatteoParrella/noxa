'use client';

import { useMutation } from '@tanstack/react-query';
import { Avviso } from '@/components/ui/Avviso';
import { Foglio } from '@/components/ui/Foglio';
import { Pulsante } from '@/components/ui/Pulsante';
import { messaggi } from '@/lib/messaggi/it';

type Props = {
  titolo: string;
  testo: string;
  conferma: string;
  pericolo?: boolean;
  onConferma: () => Promise<void>;
  onFatto: () => void;
  onChiudi: () => void;
};

/** Foglio di conferma per rimuovere, bloccare o sbloccare: "Annulla" ha lo stesso peso. */
export function FoglioConferma({
  titolo,
  testo,
  conferma,
  pericolo = false,
  onConferma,
  onFatto,
  onChiudi,
}: Props) {
  const azione = useMutation({ mutationFn: onConferma, onSuccess: onFatto });
  return (
    <Foglio aperto titolo={titolo} onChiudi={onChiudi}>
      <div className="flex flex-col gap-4">
        <p className="t-corpo c-2 m-0">{testo}</p>
        {azione.isError && <Avviso tipo="errore">{messaggi.amici.erroreAzione}</Avviso>}
        <div className="azioni-doppie">
          <Pulsante variante="secondario" onClick={onChiudi}>
            {messaggi.blocca.annulla}
          </Pulsante>
          <Pulsante
            variante={pericolo ? 'pericolo' : 'secondario'}
            caricamento={azione.isPending}
            disabled={azione.isPending}
            onClick={() => azione.mutate()}
          >
            {conferma}
          </Pulsante>
        </div>
      </div>
    </Foglio>
  );
}
