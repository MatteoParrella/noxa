import { messaggi } from '@/lib/messaggi/it';
import type { DatiRiepilogo } from './api-anno';
import type { Fondo, SchedaWrapped } from './schede';

/**
 * Disegno delle schede del riepilogo su canvas (design/F-33-wrapped): lo stesso disegno per lo
 * schermo e per l'immagine da 1080 × 1920 salvata sul telefono, senza servizi esterni. Le misure
 * sono in centesimi della larghezza, come le unità `cqw` delle tavole.
 */

export const LARGHEZZA = 1080;
export const ALTEZZA = 1920;
const U = LARGHEZZA / 100;

const s = messaggi.ricorda.riepilogo.schede;
const mesi = messaggi.ricorda.statistiche.mesi;
const iniziali = messaggi.ricorda.statistiche.iniziali;
const GIORNI = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];

export type Colori = {
  sfondo: string;
  superficie: string;
  accento: string;
  accentoTenue: string;
  accentoTesto: string;
  testo: string;
  suAccento: string;
};

/** Colori del tema in uso, letti dai token (tokens.css). */
export function leggiColori(elemento: Element): Colori {
  const stile = getComputedStyle(elemento);
  const v = (nome: string, riserva: string) => stile.getPropertyValue(nome).trim() || riserva;
  return {
    sfondo: v('--colore-sfondo', '#000000'),
    superficie: v('--colore-superficie-2', '#2c2c2e'),
    accento: v('--colore-accento', '#3ee0cf'),
    accentoTenue: v('--colore-accento-tenue', '#0d3632'),
    accentoTesto: v('--colore-accento-testo', '#3ee0cf'),
    testo: v('--colore-testo-primario', '#ffffff'),
    suAccento: v('--colore-testo-su-accento', '#000000'),
  };
}

function tinte(fondo: Fondo, c: Colori) {
  switch (fondo) {
    case 'accento':
      return { fondo: c.accento, testo: c.suAccento, acc: c.suAccento };
    case 'superficie':
      return { fondo: c.superficie, testo: c.testo, acc: c.accentoTesto };
    case 'tenue':
      return { fondo: c.accentoTenue, testo: c.testo, acc: c.accentoTesto };
    default:
      return { fondo: c.sfondo, testo: c.testo, acc: c.accentoTesto };
  }
}

type Stile = {
  dim: number;
  peso?: number;
  mono?: boolean;
  stretta?: boolean;
  colore: string;
  allinea?: CanvasTextAlign;
  spaziatura?: number;
  opacita?: number;
};

const TESTO = "'Archivo Variable', 'Archivo', 'Helvetica Neue', Arial, sans-serif";
// Numeri e date: Inter, incluso nell'app, così l'immagine è uguale su ogni telefono (ADR-0035).
const MONO = "'Inter Variable', Inter, -apple-system, BlinkMacSystemFont, Roboto, sans-serif";

function imposta(ctx: CanvasRenderingContext2D, stile: Stile) {
  ctx.font = `${stile.peso ?? 400} ${stile.stretta ? 'condensed ' : ''}${stile.dim}px ${stile.mono ? MONO : TESTO}`;
  ctx.fillStyle = stile.colore;
  ctx.textAlign = stile.allinea ?? 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = stile.opacita ?? 1;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${stile.spaziatura ?? 0}px`;
}

function scrivi(ctx: CanvasRenderingContext2D, testo: string, x: number, y: number, stile: Stile) {
  imposta(ctx, stile);
  ctx.fillText(testo, x, y);
  ctx.globalAlpha = 1;
}

/** Riduce la dimensione finché il testo sta nella larghezza. */
function adatta(
  ctx: CanvasRenderingContext2D,
  testo: string,
  stile: Stile,
  larghezza: number,
): Stile {
  let dim = stile.dim;
  imposta(ctx, { ...stile, dim });
  while (dim > 12 && ctx.measureText(testo).width > larghezza) {
    dim *= 0.94;
    imposta(ctx, { ...stile, dim });
  }
  return { ...stile, dim };
}

/** Taglia con i puntini un testo troppo lungo per una riga. */
function taglia(ctx: CanvasRenderingContext2D, testo: string, stile: Stile, larghezza: number) {
  imposta(ctx, stile);
  if (ctx.measureText(testo).width <= larghezza) return testo;
  let fine = testo.length;
  while (fine > 1 && ctx.measureText(`${testo.slice(0, fine)}…`).width > larghezza) fine -= 1;
  return `${testo.slice(0, fine).trimEnd()}…`;
}

/** Righe di un testo che va a capo nella larghezza data. */
function righe(ctx: CanvasRenderingContext2D, testo: string, stile: Stile, larghezza: number) {
  imposta(ctx, stile);
  const parole = testo.split(' ');
  const esito: string[] = [];
  let riga = '';
  for (const parola of parole) {
    const prova = riga ? `${riga} ${parola}` : parola;
    if (riga && ctx.measureText(prova).width > larghezza) {
      esito.push(riga);
      riga = parola;
    } else riga = prova;
  }
  if (riga) esito.push(riga);
  return esito;
}

const SX = 8 * U;
const DX = LARGHEZZA - 8 * U;
const LARGO = DX - SX;
const FONDO = ALTEZZA - 7 * U;

function sopra(ctx: CanvasRenderingContext2D, testo: string, colore: string) {
  scrivi(ctx, testo.toUpperCase(), SX, 9 * U + 3.4 * U, {
    dim: 3.4 * U,
    peso: 500,
    colore,
    spaziatura: 0.16 * 3.4 * U,
    opacita: 0.85,
  });
}

function piede(
  ctx: CanvasRenderingContext2D,
  anno: number,
  n: number,
  totale: number,
  colore: string,
) {
  scrivi(ctx, 'noxa', SX, FONDO, { dim: 4.4 * U, peso: 700, colore, opacita: 0.8 });
  scrivi(ctx, `${anno} · ${n}/${totale}`, DX, FONDO, {
    dim: 3.6 * U,
    peso: 500,
    mono: true,
    colore,
    allinea: 'right',
    opacita: 0.8,
  });
}

/** Elenco numerato in fondo alla scheda, con una linea sottile tra le righe. */
function elenco(
  ctx: CanvasRenderingContext2D,
  voci: ReadonlyArray<{ nome: string; serate: number }>,
  basso: number,
  colore: string,
) {
  const passo = 10.4 * U;
  let y = basso - passo * voci.length;
  voci.forEach((voce, i) => {
    const base = y + 7 * U;
    scrivi(ctx, String(i + 1).padStart(2, '0'), SX, base, {
      dim: 3.6 * U,
      mono: true,
      colore,
      opacita: 0.75,
    });
    const stileNome = { dim: 5.4 * U, colore };
    scrivi(ctx, taglia(ctx, voce.nome, stileNome, LARGO - 22 * U), SX + 10 * U, base, stileNome);
    scrivi(ctx, String(voce.serate), DX, base, {
      dim: 4.2 * U,
      peso: 500,
      mono: true,
      colore,
      allinea: 'right',
      opacita: 0.85,
    });
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = colore;
    ctx.fillRect(SX, y + passo - 2, LARGO, 2);
    ctx.globalAlpha = 1;
    y += passo;
  });
}

function numeroGrande(
  ctx: CanvasRenderingContext2D,
  valore: string,
  y: number,
  dim: number,
  colore: string,
) {
  const stile = adatta(
    ctx,
    valore,
    { dim, peso: 500, mono: true, colore, spaziatura: -0.04 * dim },
    LARGO,
  );
  scrivi(ctx, valore, SX - 0.04 * dim, y + stile.dim * 0.78, stile);
  return y + stile.dim * 0.9;
}

export type Contesto = {
  dati: DatiRiepilogo;
  scheda: SchedaWrapped;
  indice: number;
  totale: number;
  colori: Colori;
  nomiBadge: ReadonlyMap<string, { nome: string; icona: HTMLImageElement | null }>;
};

/** Disegna una scheda su un canvas di 1080 × 1920. */
export function disegnaScheda(ctx: CanvasRenderingContext2D, contesto: Contesto) {
  const { dati, scheda, indice, totale, colori } = contesto;
  const t = tinte(scheda.fondo, colori);
  ctx.save();
  ctx.clearRect(0, 0, LARGHEZZA, ALTEZZA);
  ctx.fillStyle = t.fondo;
  ctx.fillRect(0, 0, LARGHEZZA, ALTEZZA);
  if (scheda.tipo !== 'chiusura') sopra(ctx, s.sopra[scheda.tipo], t.testo);

  switch (scheda.tipo) {
    case 'copertina': {
      const titolo = { dim: 14 * U, peso: 700, stretta: true, colore: t.testo };
      scrivi(ctx, s.ilTuo, SX, 62 * U, titolo);
      numeroGrande(ctx, String(dati.anno), 66 * U, 34 * U, t.acc);
      scrivi(ctx, s.diNotte, SX, 112 * U, titolo);
      scrivi(ctx, s.copertinaNota, SX, 124 * U, { dim: 4 * U, colore: t.testo, opacita: 0.88 });
      break;
    }
    case 'serate': {
      const basso = numeroGrande(ctx, String(dati.serate), 20 * U, 46 * U, t.testo);
      scrivi(ctx, dati.serate === 1 ? s.serataAnnotata : s.serateAnnotate, SX, basso + 6 * U, {
        dim: 6.4 * U,
        colore: t.testo,
      });
      const massimo = Math.max(1, ...dati.per_mese);
      const passo = LARGO / 12;
      const baseBarre = FONDO - 30 * U;
      dati.per_mese.forEach((valore, i) => {
        const x = SX + i * passo + passo * 0.12;
        const h = valore === 0 ? 2 : (valore / massimo) * 22 * U;
        ctx.globalAlpha = valore === 0 ? 0.35 : 1;
        ctx.fillStyle = t.testo;
        ctx.fillRect(x, baseBarre - h, passo * 0.76, h);
        ctx.globalAlpha = 1;
        scrivi(ctx, iniziali[i] ?? '', x + passo * 0.38, baseBarre + 4.4 * U, {
          dim: 2.8 * U,
          mono: true,
          colore: t.testo,
          allinea: 'center',
          opacita: 0.8,
        });
      });
      ctx.fillStyle = t.testo;
      ctx.fillRect(SX, baseBarre, LARGO, 2);
      const mese = (mesi[dati.mese_top.mese - 1] ?? '').toLowerCase();
      const frase = `${s.mesePieno} ${mese}, ${dati.mese_top.serate === 1 ? '1 serata' : `${dati.mese_top.serate} serate`}.`;
      righe(ctx, frase, { dim: 5 * U, colore: t.testo }, LARGO).forEach((riga, i) =>
        scrivi(ctx, riga, SX, baseBarre + 13 * U + i * 6.5 * U, { dim: 5 * U, colore: t.testo }),
      );
      break;
    }
    case 'locali': {
      const basso = numeroGrande(ctx, String(dati.locali_diversi), 20 * U, 46 * U, t.acc);
      scrivi(
        ctx,
        dati.locali_diversi === 1 ? s.localeDiverso : s.localiDiversi,
        SX,
        basso + 6 * U,
        {
          dim: 6.4 * U,
          colore: t.testo,
        },
      );
      elenco(ctx, dati.locali_top, FONDO - 12 * U, t.testo);
      break;
    }
    case 'musica': {
      if (dati.genere_top) {
        scrivi(ctx, s.genere, SX, 22 * U, { dim: 4 * U, colore: t.testo, opacita: 0.88 });
        const stile = adatta(
          ctx,
          dati.genere_top.nome,
          { dim: 24 * U, peso: 700, stretta: true, colore: t.acc },
          LARGO,
        );
        scrivi(ctx, dati.genere_top.nome, SX, 24 * U + stile.dim * 0.8, stile);
      }
      if (dati.dj_top.length > 0) {
        const basso = FONDO - 12 * U;
        scrivi(ctx, s.tuoiDj, SX, basso - 10.4 * U * dati.dj_top.length - 3 * U, {
          dim: 4 * U,
          colore: t.testo,
          opacita: 0.88,
        });
        elenco(ctx, dati.dj_top, basso, t.testo);
      }
      break;
    }
    case 'compagnia': {
      const basso = numeroGrande(ctx, String(dati.serate_con_amici), 24 * U, 40 * U, t.acc);
      scrivi(
        ctx,
        dati.serate_con_amici === 1 ? s.inCompagniaUna : s.inCompagnia,
        SX,
        basso + 6 * U,
        {
          dim: 6.4 * U,
          colore: t.testo,
        },
      );
      const linea = FONDO - 46 * U;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = t.testo;
      ctx.fillRect(SX, linea, LARGO, 2);
      ctx.globalAlpha = 1;
      const fine = numeroGrande(ctx, String(dati.amici_diversi), linea + 6 * U, 24 * U, t.testo);
      scrivi(ctx, dati.amici_diversi === 1 ? s.amicoDiverso : s.amiciDiversi, SX, fine + 6 * U, {
        dim: 6.4 * U,
        colore: t.testo,
      });
      break;
    }
    case 'badge': {
      const badge = dati.badge
        .map((codice) => contesto.nomiBadge.get(codice))
        .filter((b) => b !== undefined)
        .slice(0, 9);
      const basso = numeroGrande(ctx, String(badge.length), 18 * U, 30 * U, t.testo);
      scrivi(ctx, badge.length === 1 ? s.badgeAnnoUno : s.badgeAnno, SX, basso + 6 * U, {
        dim: 6.4 * U,
        colore: t.testo,
      });
      const colonna = LARGO / 3;
      const inizio = basso + 16 * U;
      badge.forEach((b, i) => {
        const cx = SX + colonna * (i % 3) + colonna / 2;
        const cy = inizio + Math.floor(i / 3) * 31 * U + 9.5 * U;
        ctx.strokeStyle = t.testo;
        ctx.lineWidth = 0.5 * U;
        ctx.beginPath();
        ctx.arc(cx, cy, 9.5 * U, 0, Math.PI * 2);
        ctx.stroke();
        if (b.icona) ctx.drawImage(b.icona, cx - 4 * U, cy - 4 * U, 8 * U, 8 * U);
        const stileNome = { dim: 3.6 * U, colore: t.testo, allinea: 'center' as const };
        scrivi(ctx, taglia(ctx, b.nome, stileNome, colonna - 2 * U), cx, cy + 15 * U, stileNome);
      });
      break;
    }
    case 'voto': {
      const voto = dati.voto_top;
      if (!voto) break;
      scrivi(ctx, s.votoAlto, SX, 22 * U, { dim: 4 * U, colore: t.testo, opacita: 0.88 });
      const stile = { dim: 40 * U, peso: 500, mono: true, colore: t.acc };
      scrivi(ctx, String(voto.voto), SX - 1.6 * U, 26 * U + 40 * U * 0.78, stile);
      imposta(ctx, stile);
      const larghezza = ctx.measureText(String(voto.voto)).width;
      scrivi(ctx, '/5', SX + larghezza, 26 * U + 40 * U * 0.78, {
        dim: 14 * U,
        peso: 500,
        mono: true,
        colore: t.acc,
        opacita: 0.7,
      });
      const [a, m, g] = voto.data_serata.split('-').map(Number) as [number, number, number];
      const giorno = GIORNI[new Date(Date.UTC(a, m - 1, g)).getUTCDay()] ?? '';
      const dataBreve = `${giorno} ${String(g).padStart(2, '0')}.${String(m).padStart(2, '0')}`;
      const yData = voto.locale ? FONDO - 26 * U : FONDO - 12 * U;
      scrivi(ctx, dataBreve, SX, yData, { dim: 9 * U, peso: 500, mono: true, colore: t.testo });
      if (voto.locale) {
        const stileLocale = { dim: 11 * U, peso: 700, stretta: true, colore: t.testo };
        scrivi(ctx, taglia(ctx, voto.locale, stileLocale, LARGO), SX, FONDO - 12 * U, stileLocale);
      }
      break;
    }
    case 'chiusura': {
      scrivi(ctx, s.sopra.chiusura.toUpperCase(), SX, 9 * U + 3.4 * U, {
        dim: 3.4 * U,
        peso: 500,
        colore: t.testo,
        spaziatura: 0.16 * 3.4 * U,
        opacita: 0.85,
      });
      const titolo = { dim: 17 * U, peso: 700, stretta: true, colore: t.testo };
      const testo = righe(ctx, s.ciVediamo, titolo, LARGO);
      testo.forEach((riga, i) => scrivi(ctx, riga, SX, 70 * U + i * 16 * U, titolo));
      numeroGrande(ctx, String(dati.anno + 1), 72 * U + testo.length * 16 * U, 30 * U, t.acc);
      scrivi(ctx, 'noxa', SX, FONDO, { dim: 7 * U, peso: 700, colore: t.testo });
      imposta(ctx, { dim: 7 * U, peso: 700, colore: t.testo });
      const fine = SX + ctx.measureText('noxa').width;
      ctx.fillStyle = colori.accento;
      ctx.beginPath();
      ctx.arc(fine + 2.2 * U, FONDO - 1 * U, 1 * U, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  if (scheda.tipo !== 'chiusura') piede(ctx, dati.anno, indice + 1, totale, t.testo);
  ctx.restore();
}

/** Carica Archivo e Inter prima di disegnare, così il canvas non usa caratteri di riserva. */
export async function caricaCaratteri(): Promise<void> {
  if (!('fonts' in document)) return;
  await Promise.all([
    document.fonts.load(`700 condensed 100px ${TESTO}`),
    document.fonts.load(`400 100px ${TESTO}`),
    document.fonts.load(`500 100px ${MONO}`),
    document.fonts.load(`400 100px ${MONO}`),
  ]).catch(() => undefined);
}

/** Icona SVG (Lucide, a linea) trasformata in immagine del colore richiesto. */
export function iconaComeImmagine(svg: SVGElement, colore: string): Promise<HTMLImageElement> {
  const copia = svg.cloneNode(true) as SVGElement;
  copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copia.setAttribute('stroke', colore);
  copia.setAttribute('width', '96');
  copia.setAttribute('height', '96');
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(copia.outerHTML)}`;
  return new Promise((risolvi, rifiuta) => {
    const immagine = new Image();
    immagine.onload = () => risolvi(immagine);
    immagine.onerror = rifiuta;
    immagine.src = url;
  });
}
