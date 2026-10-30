'use client';

import { BookOpen, ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { z } from 'zod';
import { Avatar } from '@/components/ui/Avatar';
import { Avviso } from '@/components/ui/Avviso';
import { Foglio } from '@/components/ui/Foglio';
import { Icona } from '@/components/ui/Icona';
import { MenuAzioni } from '@/components/ui/MenuAzioni';
import { TitoloRivelato } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { useToast } from '@/components/ui/Toast';
import { messaggi } from '@/lib/messaggi/it';
import type { VoceMostrata } from './coda';
import { useEliminaSerata, useVoce } from './dati';
import { EtichettaPrivato } from './Diario';
import { dataLunga, dataMedia, euro, luogoVoce, titoloVoce, totaleSpese } from './formato';

const testi = messaggi.ricorda;

const ora = (iso: string) =>
  new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

/** Dettaglio di una serata del diario (design/F-30-tracker §3): solo per te. */
export function DettaglioVoce() {
  const grezzo = useSearchParams().get('id');
  const id = z.uuid().safeParse(grezzo).success ? grezzo : null;
  const stato = useVoce(id);

  if (stato.stato === 'caricamento')
    return <Caricamento descrizione={testi.dettaglio.caricamento} />;
  if (stato.stato === 'errore') {
    return (
      <ErroreConAzione
        titolo={testi.area.errore.titolo}
        onRiprova={stato.riprova}
        riprovaInCorso={stato.inCorso}
      >
        {testi.area.errore.testo}
      </ErroreConAzione>
    );
  }
  if (stato.stato !== 'voce' || !stato.voce) {
    const t = testi.dettaglio.nonTrovata;
    return (
      <ElencoVuoto
        icona={BookOpen}
        titolo={t.titolo}
        azione={
          <Link className="btn btn-secondario btn-s" href="/ricorda/">
            {t.torna}
          </Link>
        }
      >
        {t.testo}
      </ElencoVuoto>
    );
  }
  return <Dettaglio voce={stato.voce} />;
}

function Dettaglio({ voce }: { voce: VoceMostrata }) {
  const router = useRouter();
  const [conferma, setConferma] = useState(false);
  const elimina = useEliminaSerata();
  const mostraToast = useToast();
  const titolo = titoloVoce(voce);
  const luogo = luogoVoce(voce);
  const totale = totaleSpese(voce.spese);
  const quale = `${dataMedia(voce.data_serata)} · ${titolo}`.replace(/ · $/, '');

  return (
    <article className="flex flex-col">
      <div className="ri-testa-barra pb-3">
        <Link className="btn btn-testo btn-s -ml-3" href="/ricorda/">
          <Icona icona={ChevronLeft} dimensione="s" />
          {testi.dettaglio.torna}
        </Link>
        <div>
          <EtichettaPrivato />
          <MenuAzioni
            etichetta={testi.dettaglio.menu}
            titolo={quale}
            voci={[
              {
                etichetta: testi.dettaglio.modifica,
                icona: <Icona icona={Pencil} />,
                onScegli: () => router.push(`/ricorda/modifica/?id=${voce.id}`),
              },
              {
                etichetta: testi.dettaglio.elimina,
                icona: <Icona icona={Trash2} />,
                pericolo: true,
                onScegli: () => setConferma(true),
              },
            ]}
          />
        </div>
      </div>

      <header className="ri-testa">
        <span className="ri-dt-data">{dataLunga(voce.data_serata)}</span>
        <TitoloRivelato testo={titolo} className="t-display m-0" />
        {(luogo || voce.evento) && (
          <p className="t-corpo-s c-2 m-0">
            {luogo}
            {voce.evento && (
              <>
                {luogo ? ' · ' : ''}
                <Link className="link" href={`/evento/?id=${voce.evento.id}`}>
                  {testi.dettaglio.vediEvento}
                </Link>
              </>
            )}
          </p>
        )}
        {voce.voto !== null && (
          <p className="ri-dt-voto m-0">
            <b aria-hidden="true">{voce.voto}</b>
            <span aria-hidden="true">/5</span>
            <span className="sr-only">{testi.area.votoLettura(voce.voto)}</span>
          </p>
        )}
      </header>

      {voce.stato !== 'sincronizzata' && (
        <Avviso
          tipo={voce.stato === 'errore' ? 'errore' : 'avviso'}
          titolo={testi.sincronizzazione.titolo}
        >
          {voce.stato === 'errore'
            ? testi.sincronizzazione.motivoErrore
            : testi.sincronizzazione.motivoOffline(ora(voce.modificata_il ?? voce.aggiornato_il))}
        </Avviso>
      )}

      {(voce.amici.length > 0 || voce.amici_altri > 0) && (
        <section className="ri-dt-sez" aria-labelledby="dt-con-chi">
          <h2 className="etichetta-riga etichetta m-0" id="dt-con-chi">
            {testi.dettaglio.conChi}
          </h2>
          <ul className="m-0 list-none p-0">
            {voce.amici.map((amico) => (
              <li key={amico.id} className="riga-persona">
                <Avatar nome={amico.nome_visualizzato} foto={amico.avatar_path} decorativo />
                <span className="min-w-0">
                  <span className="sel-nome">{amico.nome_visualizzato}</span>
                  <span className="sel-username">@{amico.username}</span>
                </span>
              </li>
            ))}
          </ul>
          {voce.amici_altri > 0 && (
            <p className="t-corpo-s c-2 m-0">{testi.dettaglio.altri(voce.amici_altri)}</p>
          )}
        </section>
      )}

      {voce.spese.length > 0 && (
        <section className="ri-dt-sez" aria-labelledby="dt-spese">
          <h2 className="etichetta-riga etichetta m-0" id="dt-spese">
            {testi.dettaglio.spese}
          </h2>
          <dl className="m-0">
            {voce.spese.map((spesa) => (
              <div key={spesa.categoria} className="ri-dt-spesa">
                <dt>{testi.categorie[spesa.categoria]}</dt>
                <dd className="mono m-0">{euro(spesa.importo_centesimi)}</dd>
              </div>
            ))}
            <div className="ri-dt-spesa totale">
              <dt>{testi.modulo.totale}</dt>
              <dd className="mono m-0">{euro(totale)}</dd>
            </div>
          </dl>
        </section>
      )}

      {voce.dj.length > 0 && (
        <section className="ri-dt-sez" aria-labelledby="dt-musica">
          <h2 className="etichetta-riga etichetta m-0" id="dt-musica">
            {testi.dettaglio.musica}
          </h2>
          <ul className="ri-etichette">
            {voce.dj.map((nome) => (
              <li key={nome} className="ri-etichetta sola">
                {nome}
              </li>
            ))}
          </ul>
        </section>
      )}

      {voce.note && (
        <section className="ri-dt-sez" aria-labelledby="dt-note">
          <h2 className="etichetta-riga etichetta m-0" id="dt-note">
            {testi.dettaglio.note}
          </h2>
          <p className="ri-note t-corpo">{voce.note}</p>
        </section>
      )}

      <Foglio aperto={conferma} onChiudi={() => setConferma(false)} titolo={testi.elimina.titolo}>
        <div className="flex flex-col gap-4">
          <Avviso tipo="errore">{testi.elimina.testo(quale)}</Avviso>
          {elimina.isError && <Avviso tipo="errore">{testi.elimina.errore}</Avviso>}
          <div className="grid grid-cols-2 gap-3">
            <Pulsante variante="secondario" onClick={() => setConferma(false)}>
              {testi.elimina.annulla}
            </Pulsante>
            <Pulsante
              variante="pericolo"
              caricamento={elimina.isPending}
              onClick={() =>
                elimina.mutate(voce, {
                  onSuccess: () => {
                    mostraToast({ testo: testi.elimina.fatto, icona: <Icona icona={Trash2} /> });
                    router.replace('/ricorda/');
                  },
                })
              }
            >
              <Icona icona={Trash2} dimensione="s" />
              {testi.elimina.conferma}
            </Pulsante>
          </div>
        </div>
      </Foglio>
    </article>
  );
}
