import { z } from 'zod';

/**
 * Variabili pubbliche dell'app (.env.example). Next le inserisce nel bundle solo se lette
 * per nome intero, quindi ognuna è scritta qui per esteso. Mai chiavi segrete (CLAUDE.md).
 */
const SchemaAmbiente = z.object({
  supabaseUrl: z.url(),
  supabaseChiaveAnon: z.string().min(1),
});

export type Ambiente = z.infer<typeof SchemaAmbiente>;

let ambiente: Ambiente | undefined;

/**
 * Legge e valida le variabili di Supabase alla prima chiamata nel browser: un errore di
 * configurazione è subito chiaro.
 */
export function leggiAmbiente(): Ambiente {
  ambiente ??= SchemaAmbiente.parse({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseChiaveAnon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return ambiente;
}

/**
 * Chiave del sito di Cloudflare Turnstile: vuota in locale, dove Supabase non chiede il
 * CAPTCHA. Si legge anche durante il prerender, quindi non lancia errori.
 */
export function chiaveTurnstile(): string | undefined {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined;
}
