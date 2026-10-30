/**
 * Versioni di termini e informativa mostrate dall'app (R-63). Devono coincidere con le
 * versioni in vigore in private.versioni_documenti: una nuova versione si pubblica con una
 * migrazione e, nella stessa PR, con i nuovi testi in /termini e /privacy e qui.
 */
export const VERSIONI_DOCUMENTI = {
  termini: '2026-10',
  privacy: '2026-11',
} as const;

/** Data di entrata in vigore delle versioni sopra, mostrata nell'informativa in breve. */
export const IN_VIGORE_DAL = {
  termini: '16.10.2026',
  privacy: '27.10.2026',
} as const;

export const PERCORSI = {
  benvenuto: '/benvenuto/',
  registrazione: '/registrazione/',
  verifica: '/registrazione/verifica/',
  accesso: '/accesso/',
  conferma: '/accesso/conferma/',
  recupero: '/accesso/password/',
  nuovaPassword: '/accesso/nuova-password/',
  sicurezza: '/sicurezza/',
  termini: '/termini/',
  privacy: '/privacy/',
  home: '/scopri/',
} as const;
