'use client';

import { ChevronLeft, ChevronRight, Download, Pause, Play, RefreshCw, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento, ElencoVuoto, ErroreConAzione, StrisciaOffline } from '@/components/ui/Stati';
import { useToast } from '@/components/ui/Toast';
import { classi } from '@/lib/classi';
import { useMontato, useOnline } from '@/lib/connessione';
import { ErroreValidazione, converti } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import type { BadgeBacheca, DatiRiepilogo } from './api-anno';
import { ICONE } from './Bacheca';
import { useAggiornaRiepilogo, useBadge, useRiepiloghi } from './dati-anno';
import {
  ALTEZZA,
  LARGHEZZA,
  caricaCaratteri,
  disegnaScheda,
  iconaComeImmagine,
  leggiColori,
} from './disegno';
import { nomeFile, schedeDi, type SchedaWrapped } from './schede';

const testi = messaggi.ricorda.riepilogo;
const DURATA_MS = 6000;

function iscriviMovimento(avvisa: () => void) {
  const lista = window.matchMedia('(prefers-reduced-motion: reduce)');
  lista.addEventListener('change', avvisa);
  return () => lista.removeEventListener('change', avvisa);
}

/** Vero con `prefers-reduced-motion: reduce`: niente avanzamento automatico né animazioni. */
export function useMovimentoRidotto(): boolean {
  return useSyncExternalStore(
    iscriviMovimento,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
}

/**
 * Anno del riepilogo che si può aggiornare oggi: a dicembre quello in corso, a gennaio quello
 * appena chiuso, negli altri mesi nessuno (come `rigenera_mio_riepilogo`).
 */
export function annoAggiornabile(adesso = new Date()): number | null {
  const parti = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(adesso);
  const anno = Number(parti.find((p) => p.type === 'year')?.value);
  const mese = Number(parti.find((p) => p.type === 'month')?.value);
  if (mese === 12) return anno;
  if (mese === 1) return anno - 1;
  return null;
}

/**
 * A tutto schermo sopra l'app: un portale nel body, perché le animazioni d'ingresso delle
 * pagine usano `transform` e vincolerebbero il `position: fixed`.
 */
function Portale({ children }: { children: React.ReactNode }) {
  const montato = useMontato();
  return montato ? createPortal(children, document.body) : null;
}

/** Ricorda › Il tuo anno (design/F-33-wrapped §2): schede a tutto schermo. */
export function Wrapped() {
  return (
    <Portale>
      <ContenutoWrapped />
    </Portale>
  );
}

function ContenutoWrapped() {
  const parametri = useSearchParams();
  const router = useRouter();
  const riepiloghi = useRiepiloghi();
  const badge = useBadge();
  const anno = Number(parametri.get('anno'));
  const chiudi = useCallback(() => router.push('/ricorda/'), [router]);

  const riepilogo = riepiloghi.data?.find((r) => r.anno === anno) ?? null;

  if (!riepiloghi.data) {
    return (
      <Guscio onChiudi={chiudi}>
        {riepiloghi.isError ? (
          <ErroreConAzione
            titolo={testi.errore.titolo}
            onRiprova={() => void riepiloghi.refetch()}
            riprovaInCorso={riepiloghi.isFetching}
          >
            {testi.errore.testo}
          </ErroreConAzione>
        ) : (
          <Caricamento descrizione={testi.caricamento} righe={4} />
        )}
      </Guscio>
    );
  }
  if (!riepilogo) {
    return (
      <Guscio onChiudi={chiudi}>
        <ElencoVuoto icona={X} titolo={testi.assente.titolo}>
          {testi.assente.testo}
        </ElencoVuoto>
      </Guscio>
    );
  }
  return (
    <Visualizzatore
      dati={riepilogo.dati}
      catalogo={badge.data ?? []}
      onChiudi={chiudi}
      aggiornabile={annoAggiornabile() === riepilogo.anno}
    />
  );
}

/** Contenitore a tutto schermo per caricamento, errore e assenza, con Chiudi sempre visibile. */
function Guscio({ onChiudi, children }: { onChiudi: () => void; children: React.ReactNode }) {
  useEsc(onChiudi);
  return (
    <div className="ri-vis" role="dialog" aria-modal="true" aria-label={testi.elenco.titolo}>
      <div className="ri-vis-colonna">
        <div className="ri-vis-testa">
          <span />
          <Pulsante variante="testo" soloIcona aria-label={testi.chiudi} onClick={onChiudi}>
            <Icona icona={X} />
          </Pulsante>
        </div>
        <div className="pt-8">{children}</div>
      </div>
    </div>
  );
}

function useEsc(azione: () => void) {
  useEffect(() => {
    const premi = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') azione();
    };
    window.addEventListener('keydown', premi);
    return () => window.removeEventListener('keydown', premi);
  }, [azione]);
}

function Visualizzatore({
  dati,
  catalogo,
  onChiudi,
  aggiornabile,
}: {
  dati: DatiRiepilogo;
  catalogo: readonly BadgeBacheca[];
  onChiudi: () => void;
  aggiornabile: boolean;
}) {
  const ridotto = useMovimentoRidotto();
  const online = useOnline();
  const mostraToast = useToast();
  const aggiorna = useAggiornaRiepilogo();
  const nomi = useMemo(() => new Map(catalogo.map((b) => [b.codice, b.nome])), [catalogo]);
  const schede = useMemo(() => schedeDi(dati, nomi), [dati, nomi]);
  const [indice, setIndice] = useState(0);
  const [inPausa, setInPausa] = useState(false);
  const [trascorso, setTrascorso] = useState(0);
  const trascorsoRef = useRef(0);
  const [salvataggio, setSalvataggio] = useState(false);
  const scheda = schede[Math.min(indice, schede.length - 1)] as SchedaWrapped;
  const ultima = indice >= schede.length - 1;
  const fermo = ridotto || inPausa || ultima;

  const vai = useCallback(
    (passo: number) => {
      setIndice((attuale) => Math.max(0, Math.min(schede.length - 1, attuale + passo)));
      trascorsoRef.current = 0;
      setTrascorso(0);
    },
    [schede.length],
  );

  useEsc(onChiudi);
  useEffect(() => {
    const premi = (evento: KeyboardEvent) => {
      if (evento.key === 'ArrowRight') vai(1);
      if (evento.key === 'ArrowLeft') vai(-1);
    };
    window.addEventListener('keydown', premi);
    return () => window.removeEventListener('keydown', premi);
  }, [vai]);

  // Avanzamento ogni 6 secondi; si ferma con Pausa, sull'ultima scheda e con il movimento
  // ridotto (WCAG 2.2.2).
  useEffect(() => {
    if (fermo) return;
    let inizio = performance.now() - trascorsoRef.current;
    let richiesta = 0;
    const passo = (istante: number) => {
      const valore = istante - inizio;
      if (valore >= DURATA_MS) {
        inizio = istante;
        trascorsoRef.current = 0;
        setTrascorso(0);
        setIndice((attuale) => Math.min(schede.length - 1, attuale + 1));
      } else {
        trascorsoRef.current = valore;
        setTrascorso(valore);
      }
      richiesta = requestAnimationFrame(passo);
    };
    richiesta = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(richiesta);
  }, [fermo, indice, schede.length]);

  // Disegno della scheda sul canvas, nel tema in uso.
  const tela = useRef<HTMLCanvasElement>(null);
  const icone = useRef<HTMLDivElement>(null);
  const [immaginiBadge, setImmaginiBadge] = useState<Map<string, HTMLImageElement>>(new Map());
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let annullato = false;
    const contenitore = icone.current;
    void (async () => {
      await caricaCaratteri();
      const colore = leggiColori(document.documentElement).suAccento;
      const mappa = new Map<string, HTMLImageElement>();
      for (const svg of Array.from(contenitore?.querySelectorAll('svg[data-tipo]') ?? [])) {
        const tipo = svg.getAttribute('data-tipo');
        if (!tipo) continue;
        try {
          mappa.set(tipo, await iconaComeImmagine(svg as SVGElement, colore));
        } catch {
          // Senza l'icona resta il cerchio con il nome del badge.
        }
      }
      if (!annullato) {
        setImmaginiBadge(mappa);
        setPronto(true);
      }
    })();
    return () => {
      annullato = true;
    };
  }, []);

  const disegna = useCallback(
    (canvas: HTMLCanvasElement, quale: SchedaWrapped, posizione: number) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const badge = new Map(
        catalogo.map((b) => [
          b.codice,
          { nome: b.nome, icona: immaginiBadge.get(b.criterio.tipo) ?? null },
        ]),
      );
      disegnaScheda(ctx, {
        dati,
        scheda: quale,
        indice: posizione,
        totale: schede.length,
        colori: leggiColori(document.documentElement),
        nomiBadge: badge,
      });
    },
    [catalogo, dati, immaginiBadge, schede.length],
  );

  useEffect(() => {
    if (pronto && tela.current) disegna(tela.current, scheda, indice);
  }, [pronto, disegna, scheda, indice]);

  const salva = async () => {
    setSalvataggio(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = LARGHEZZA;
      canvas.height = ALTEZZA;
      disegna(canvas, scheda, indice);
      const blob = await new Promise<Blob | null>((risolvi) => canvas.toBlob(risolvi, 'image/png'));
      if (!blob) throw new Error('immagine');
      const nome = nomeFile(dati.anno, scheda.tipo);
      const file = new File([blob], nome, { type: 'image/png' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
        } catch (errore) {
          // Foglio di sistema chiuso senza scegliere: non è un errore.
          if (!(errore instanceof DOMException && errore.name === 'AbortError')) throw errore;
        }
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = nome;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        mostraToast({ testo: testi.salvata });
      }
    } catch {
      mostraToast({ testo: testi.erroreImmagine });
    } finally {
      setSalvataggio(false);
    }
  };

  const esegui = () =>
    aggiorna.mutate(undefined, {
      onSuccess: (nuovi) => {
        if (nuovi === null) {
          mostraToast({ testo: testi.tessera.quasiVuoto });
          onChiudi();
          return;
        }
        mostraToast({ testo: testi.aggiornato });
        setIndice(0);
        trascorsoRef.current = 0;
        setTrascorso(0);
      },
      onError: (errore) => {
        const dominio = converti(errore);
        const codice = dominio instanceof ErroreValidazione ? dominio.codice : null;
        mostraToast({
          testo:
            codice === 'riepilogo_gia_aggiornato'
              ? testi.domani
              : codice === 'riepilogo_non_disponibile'
                ? testi.nonDisponibile
                : testi.erroreAggiorna,
        });
      },
    });

  const avanzamento = ridotto ? 0 : Math.min(1, trascorso / DURATA_MS);

  return (
    <div className="ri-vis" role="dialog" aria-modal="true" aria-label={testi.titolo(dati.anno)}>
      <div className="ri-vis-colonna">
        {!online && <StrisciaOffline testo={testi.offline} />}
        <div className="ri-avanz" aria-hidden="true">
          {schede.map((s, i) => (
            <i
              key={s.tipo}
              className={classi(i < indice && 'is-fatto', i === indice && 'is-ora')}
              style={
                i === indice
                  ? ({
                      '--avanz': ridotto ? '100%' : `${avanzamento * 100}%`,
                    } as React.CSSProperties)
                  : undefined
              }
            />
          ))}
        </div>
        <div className="ri-vis-testa">
          <b>{testi.titolo(dati.anno)}</b>
          <span className="flex gap-1">
            {!ridotto && (
              <Pulsante
                variante="testo"
                soloIcona
                aria-label={inPausa ? testi.riprendi : testi.pausa}
                aria-pressed={inPausa}
                onClick={() => setInPausa((v) => !v)}
              >
                <Icona icona={inPausa ? Play : Pause} />
              </Pulsante>
            )}
            <Pulsante variante="testo" soloIcona aria-label={testi.chiudi} onClick={onChiudi}>
              <Icona icona={X} />
            </Pulsante>
          </span>
        </div>

        <div className="ri-vis-scheda">
          <canvas
            ref={tela}
            width={LARGHEZZA}
            height={ALTEZZA}
            role="img"
            aria-label={scheda.alt}
            className={classi('ri-tela', !ridotto && 'entra')}
            key={ridotto ? 'tela' : `tela-${indice}`}
          />
          {!ridotto && (
            <>
              <button
                type="button"
                className="ri-tocco ri-tocco-indietro"
                aria-label={testi.indietro}
                disabled={indice === 0}
                onClick={() => vai(-1)}
              />
              <button
                type="button"
                className="ri-tocco ri-tocco-avanti"
                aria-label={testi.avanti}
                disabled={ultima}
                onClick={() => vai(1)}
              />
            </>
          )}
        </div>

        <div className="ri-vis-piede">
          {ridotto && (
            <Pulsante
              variante="secondario"
              soloIcona
              aria-label={testi.indietro}
              disabled={indice === 0}
              onClick={() => vai(-1)}
            >
              <Icona icona={ChevronLeft} />
            </Pulsante>
          )}
          <span className="ri-vis-passo" aria-live="polite">
            {inPausa && !ridotto && <Icona icona={Pause} dimensione="s" />}
            {inPausa && !ridotto ? `${testi.inPausa} · ` : ''}
            {testi.passo(indice + 1, schede.length)}
          </span>
          <Pulsante
            variante="secondario"
            caricamento={salvataggio}
            disabled={!pronto || salvataggio}
            onClick={() => void salva()}
          >
            <Icona icona={Download} dimensione="s" />
            {testi.salva}
          </Pulsante>
          {ridotto && (
            <Pulsante
              variante="secondario"
              soloIcona
              aria-label={testi.avanti}
              disabled={ultima}
              onClick={() => vai(1)}
            >
              <Icona icona={ChevronRight} />
            </Pulsante>
          )}
        </div>

        {ultima && aggiornabile && (
          <div className="ri-vis-aggiorna">
            <Pulsante
              variante="secondario"
              pieno
              disabled={!online || aggiorna.isPending}
              caricamento={aggiorna.isPending}
              onClick={esegui}
            >
              <Icona icona={RefreshCw} dimensione="s" />
              {testi.aggiorna}
            </Pulsante>
            <small>{online ? testi.aggiornaNota : testi.aggiornaOffline}</small>
          </div>
        )}
      </div>
      {/* Icone dei badge, lette come SVG per disegnarle sul canvas. */}
      <div ref={icone} hidden aria-hidden="true">
        {Object.entries(ICONE).map(([tipo, Componente]) => (
          <Componente key={tipo} data-tipo={tipo} strokeWidth={1.75} />
        ))}
      </div>
    </div>
  );
}
