'use client';

import { EyeOff, Minus, Plus } from 'lucide-react';
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { Icona } from '@/components/ui/Icona';
import { Pulsante } from '@/components/ui/Pulsante';
import { classi } from '@/lib/classi';
import { messaggi } from '@/lib/messaggi/it';

const v = messaggi.moderazione.revisioneFlyer.vista;
const LIVELLI = [1, 1.5, 2, 3, 4] as const;
const PASSO_FRECCE = 40;

type Posizione = { x: number; y: number };

/**
 * Visualizzatore del flyer (design F-40, tavola 12): zoom con i pulsanti o con + e −, sposta
 * trascinando o con le frecce, "Adatta" torna all'inizio. Un flyer sospetto resta sfocato
 * finché il moderatore non sceglie di vederlo.
 */
export function VisualizzatoreFlyer({ url, sospetto }: { url: string | null; sospetto: boolean }) {
  const [livello, setLivello] = useState(0);
  const [posizione, setPosizione] = useState<Posizione>({ x: 0, y: 0 });
  const [mostrato, setMostrato] = useState(!sospetto);
  const trascina = useRef<{ inizio: Posizione; puntatore: Posizione } | null>(null);
  const zoom = LIVELLI[livello] ?? 1;

  const cambiaLivello = (delta: number) => {
    const nuovo = Math.min(LIVELLI.length - 1, Math.max(0, livello + delta));
    setLivello(nuovo);
    if (nuovo === 0) setPosizione({ x: 0, y: 0 });
  };
  const adatta = () => {
    setLivello(0);
    setPosizione({ x: 0, y: 0 });
  };

  function tasto(evento: KeyboardEvent<HTMLDivElement>) {
    const spostamenti: Record<string, Posizione> = {
      ArrowUp: { x: 0, y: PASSO_FRECCE },
      ArrowDown: { x: 0, y: -PASSO_FRECCE },
      ArrowLeft: { x: PASSO_FRECCE, y: 0 },
      ArrowRight: { x: -PASSO_FRECCE, y: 0 },
    };
    if (evento.key === '+' || evento.key === '=') cambiaLivello(1);
    else if (evento.key === '-') cambiaLivello(-1);
    else if (evento.key === '0') adatta();
    else if (spostamenti[evento.key] && zoom > 1) {
      const d = spostamenti[evento.key] as Posizione;
      setPosizione((p) => ({ x: p.x + d.x, y: p.y + d.y }));
    } else return;
    // Le frecce qui spostano l'immagine, non passano al flyer vicino.
    evento.preventDefault();
    evento.stopPropagation();
  }

  function giu(evento: PointerEvent<HTMLDivElement>) {
    if (zoom === 1) return;
    evento.currentTarget.setPointerCapture(evento.pointerId);
    trascina.current = { inizio: posizione, puntatore: { x: evento.clientX, y: evento.clientY } };
  }
  function muovi(evento: PointerEvent<HTMLDivElement>) {
    const t = trascina.current;
    if (!t) return;
    setPosizione({
      x: t.inizio.x + evento.clientX - t.puntatore.x,
      y: t.inizio.y + evento.clientY - t.puntatore.y,
    });
  }
  const su = () => {
    trascina.current = null;
  };

  const stile = {
    '--zoom': String(zoom),
    '--sx': `${posizione.x}px`,
    '--sy': `${posizione.y}px`,
  } as CSSProperties;

  return (
    <section className="vista" aria-label={v.etichetta}>
      <div className="vista-barra">
        <Pulsante
          variante="neutro"
          soloIcona
          aria-label={v.riduci}
          disabled={!url || livello === 0}
          onClick={() => cambiaLivello(-1)}
        >
          <Icona icona={Minus} dimensione="s" />
        </Pulsante>
        <span className="liv" aria-live="polite">
          {v.livello(Math.round(zoom * 100))}
        </span>
        <Pulsante
          variante="neutro"
          soloIcona
          aria-label={v.ingrandisci}
          disabled={!url || livello === LIVELLI.length - 1}
          onClick={() => cambiaLivello(1)}
        >
          <Icona icona={Plus} dimensione="s" />
        </Pulsante>
        <Pulsante variante="testo" dimensione="s" disabled={!url} onClick={adatta}>
          {v.adatta}
        </Pulsante>
        <span className="guida">{v.guida}</span>
      </div>
      <div
        className={classi('vista-tela', !mostrato && 'spenta')}
        // Area scorrevole con tastiera: + − 0 e frecce (WCAG 2.1.1).
        tabIndex={url ? 0 : -1}
        role="group"
        aria-label={v.guida}
        style={stile}
        onKeyDown={tasto}
        onPointerDown={giu}
        onPointerMove={muovi}
        onPointerUp={su}
        onPointerCancel={su}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={v.alt} draggable={false} />
        ) : (
          <p className="guida">{v.nonDisponibile}</p>
        )}
        {url && !mostrato && (
          <div className="sfocata-velo">
            <Icona icona={EyeOff} />
            <span>{v.spenta}</span>
            <Pulsante variante="secondario" dimensione="s" onClick={() => setMostrato(true)}>
              {v.mostra}
            </Pulsante>
          </div>
        )}
      </div>
    </section>
  );
}
