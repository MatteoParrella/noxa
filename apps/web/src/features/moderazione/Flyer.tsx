'use client';

import { Image as ImageIcon, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type CSSProperties } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Icona } from '@/components/ui/Icona';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { TabellaDensa, type ColonnaTabella } from '@/components/ui/TabellaDensa';
import { classi } from '@/lib/classi';
import { messaggi } from '@/lib/messaggi/it';
import type { FlyerCoda } from './api';
import { useCodaFlyer, useFirme } from './dati';
import { dataOra } from './formato';
import { PERCORSI_MODERAZIONE } from './GuscioModerazione';
import { RevisioneFlyer } from './RevisioneFlyer';
import { Filtro, GruppoFiltri, Testata } from './Testata';

const testi = messaggi.moderazione;
const c = testi.codaFlyer;

/** Sotto questa confidenza (minimo tra titolo, locale e data) il flyer va controllato meglio. */
export const SOGLIA_CONFIDENZA_BASSA = 0.7;

type FiltroFlyer = 'in_revisione' | 'errore' | 'bassa' | 'senza_locale' | 'corrispondenza';

const FILTRI: Record<FiltroFlyer, (f: FlyerCoda) => boolean> = {
  in_revisione: (f) => f.stato === 'in_revisione',
  errore: (f) => f.stato === 'errore',
  bassa: (f) => f.confidenza !== null && f.confidenza < SOGLIA_CONFIDENZA_BASSA,
  senza_locale: (f) => f.evento === null,
  corrispondenza: (f) => f.candidato !== null,
};

/** Coda dei flyer (tavola 11) o, con `?id=`, la revisione di un flyer (tavola 12). */
export function Flyer() {
  const id = useSearchParams().get('id');
  return id ? <RevisioneFlyer key={id} id={id} /> : <CodaFlyer />;
}

export function Confidenza({ valore }: { valore: number | null }) {
  if (valore === null) return <span className="conf">{c.senzaConfidenza}</span>;
  const percento = Math.round(valore * 100);
  return (
    <span className={classi('conf', valore < SOGLIA_CONFIDENZA_BASSA && 'bassa')}>
      <span className="conf-barra" aria-hidden="true">
        <i style={{ '--valore': `${percento}%` } as CSSProperties} />
      </span>
      {c.confidenza(percento)}
    </span>
  );
}

function CodaFlyer() {
  const router = useRouter();
  const coda = useCodaFlyer();
  const [filtri, setFiltri] = useState<FiltroFlyer[]>([]);
  const percorsi = (coda.data ?? []).map((f) => f.storage_path);
  const firme = useFirme('flyer-caricati', percorsi);

  const alterna = (filtro: FiltroFlyer) =>
    setFiltri((attuali) =>
      attuali.includes(filtro) ? attuali.filter((f) => f !== filtro) : [...attuali, filtro],
    );
  const righe = (coda.data ?? []).filter((f) => filtri.every((filtro) => FILTRI[filtro](f)));

  const colonne: ReadonlyArray<ColonnaTabella<FlyerCoda>> = [
    {
      chiave: 'arrivo',
      titolo: c.colonne.arrivo,
      cella: (f) => <time dateTime={f.creato_il}>{dataOra(f.creato_il)}</time>,
      classe: 'mono',
    },
    {
      chiave: 'confidenza',
      titolo: c.colonne.confidenza,
      cella: (f) => <Confidenza valore={f.confidenza} />,
    },
    {
      chiave: 'corrispondenza',
      titolo: c.colonne.corrispondenza,
      cella: (f) => (f.candidato ? <Badge variante="info">{c.possibile}</Badge> : null),
    },
    {
      chiave: 'stato',
      titolo: c.colonne.stato,
      cella: (f) => (
        <span className="flex flex-wrap gap-1">
          <Badge variante={f.stato === 'errore' ? 'avviso' : 'info'}>{c.stati[f.stato]}</Badge>
          {f.contenuto_sospetto && <Badge variante="errore">{c.sospetto}</Badge>}
        </span>
      ),
    },
  ];

  return (
    <>
      <Testata
        titolo={c.titolo}
        conta={coda.data ? String(coda.data.length) : undefined}
        strumenti={
          <span className="riservato">
            <Icona icona={Lock} dimensione="s" />
            {c.riservato}
          </span>
        }
        filtri={
          <GruppoFiltri etichetta={c.filtri.stato}>
            <Filtro attivo={filtri.length === 0} onCambia={() => setFiltri([])}>
              {testi.comune.tutti}
            </Filtro>
            <Filtro
              attivo={filtri.includes('in_revisione')}
              onCambia={() => alterna('in_revisione')}
            >
              {c.stati.in_revisione}
            </Filtro>
            <Filtro attivo={filtri.includes('errore')} onCambia={() => alterna('errore')}>
              {c.stati.errore}
            </Filtro>
            <Filtro attivo={filtri.includes('bassa')} onCambia={() => alterna('bassa')}>
              {c.filtri.confidenzaBassa}
            </Filtro>
            <Filtro
              attivo={filtri.includes('senza_locale')}
              onCambia={() => alterna('senza_locale')}
            >
              {c.filtri.localeNonRiconosciuto}
            </Filtro>
            <Filtro
              attivo={filtri.includes('corrispondenza')}
              onCambia={() => alterna('corrispondenza')}
            >
              {c.filtri.conCorrispondenza}
            </Filtro>
          </GruppoFiltri>
        }
      />
      <div className="md-scorre">
        {coda.isPending && <Caricamento descrizione={c.caricamento} righe={6} />}
        {coda.isError && (
          <div className="pt-6">
            <ErroreConAzione
              titolo={testi.comune.erroreCaricamento.titolo}
              onRiprova={() => void coda.refetch()}
              riprovaInCorso={coda.isFetching}
            >
              {testi.comune.erroreCaricamento.testo}
            </ErroreConAzione>
          </div>
        )}
        {coda.data && righe.length === 0 && (
          <div className="pt-6">
            {coda.data.length === 0 ? (
              <ElencoVuoto icona={ImageIcon} titolo={c.vuoto.titolo}>
                {c.vuoto.testo}
              </ElencoVuoto>
            ) : (
              <ElencoVuoto icona={ImageIcon} titolo={c.vuotoFiltri.titolo}>
                {c.vuotoFiltri.testo}
              </ElencoVuoto>
            )}
          </div>
        )}
        {righe.length > 0 && (
          <TabellaDensa
            etichetta={c.titolo}
            titoloPrima={c.colonne.estratto}
            colonne={colonne}
            righe={righe}
            chiaveRiga={(f) => f.id}
            onApri={(f) => router.push(PERCORSI_MODERAZIONE.revisioneFlyer(f.id))}
            prima={(f) => {
              const url = firme.data?.[f.storage_path];
              const titolo = f.evento?.titolo ?? f.risultato_estrazione?.titolo ?? c.senzaTitolo;
              const locale =
                f.evento?.locale_nome ??
                f.risultato_estrazione?.nome_locale ??
                c.localeNonRiconosciuto;
              return (
                <span className="cella-flyer">
                  <span
                    className={classi('flyer-mini', f.contenuto_sospetto && 'sfocata-mini')}
                    aria-hidden="true"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {url && <img src={url} alt="" />}
                  </span>
                  <span className="cella-nome">
                    <Link href={PERCORSI_MODERAZIONE.revisioneFlyer(f.id)} data-apri-riga>
                      {titolo}
                    </Link>
                    <span>{locale}</span>
                  </span>
                </span>
              );
            }}
          />
        )}
      </div>
    </>
  );
}
