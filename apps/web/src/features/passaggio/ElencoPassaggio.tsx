'use client';

import { Bus, CarTaxiFront, ExternalLink, Phone, Smartphone, type LucideIcon } from 'lucide-react';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento } from '@/components/ui/Stati';
import { useOnline } from '@/lib/connessione';
import { messaggi } from '@/lib/messaggi/it';
import type { ServizioTrasporto, TipoServizio } from './api';
import { useServiziTrasporto } from './dati';
import { numeroLeggibile, perTipo, ultimaVerifica } from './formato';

const testi = messaggi.passaggio;

const ICONE: Record<TipoServizio, LucideIcon> = {
  mezzi_pubblici: Bus,
  taxi: CarTaxiFront,
  app_trasporto: Smartphone,
};

/**
 * Elenco di «Non hai un passaggio?» (F-23): mezzi notturni, radiotaxi da chiamare e app di
 * trasporto. Solo link e numeri: Noxa non manda a nessuno posizione o destinazione (R-32) e
 * non ha accordi con i servizi elencati (R-61). Le voci arrivano già filtrate per età (R-04).
 */
export function ElencoPassaggio() {
  const servizi = useServiziTrasporto();
  const online = useOnline();

  if (servizi.isPending) {
    return <Caricamento descrizione={testi.caricamento} righe={3} />;
  }
  if (servizi.isError) {
    return (
      <div className="ps-stato" role="alert">
        <p>{online ? testi.errore : testi.offline}</p>
        <Pulsante
          variante="secondario"
          dimensione="s"
          caricamento={servizi.isFetching}
          onClick={() => void servizi.refetch()}
        >
          {messaggi.comune.riprova}
        </Pulsante>
      </div>
    );
  }
  if (servizi.data.length === 0) {
    return (
      <p className="ps-stato" role="status">
        {testi.vuoto}
      </p>
    );
  }

  const verifica = ultimaVerifica(servizi.data);
  return (
    <div className="ps-elenco">
      {perTipo(servizi.data).map(({ tipo, voci }) => (
        <section key={tipo} aria-labelledby={`ps-${tipo}`}>
          <h4 className="ps-tipo" id={`ps-${tipo}`}>
            <Icona icona={ICONE[tipo]} dimensione="s" />
            {testi.tipi[tipo]}
          </h4>
          <ul className="m-0 list-none p-0">
            {voci.map((voce) => (
              <li key={voce.id}>
                <Voce voce={voce} online={online} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="ps-nota">
        {testi.nota}
        {verifica ? ` ${testi.verificato(verifica)}` : ''}
      </p>
    </div>
  );
}

function Voce({ voce, online }: { voce: ServizioTrasporto; online: boolean }) {
  const testo = (
    <span className="ps-testo">
      <b>{voce.nome}</b>
      <span>
        {testi.zone[voce.zona]}
        {voce.nota ? ` · ${voce.nota}` : ''}
      </span>
    </span>
  );
  // Un numero si chiama anche senza rete; un link no.
  if (voce.telefono) {
    return (
      <div className="ps-voce">
        {testo}
        <a
          className="btn btn-secondario btn-s ps-azione"
          href={`tel:${voce.telefono}`}
          aria-label={testi.chiamaNome(voce.nome, numeroLeggibile(voce.telefono))}
        >
          <Icona icona={Phone} dimensione="s" />
          {testi.chiama(numeroLeggibile(voce.telefono))}
        </a>
      </div>
    );
  }
  if (!voce.url) return null;
  return (
    <div className="ps-voce">
      {testo}
      {online ? (
        <a
          className="btn btn-secondario btn-s ps-azione"
          href={voce.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={testi.apriNome(voce.nome)}
        >
          {voce.tipo === 'app_trasporto' ? testi.apriApp : testi.apriOrari}
          <Icona icona={ExternalLink} dimensione="s" />
        </a>
      ) : (
        <span className="ps-spento">{testi.serveRete}</span>
      )}
    </div>
  );
}
