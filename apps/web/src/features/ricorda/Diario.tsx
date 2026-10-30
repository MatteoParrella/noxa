'use client';

import { BookOpen, Lock, Plus, RefreshCw, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { GruppoAvatar } from '@/components/ui/Avatar';
import { Icona } from '@/components/ui/Icona';
import { Entra } from '@/components/ui/Movimento';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { messaggi } from '@/lib/messaggi/it';
import { perMese, type VoceMostrata } from './coda';
import { useDiario } from './dati';
import { conChi, luogoVoce, partiData, titoloMese, titoloVoce } from './formato';

const testi = messaggi.ricorda;

/** Etichetta fissa del diario privato (design/F-30-tracker §Contesto). */
export function EtichettaPrivato() {
  return (
    <span className="ri-privato">
      <Icona icona={Lock} />
      {testi.area.privato}
    </span>
  );
}

/** Ricorda › Il mio diario (design/F-30-tracker §1): serate per mese, dalla più recente. */
export function Diario() {
  const diario = useDiario();

  return (
    <div className="flex flex-col">
      {/* Spazio delle statistiche e dei badge della Fase 2: vuoto, senza contenuti finti. */}
      <div className="ri-riservato" aria-hidden="true" />
      <div className="ri-azioni">
        <Link className="btn btn-principale" href="/ricorda/modifica/">
          <Icona icona={Plus} dimensione="s" />
          {testi.area.aggiungi}
        </Link>
      </div>
      <Contenuto diario={diario} />
    </div>
  );
}

function Contenuto({ diario }: { diario: ReturnType<typeof useDiario> }) {
  if (diario.stato === 'caricamento') {
    return (
      <div className="pt-6">
        <Caricamento descrizione={testi.area.caricamento} righe={3} />
      </div>
    );
  }
  if (diario.stato === 'errore') {
    return (
      <div className="pt-6">
        <ErroreConAzione
          titolo={testi.area.errore.titolo}
          onRiprova={diario.riprova}
          riprovaInCorso={diario.inCorso}
        >
          {testi.area.errore.testo}
        </ErroreConAzione>
      </div>
    );
  }
  if (diario.voci.length === 0) {
    return (
      <div className="pt-6">
        <ElencoVuoto icona={BookOpen} titolo={testi.area.vuoto.titolo}>
          {testi.area.vuoto.testo}
        </ElencoVuoto>
      </div>
    );
  }
  return (
    <div>
      {perMese(diario.voci).map(({ mese, voci }, indice) => (
        <Entra key={mese} indice={Math.min(indice + 1, 4)}>
          <section aria-labelledby={`mese-${mese}`}>
            <div className="ri-mese">
              <h2 id={`mese-${mese}`}>{titoloMese(mese)}</h2>
              <span>{testi.area.serate(voci.length)}</span>
            </div>
            <ul className="m-0 list-none p-0">
              {voci.map((voce) => (
                <li key={voce.id}>
                  <RigaDiario voce={voce} />
                </li>
              ))}
            </ul>
          </section>
        </Entra>
      ))}
    </div>
  );
}

/** Riga del diario: data, evento o locale, amici, voto e stato di sincronizzazione. */
export function RigaDiario({ voce }: { voce: VoceMostrata }) {
  const { giorno, data } = partiData(voce.data_serata);
  const titolo = titoloVoce(voce);
  const luogo = luogoVoce(voce);
  const nomi = voce.amici.map((a) => a.nome_visualizzato);
  const compagnia = conChi(nomi, voce.amici_altri);
  return (
    <Link className="ri-riga" href={`/ricorda/serata/?id=${voce.id}`}>
      <span className="ri-data">
        {giorno}
        <b>{data}</b>
      </span>
      <span className="ri-corpo">
        <b>{titolo}</b>
        {luogo && <small>{luogo}</small>}
        {voce.stato !== 'sincronizzata' && (
          <BadgeSincronizzazione errore={voce.stato === 'errore'} />
        )}
        {compagnia && (
          <span className="ri-meta">
            <GruppoAvatar
              persone={voce.amici.map((a) => ({ nome: a.nome_visualizzato, foto: a.avatar_path }))}
              {...(voce.amici_altri > 0 ? { altri: voce.amici_altri } : {})}
              decorativo
            />
            {compagnia}
          </span>
        )}
      </span>
      <span className="ri-voto-mini">
        {voce.voto !== null && (
          <>
            <span aria-hidden="true">{testi.area.voto(voce.voto)}</span>
            <span className="sr-only">{testi.area.votoLettura(voce.voto)}</span>
          </>
        )}
      </span>
    </Link>
  );
}

/** Badge "Da sincronizzare": scritto, non solo un'icona (design/F-30-tracker §Accessibilità). */
export function BadgeSincronizzazione({ errore = false }: { errore?: boolean }) {
  return (
    <span className={errore ? 'ri-sinc is-errore' : 'ri-sinc'}>
      <Icona icona={errore ? TriangleAlert : RefreshCw} />
      {testi.sincronizzazione.badge}
    </span>
  );
}
