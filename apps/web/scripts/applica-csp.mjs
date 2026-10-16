// Content Security Policy dell'app (ARCHITECTURE.md §9). Gira dopo `next build`, prima del
// service worker: per ogni pagina dell'export statico calcola l'hash SHA-256 degli script
// inline (tema e dati di Next) e inserisce un <meta http-equiv="Content-Security-Policy">.
// Il meta vale sia sul web (Vercel) sia nelle app Capacitor, dove gli header HTTP non
// esistono; vercel.json aggiunge le direttive che un meta non può esprimere (frame-ancestors).
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import nextEnv from '@next/env';

// Stesse variabili della build (next.config.ts): l'ambiente ha la precedenza sul .env.
nextEnv.loadEnvConfig(path.resolve(process.cwd(), '../..'), false, console, true);

const CARTELLA = 'out';
const TURNSTILE = 'https://challenges.cloudflare.com';

/** Origine di un URL di ambiente, o null se la variabile manca. */
function origine(valore) {
  if (!valore) return null;
  try {
    return new URL(valore).origin;
  } catch {
    throw new Error(`URL non valido nelle variabili d'ambiente: ${valore}`);
  }
}

const supabase = origine(process.env.NEXT_PUBLIC_SUPABASE_URL);
const mappa = origine(process.env.NEXT_PUBLIC_MAPPA_PMTILES_URL);
const supabaseRealtime = supabase?.replace(/^http/, 'ws') ?? null;

const esterne = (...origini) => [...new Set(origini.filter(Boolean))].join(' ');

function politica(hash) {
  const direttive = {
    'default-src': "'self'",
    'script-src': `'self' ${hash.map((valore) => `'sha256-${valore}'`).join(' ')} ${TURNSTILE}`,
    // Gli attributi style di React (variabili CSS del movimento) richiedono 'unsafe-inline'.
    'style-src': "'self' 'unsafe-inline'",
    'img-src': esterne("'self' data: blob:", supabase),
    'font-src': "'self' data:",
    'connect-src': esterne("'self'", supabase, supabaseRealtime, mappa),
    'frame-src': TURNSTILE,
    'worker-src': "'self' blob:",
    'manifest-src': "'self'",
    'base-uri': "'self'",
    'form-action': "'self'",
    'object-src': "'none'",
  };
  return Object.entries(direttive)
    .map(([nome, valore]) => `${nome} ${valore.replace(/\s+/g, ' ').trim()}`)
    .join('; ');
}

async function* pagine(cartella) {
  for (const voce of await readdir(cartella, { withFileTypes: true })) {
    const percorso = path.join(cartella, voce.name);
    if (voce.isDirectory()) yield* pagine(percorso);
    else if (voce.name.endsWith('.html')) yield percorso;
  }
}

const SCRIPT_INLINE = /<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g;

let quante = 0;
for await (const file of pagine(CARTELLA)) {
  const html = await readFile(file, 'utf8');
  if (html.includes('http-equiv="Content-Security-Policy"')) continue;
  const hash = new Set();
  for (const [, attributi, contenuto] of html.matchAll(SCRIPT_INLINE)) {
    // Gli script di dati (type="application/json") non vengono eseguiti.
    if (/type="application\/(ld\+)?json"/.test(attributi)) continue;
    hash.add(createHash('sha256').update(contenuto, 'utf8').digest('base64'));
  }
  const meta = `<meta http-equiv="Content-Security-Policy" content="${politica([...hash])}"/>`;
  // Subito dopo la dichiarazione della codifica, che deve restare nei primi 1024 byte.
  const conMeta = html.replace(/<meta charSet="utf-8"\/>/i, (codifica) => `${codifica}${meta}`);
  if (conMeta === html) throw new Error(`Nessun <meta charSet> in ${file}`);
  await writeFile(file, conMeta);
  quante += 1;
}

process.stdout.write(`Content Security Policy: ${quante} pagine\n`);
