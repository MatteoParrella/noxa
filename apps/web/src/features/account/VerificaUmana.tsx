'use client';

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { chiaveTurnstile } from '@/lib/ambiente';
import { classi } from '@/lib/classi';
import { registraErrore } from '@/lib/registro';
import { temaAttivo } from '@/lib/tema';

/**
 * CAPTCHA di Cloudflare Turnstile richiesto da Supabase Auth in staging e produzione
 * (ARCHITECTURE.md §3.2, ADR-0020). Senza chiave del sito (sviluppo locale) non compare e
 * Supabase non lo richiede. Lo script arriva da challenges.cloudflare.com, l'unica origine
 * esterna ammessa dalla Content Security Policy oltre a Supabase.
 */

type OpzioniTurnstile = {
  sitekey: string;
  theme: 'light' | 'dark';
  language: string;
  appearance: 'always' | 'interaction-only';
  size: 'flexible';
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => boolean;
};

type Turnstile = {
  render: (elemento: HTMLElement, opzioni: OpzioniTurnstile) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let caricamento: Promise<Turnstile> | undefined;

function caricaTurnstile(): Promise<Turnstile> {
  caricamento ??= new Promise<Turnstile>((risolvi, rifiuta) => {
    if (window.turnstile) {
      risolvi(window.turnstile);
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => {
      if (window.turnstile) risolvi(window.turnstile);
      else rifiuta(new Error('Turnstile non disponibile'));
    };
    script.onerror = () => {
      caricamento = undefined;
      rifiuta(new Error('Script di Turnstile non caricato'));
    };
    document.head.append(script);
  });
  return caricamento;
}

/** Vero se l'ambiente richiede il CAPTCHA (chiave del sito configurata). */
export function verificaUmanaRichiesta(): boolean {
  return Boolean(chiaveTurnstile());
}

export type ComandiVerificaUmana = { azzera: () => void };

type Props = {
  /** `visibile` mostra sempre il riquadro; `discreta` compare solo se Cloudflare chiede un'azione. */
  modalita: 'visibile' | 'discreta';
  etichetta: string;
  onToken: (token: string | null) => void;
  riferimento?: Ref<ComandiVerificaUmana>;
};

export function VerificaUmana({ modalita, etichetta, onToken, riferimento }: Props) {
  const contenitore = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const chiave = chiaveTurnstile();
  // Il callback cambia a ogni rendering del genitore: il widget usa sempre l'ultimo.
  const ultimoOnToken = useRef(onToken);
  useEffect(() => {
    ultimoOnToken.current = onToken;
  });

  useImperativeHandle(riferimento, () => ({
    azzera: () => {
      ultimoOnToken.current(null);
      if (widget.current && window.turnstile) window.turnstile.reset(widget.current);
    },
  }));

  useEffect(() => {
    if (!chiave) return;
    let annullato = false;
    caricaTurnstile()
      .then((turnstile) => {
        if (annullato || !contenitore.current) return;
        widget.current = turnstile.render(contenitore.current, {
          sitekey: chiave,
          theme: temaAttivo() === 'chiaro' ? 'light' : 'dark',
          language: 'it',
          appearance: modalita === 'visibile' ? 'always' : 'interaction-only',
          size: 'flexible',
          callback: (token) => ultimoOnToken.current(token),
          'expired-callback': () => ultimoOnToken.current(null),
          'error-callback': () => {
            ultimoOnToken.current(null);
            return true;
          },
        });
      })
      .catch((errore: unknown) => registraErrore('caricamento di Turnstile', errore));
    return () => {
      annullato = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [chiave, modalita]);

  if (!chiave) return null;
  return (
    <div
      ref={contenitore}
      role="group"
      aria-label={etichetta}
      className={classi('verifica-umana', modalita === 'discreta' && 'is-invisibile')}
    />
  );
}
