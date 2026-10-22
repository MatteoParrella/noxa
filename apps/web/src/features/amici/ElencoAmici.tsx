'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, QrCode, Search, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { Avviso } from '@/components/ui/Avviso';
import { Contatore } from '@/components/ui/Badge';
import { Icona } from '@/components/ui/Icona';
import { Entra } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { RigaPersona } from '@/components/ui/RigaPersona';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { useOnline } from '@/lib/connessione';
import { messaggi } from '@/lib/messaggi/it';
import { accettaRichiesta, eliminaAmicizia, type Relazione } from './api';
import { AzioniPersona } from './AzioniPersona';
import { CHIAVI, useAmici, useIo } from './dati';

const testi = messaggi.amici;

/** Pagina del profilo di una persona. */
export function percorsoPersona(id: string): string {
  return `/persona/?id=${encodeURIComponent(id)}`;
}

/** Amici e richieste (F-11, design/F-11-amici): nessun suggerimento, nessun contatore di amici. */
export function ElencoAmici() {
  const io = useIo();
  const online = useOnline();
  const amici = useAmici();
  const client = useQueryClient();

  const risposta = useMutation({
    mutationFn: ({ relazione, accetta }: { relazione: Relazione; accetta: boolean }) =>
      accetta ? accettaRichiesta(relazione.amiciziaId) : eliminaAmicizia(relazione.amiciziaId),
    onSettled: () => client.invalidateQueries({ queryKey: CHIAVI.relazioni }),
  });

  const azioniInAlto = (
    <div className="azioni-doppie">
      <Link className="btn btn-secondario" href="/amici/cerca/">
        <Icona icona={Search} />
        {testi.cerca}
      </Link>
      <Link className="btn btn-secondario" href="/amici/codice/">
        <Icona icona={QrCode} />
        {testi.mioCodice}
      </Link>
    </div>
  );

  if (!io || amici.isPending) {
    return (
      <div className="flex flex-col gap-5">
        {azioniInAlto}
        <Caricamento descrizione={testi.caricamento} />
      </div>
    );
  }

  if (amici.isError) {
    return (
      <div className="flex flex-col gap-5">
        {azioniInAlto}
        <ErroreConAzione
          titolo={testi.errore.titolo}
          onRiprova={() => void amici.refetch()}
          riprovaInCorso={amici.isFetching}
        >
          {testi.errore.testo}
        </ErroreConAzione>
      </div>
    );
  }

  const { amici: elenco, ricevute, inviate } = amici.data;
  const vuoto = elenco.length === 0 && ricevute.length === 0 && inviate.length === 0;

  return (
    <div className="flex flex-col gap-2">
      <Entra indice={1}>{azioniInAlto}</Entra>
      {!online && <Avviso tipo="info">{testi.offline}</Avviso>}
      {risposta.isError && <Avviso tipo="errore">{testi.erroreAzione}</Avviso>}

      {vuoto && (
        <ElencoVuoto icona={UserPlus} titolo={testi.vuoto.titolo}>
          {testi.vuoto.testo}
        </ElencoVuoto>
      )}

      {ricevute.length > 0 && (
        <Entra indice={2}>
          <section aria-labelledby="titolo-richieste">
            <div className="sezione-testa">
              <h2 className="etichetta m-0" id="titolo-richieste">
                {testi.richieste}
              </h2>
              <Contatore
                valore={ricevute.length}
                descrizione={messaggi.profilo.richieste(ricevute.length)}
              />
            </div>
            <ul className="m-0 list-none p-0">
              {ricevute.map((relazione) => (
                <RigaPersona
                  key={relazione.amiciziaId}
                  nome={relazione.persona.nome_visualizzato}
                  username={relazione.persona.username}
                  foto={relazione.persona.avatar_path}
                  href={percorsoPersona(relazione.persona.id)}
                  {...(relazione.canale === 'codice_invito'
                    ? { nota: testi.arrivataConCodice }
                    : {})}
                  azioniSotto
                  azioni={
                    relazione.canale === 'codice_invito' ? (
                      // Da codice: si decide dal profilo, dove compare l'eventuale avviso (R-12).
                      <Link
                        className="btn btn-s btn-secondario"
                        href={percorsoPersona(relazione.persona.id)}
                      >
                        {testi.vediProfilo}
                      </Link>
                    ) : (
                      <>
                        <Pulsante
                          variante="secondario"
                          dimensione="s"
                          disabled={!online || risposta.isPending}
                          onClick={() => risposta.mutate({ relazione, accetta: true })}
                        >
                          {testi.accetta}
                        </Pulsante>
                        <Pulsante
                          variante="secondario"
                          dimensione="s"
                          disabled={!online || risposta.isPending}
                          onClick={() => risposta.mutate({ relazione, accetta: false })}
                        >
                          {testi.rifiuta}
                        </Pulsante>
                      </>
                    )
                  }
                />
              ))}
            </ul>
          </section>
        </Entra>
      )}

      {inviate.length > 0 && (
        <Entra indice={3}>
          <section aria-labelledby="titolo-inviate">
            <div className="sezione-testa">
              <h2 className="etichetta m-0" id="titolo-inviate">
                {testi.inviate}
              </h2>
            </div>
            <ul className="m-0 list-none p-0">
              {inviate.map((relazione) => (
                <RigaPersona
                  key={relazione.amiciziaId}
                  nome={relazione.persona.nome_visualizzato}
                  username={relazione.persona.username}
                  foto={relazione.persona.avatar_path}
                  href={percorsoPersona(relazione.persona.id)}
                  azioni={
                    <>
                      <span className="inviata">
                        <Icona icona={Clock} dimensione="s" />
                        {testi.inAttesa}
                      </span>
                      <Pulsante
                        variante="testo"
                        dimensione="s"
                        disabled={!online || risposta.isPending}
                        onClick={() => risposta.mutate({ relazione, accetta: false })}
                      >
                        {testi.annulla}
                      </Pulsante>
                    </>
                  }
                />
              ))}
            </ul>
          </section>
        </Entra>
      )}

      {elenco.length > 0 && (
        <Entra indice={4}>
          <section aria-labelledby="titolo-amici">
            <div className="sezione-testa">
              <h2 className="etichetta m-0" id="titolo-amici">
                {testi.elenco}
              </h2>
            </div>
            <ul className="m-0 list-none p-0">
              {elenco.map((relazione) => (
                <RigaPersona
                  key={relazione.amiciziaId}
                  nome={relazione.persona.nome_visualizzato}
                  username={relazione.persona.username}
                  foto={relazione.persona.avatar_path}
                  href={percorsoPersona(relazione.persona.id)}
                  azioni={
                    <AzioniPersona
                      io={io}
                      persona={relazione.persona}
                      amiciziaId={relazione.amiciziaId}
                    />
                  }
                />
              ))}
            </ul>
          </section>
        </Entra>
      )}
    </div>
  );
}
