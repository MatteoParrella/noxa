import { z } from 'zod';
import { distanzaMetri } from './posizione';

/**
 * Dati del ritorno sicuro che restano **solo su questo telefono** (R-32, ADR-0006): le aree di
 * arrivo (nome scelto da te, centro e raggio) e, per il ritorno avviato qui, la tratta e l'area
 * scelta. Non si inviano mai al server e non entrano nei log né in Sentry. Ogni accesso allo
 * storage può fallire (navigazione privata): si torna ai valori vuoti.
 */

const CHIAVE_AREE = 'noxa-aree-arrivo';
const CHIAVE_SESSIONE = 'noxa-ritorno-locale';
export const EVENTO_AREE = 'noxa:aree-arrivo';

export const RAGGI = [100, 150, 300] as const;
export type Raggio = (typeof RAGGI)[number];
export const RAGGIO_PREDEFINITO: Raggio = 150;
export const MASSIMO_AREE = 10;

const SchemaArea = z.object({
  id: z.string().min(1).max(40),
  nome: z.string().min(1).max(30),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  raggio: z.union([z.literal(100), z.literal(150), z.literal(300)]),
});
export type AreaArrivo = z.infer<typeof SchemaArea>;

function leggi<T>(chiave: string, schema: z.ZodType<T>, vuoto: T): T {
  try {
    const grezzo = window.localStorage.getItem(chiave);
    if (!grezzo) return vuoto;
    const esito = schema.safeParse(JSON.parse(grezzo));
    return esito.success ? esito.data : vuoto;
  } catch {
    return vuoto;
  }
}

function scrivi(chiave: string, valore: unknown): boolean {
  try {
    if (valore === null) window.localStorage.removeItem(chiave);
    else window.localStorage.setItem(chiave, JSON.stringify(valore));
    return true;
  } catch {
    return false;
  }
}

export function leggiAree(): AreaArrivo[] {
  return leggi(CHIAVE_AREE, z.array(SchemaArea), []);
}

function salvaAree(aree: AreaArrivo[]): boolean {
  const fatto = scrivi(CHIAVE_AREE, aree);
  if (fatto) window.dispatchEvent(new Event(EVENTO_AREE));
  return fatto;
}

/** Aggiunge un'area; false se lo storage non è disponibile o se ce ne sono già 10. */
export function aggiungiArea(area: Omit<AreaArrivo, 'id'>): boolean {
  const aree = leggiAree();
  if (aree.length >= MASSIMO_AREE) return false;
  const nuova = SchemaArea.safeParse({ ...area, nome: area.nome.trim(), id: crypto.randomUUID() });
  if (!nuova.success) return false;
  return salvaAree([...aree, nuova.data]);
}

export function eliminaArea(id: string): void {
  salvaAree(leggiAree().filter((area) => area.id !== id));
}

/** Area in cui si trova la posizione, tenendo conto della precisione (al massimo 100 m). */
export function areaRaggiunta(
  area: AreaArrivo,
  posizione: { lat: number; lon: number; precisione: number },
): boolean {
  return distanzaMetri(area, posizione) <= area.raggio + Math.min(posizione.precisione, 100);
}

const SchemaSessione = z.object({
  ritornoId: z.uuid(),
  partenza: z.string().max(80).nullable(),
  areaId: z.string().nullable(),
});
export type SessioneLocale = z.infer<typeof SchemaSessione>;

/** Il ritorno avviato su questo telefono: solo qui si condivide la posizione. */
export function leggiSessioneLocale(): SessioneLocale | null {
  return leggi(CHIAVE_SESSIONE, SchemaSessione.nullable(), null);
}

export function salvaSessioneLocale(sessione: SessioneLocale | null): void {
  scrivi(CHIAVE_SESSIONE, sessione);
}
