import { z } from 'zod';

/**
 * Copertina generata (design/F-01-copertine-generate/ALGORITMO.md): una locandina astratta per
 * serata quando l'evento non ha né la foto del locale né un flyer approvato. Il seme è il
 * titolo normalizzato più il locale, quindi la stessa serata ha la stessa copertina ogni
 * settimana. Il colore viene dall'immagine della fonte (ADR-0030, `copertina_colori`) oppure,
 * se manca, dal primo genere dell'evento. Tutto si calcola nel telefono, senza richieste.
 */

export const FAMIGLIE = [
  'techno',
  'house',
  'hiphop',
  'reggaeton',
  'commerciale',
  'latino',
  'dnb',
  'elettronica',
  'indie',
  'live',
  'altro',
  'accento',
] as const;
export type Famiglia = (typeof FAMIGLIE)[number];

const DA_GENERE: Record<string, Famiglia> = {
  techno: 'techno',
  house: 'house',
  hip_hop: 'hiphop',
  rap: 'hiphop',
  trap: 'hiphop',
  reggaeton: 'reggaeton',
  commerciale: 'commerciale',
  latino: 'latino',
  drum_and_bass: 'dnb',
  dnb: 'dnb',
  elettronica: 'elettronica',
  indie: 'indie',
  live: 'live',
};

/** Famiglia di colore del primo genere (ALGORITMO §4); senza genere l'accento. */
export function famigliaDaGeneri(generi: readonly string[]): Famiglia {
  const primo = generi[0];
  if (primo === undefined) return 'accento';
  return DA_GENERE[primo.toLowerCase().replaceAll(' ', '_').replaceAll('&', 'and')] ?? 'altro';
}

const Esadecimale = z.string().regex(/^#[0-9A-F]{6}$/);
const Tavolozza = z.object({
  fondo: Esadecimale,
  1: Esadecimale,
  2: Esadecimale,
  bagliore: Esadecimale,
});
/** `eventi.copertina_colori` (ADR-0030); un valore non valido vale come assente. */
export const SchemaColoriCopertina = z
  .object({ scuro: Tavolozza, chiaro: Tavolozza, calcolata_il: z.string() })
  .nullable()
  .catch(null);
export type ColoriCopertina = NonNullable<z.infer<typeof SchemaColoriCopertina>>;

// ---------------------------------------------------------------------------------------------
// Seme e testi (ALGORITMO §1, §5)
// ---------------------------------------------------------------------------------------------

const MESI =
  'gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic';
const DATE = new RegExp(
  `\\b\\d{1,2}[./-]\\d{1,2}(?:[./-]\\d{2,4})?\\b|\\b\\d{1,2}\\s+(?:${MESI})\\b(?:\\s+\\d{4})?`,
  'giu',
);

/** Come `copertine/seme.py` del worker: senza accenti, minuscole, senza date. */
export function normalizza(testo: string): string {
  return testo
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(DATE, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export const semeCopertina = (titolo: string, locale: string) =>
  `${normalizza(titolo)}|${normalizza(locale)}`;

/** Titolo della fonte senza la data, così ogni settimana è identico. */
export function titoloManifesto(titolo: string): string {
  const pulito = titolo
    .replace(DATE, ' ')
    .replace(/\s*[-–—·|]\s*$/u, '')
    .replace(/^\s*[-–—·|]\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim();
  return pulito || titolo.trim();
}

export type CorpoTitolo = 'xl' | 'l' | 'm' | 's';
export function corpoTitolo(titolo: string): CorpoTitolo {
  const lunghezza = titolo.length;
  if (lunghezza <= 8) return 'xl';
  if (lunghezza <= 14) return 'l';
  if (lunghezza <= 24) return 'm';
  return 's';
}

/** Miniatura: al massimo 14 caratteri tagliati a parola intera, poi «…». */
export function titoloCorto(titolo: string): string {
  if (titolo.length <= 14) return titolo;
  let corto = '';
  for (const parola of titolo.split(' ')) {
    const prova = corto ? `${corto} ${parola}` : parola;
    if (prova.length > 14) break;
    corto = prova;
  }
  return `${(corto || titolo.slice(0, 14)).replace(/[\s.,;:!?·–-]+$/u, '')}…`;
}

// ---------------------------------------------------------------------------------------------
// Hash e generatore (ALGORITMO §2)
// ---------------------------------------------------------------------------------------------

export function fnv1a(testo: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < testo.length; i += 1) {
    h ^= testo.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(seme: number): () => number {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MOTIVI = [
  'lampioni',
  'finestre',
  'onde',
  'altoparlante',
  'tram',
  'scia',
  'costellazione',
  'neon',
] as const;
export type Motivo = (typeof MOTIVI)[number];
const ANGOLI = [-18, -9, 0, 9, 18] as const;
const BAGLIORI = [
  [18, 22],
  [50, 14],
  [82, 22],
  [26, 46],
  [74, 46],
  [50, 34],
] as const;

export type ParametriCopertina = {
  motivo: Motivo;
  angolo: number;
  densita: 0 | 1 | 2;
  bagliore: { x: number; y: number; r: number };
  hash: number;
};

export function parametri(seme: string): ParametriCopertina {
  const h = fnv1a(seme);
  const [x, y] = BAGLIORI[(h >>> 8) % 6] ?? BAGLIORI[0];
  return {
    motivo: MOTIVI[h % 8] ?? 'onde',
    angolo: ANGOLI[(h >>> 3) % 5] ?? 0,
    densita: ((h >>> 6) % 3) as 0 | 1 | 2,
    bagliore: { x, y, r: 42 + ((h >>> 11) % 4) * 6 },
    hash: h,
  };
}

// ---------------------------------------------------------------------------------------------
// Motivi (ALGORITMO §3): descrittori SVG nel riquadro 400 × 250, colori solo da variabili
// ---------------------------------------------------------------------------------------------

type Colore = 'var(--cg-1)' | 'var(--cg-2)';
const C1: Colore = 'var(--cg-1)';
const C2: Colore = 'var(--cg-2)';
type Stile = { fill?: Colore | 'none'; stroke?: Colore; strokeWidth?: number; opacity?: number };
export type ElementoMotivo =
  | { tipo: 'path'; d: string; stile: Stile }
  | { tipo: 'circle'; cx: number; cy: number; r: number; stile: Stile }
  | { tipo: 'rect'; x: number; y: number; width: number; height: number; stile: Stile };

const n = (valore: number) => Math.round(valore * 10) / 10;
const traccia = (stroke: Colore, strokeWidth: number, opacity: number): Stile => ({
  fill: 'none',
  stroke,
  strokeWidth,
  opacity,
});

function lampioni(caso: () => number, densita: number): ElementoMotivo[] {
  const numero = 3 + densita;
  const elementi: ElementoMotivo[] = [];
  for (let i = 0; i < numero; i += 1) {
    const x = 40 + (i * 320) / (numero - 1) + (caso() - 0.5) * 30;
    const apertura = 34 + caso() * 30;
    elementi.push({
      tipo: 'path',
      d: `M${n(x - 5)} 26 L${n(x + 5)} 26 L${n(x + apertura)} 260 L${n(x - apertura)} 260 Z`,
      stile: { fill: C2, opacity: n(0.3 + caso() * 0.2) },
    });
  }
  for (let i = 0; i < numero; i += 1) {
    const x = 40 + (i * 320) / (numero - 1);
    elementi.push({ tipo: 'circle', cx: n(x), cy: 22, r: 5, stile: { fill: C1 } });
  }
  return elementi;
}

function finestre(caso: () => number, densita: number): ElementoMotivo[] {
  const colonne = 6 + densita;
  const elementi: ElementoMotivo[] = [];
  for (let riga = 0; riga < 4; riga += 1) {
    for (let colonna = 0; colonna < colonne; colonna += 1) {
      const accesa = caso() < 0.34;
      elementi.push({
        tipo: 'rect',
        x: 53 + colonna * 44,
        y: n(28.4 + riga * 36),
        width: 30,
        height: 20,
        stile: accesa ? { fill: C1, opacity: caso() < 0.5 ? 1 : 0.8 } : { fill: C2, opacity: 0.55 },
      });
    }
  }
  return elementi;
}

function onde(caso: () => number, densita: number): ElementoMotivo[] {
  const numero = 5 + densita;
  return Array.from({ length: numero }, (_, i) => {
    const base = 40 + i * (150 / numero);
    const ampiezza = 20 * (1 - i / (numero + 1));
    const passo = 0.012 + caso() * 0.01;
    const fase = caso() * Math.PI * 2;
    const punti: string[] = [];
    for (let x = -60; x <= 460; x += 20) {
      punti.push(
        `${punti.length ? 'L' : 'M'}${x} ${n(base + Math.sin(x * passo + fase) * ampiezza)}`,
      );
    }
    return {
      tipo: 'path' as const,
      d: punti.join(' '),
      stile: i % 2 === 0 ? traccia(C1, 3, 0.9) : traccia(C2, 2, 0.8),
    };
  });
}

function altoparlante(caso: () => number, densita: number): ElementoMotivo[] {
  const numero = 5 + densita * 2;
  const cx = n(90 + caso() * 220);
  const cy = n(60 + caso() * 60);
  const elementi: ElementoMotivo[] = [];
  for (let i = numero; i >= 1; i -= 1) {
    const r = n(8 + (i / numero) ** 1.4 * 110);
    elementi.push({
      tipo: 'circle',
      cx,
      cy,
      r,
      stile: traccia(i % 2 ? C1 : C2, i === 1 ? 6 : 2, n(0.4 + (1 - i / numero) * 0.5)),
    });
  }
  elementi.push({ tipo: 'circle', cx, cy, r: 8, stile: { fill: C1 } });
  return elementi;
}

function tram(caso: () => number, densita: number): ElementoMotivo[] {
  const fili = 3 + densita;
  const pali = [40, 150, 260, 370];
  const elementi: ElementoMotivo[] = pali.map((x) => ({
    tipo: 'path' as const,
    d: `M${x} 10 L${x} 250`,
    stile: traccia(C2, 4, 0.7),
  }));
  for (let i = 0; i < fili; i += 1) {
    const y = 30 + i * 18 + caso() * 6;
    const curva = 14 + caso() * 16;
    const tratti = pali
      .slice(1)
      .map((x, k) => `Q${n(((pali[k] ?? 0) + x) / 2)} ${n(y + curva)} ${x} ${n(y)}`)
      .join(' ');
    elementi.push({
      tipo: 'path',
      d: `M-20 ${n(y)} L40 ${n(y)} ${tratti} L460 ${n(y)}`,
      stile: traccia(i % 2 ? C2 : C1, i === 0 ? 2.5 : 1.5, 0.85),
    });
  }
  return elementi;
}

function scia(caso: () => number, densita: number): ElementoMotivo[] {
  const numero = 6 + densita * 2;
  return Array.from({ length: numero }, (_, i) => {
    const y0 = 20 + caso() * 140;
    const y1 = y0 + 40 + caso() * 80;
    const controllo = y0 - 40 + caso() * 80;
    return {
      tipo: 'path' as const,
      d: `M-40 ${n(y0)} Q200 ${n(controllo)} 440 ${n(y1)}`,
      stile: traccia(i % 3 === 0 ? C2 : C1, n(1 + caso() * 3), n(0.45 + caso() * 0.5)),
    };
  });
}

function costellazione(caso: () => number, densita: number): ElementoMotivo[] {
  const numero = 10 + densita * 3;
  const punti = Array.from({ length: numero }, () => ({
    x: n(20 + caso() * 360),
    y: n(15 + caso() * 150),
  }));
  const uniti = punti.slice(0, 6).sort((a, b) => a.x - b.x);
  const elementi: ElementoMotivo[] = [
    {
      tipo: 'path',
      d: uniti.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' '),
      stile: traccia(C1, 2, 0.55),
    },
  ];
  punti.forEach((p, i) =>
    elementi.push({
      tipo: 'circle',
      cx: p.x,
      cy: p.y,
      r: i < 6 ? 4.5 : n(2 + caso() * 1.5),
      stile: { fill: C1 },
    }),
  );
  return elementi;
}

function neon(caso: () => number, densita: number): ElementoMotivo[] {
  const numero = 2 + densita;
  const elementi: ElementoMotivo[] = [];
  for (let i = 0; i < numero; i += 1) {
    const x = 50 + caso() * 300;
    const y = 30 + caso() * 100;
    const r = 24 + caso() * 30;
    const forme = [
      `M${n(x - r)} ${n(y + r)} A${n(r)} ${n(r)} 0 0 1 ${n(x + r)} ${n(y + r)}`,
      `M${n(x + r)} ${n(y - r)} A${n(r)} ${n(r)} 0 1 0 ${n(x + r)} ${n(y + r)}`,
      `M${n(x - r)} ${n(y)} L${n(x - r / 2)} ${n(y - r / 2)} L${n(x)} ${n(y)} L${n(x + r / 2)} ${n(y - r / 2)} L${n(x + r)} ${n(y)}`,
      `M${n(x - r)} ${n(y)} A${n(r)} ${n(r)} 0 0 0 ${n(x + r)} ${n(y)}`,
    ];
    const d = forme[Math.floor(caso() * forme.length)] ?? forme[0] ?? '';
    const colore = i % 2 ? C2 : C1;
    elementi.push({ tipo: 'path', d, stile: traccia(colore, 12, 0.22) });
    elementi.push({ tipo: 'path', d, stile: traccia(colore, 3, 0.95) });
  }
  return elementi;
}

const DISEGNI: Record<Motivo, (caso: () => number, densita: number) => ElementoMotivo[]> = {
  lampioni,
  finestre,
  onde,
  altoparlante,
  tram,
  scia,
  costellazione,
  neon,
};

/** Elementi del motivo: stesso seme, stessi elementi su ogni dispositivo. */
export function elementiMotivo(p: ParametriCopertina): ElementoMotivo[] {
  return DISEGNI[p.motivo](mulberry32(p.hash), p.densita);
}
