import { z } from 'zod';

/** Risposta della RPC public.mio_account (DATA_MODEL.md §5.10). */
export const SchemaAccount = z.object({
  username: z.string(),
  nome_visualizzato: z.string(),
  stato_account: z.enum(['attivo', 'sospeso']),
  minorenne: z.boolean(),
  onboarding_completato: z.boolean(),
  documenti_da_accettare: z.array(
    z.object({
      tipo: z.enum(['termini', 'privacy']),
      versione: z.string(),
      in_vigore_dal: z.string(),
      novita: z.array(z.string()),
    }),
  ),
});

export type Account = z.infer<typeof SchemaAccount>;
export type DocumentoDaAccettare = Account['documenti_da_accettare'][number];

export const USERNAME = /^[a-z0-9_.]{3,20}$/;
export const LUNGHEZZA_MINIMA_PASSWORD = 10;
export const LUNGHEZZA_MASSIMA_USERNAME = 20;
export const LUNGHEZZA_MASSIMA_NOME = 40;

export const SchemaEmail = z.email();
