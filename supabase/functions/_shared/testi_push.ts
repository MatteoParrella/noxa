// Testi delle notifiche sul telefono (F-22, design/F-22-notifiche §3): scritti da Noxa, uno per
// tipo, senza nomi, username o testi di altre persone. Dai `dati` della notifica si legge solo
// l'esito della moderazione, un valore di un elenco chiuso: nessun altro campo finisce nel
// testo. I dettagli si leggono aprendo l'app.

export type TestoPush = { titolo: string; testo: string };

const PER_TIPO: Record<string, TestoPush> = {
  richiesta_amicizia: {
    titolo: 'Nuova richiesta di amicizia',
    testo: 'Hai una nuova richiesta di amicizia. Aprila in Noxa.',
  },
  amicizia_accettata: {
    titolo: 'Richiesta accettata',
    testo: 'Una persona ha accettato la tua richiesta di amicizia.',
  },
  invito_gruppo: { titolo: 'Invito in un gruppo', testo: 'Hai un nuovo invito in un gruppo.' },
  nuova_serata: {
    titolo: 'Nuova serata in un tuo gruppo',
    testo: 'C’è una serata proposta in un tuo gruppo.',
  },
  aggiornamento_serata: {
    titolo: 'Novità su una serata',
    testo: 'Ci sono aggiornamenti: aprila per vederli.',
  },
  rimozione_gruppo: { titolo: 'Non fai più parte di un gruppo', testo: 'Apri Noxa per i dettagli.' },
  checkin_amico: { titolo: 'Un amico ha fatto check-in', testo: 'Apri Noxa per vedere dove.' },
  ritorno_avviato: {
    titolo: 'Un amico sta tornando a casa',
    testo: 'Apri Noxa per seguire il ritorno sicuro.',
  },
  ritorno_allerta: {
    titolo: 'Un amico non è ancora arrivato',
    testo: 'Apri Noxa per vedere il ritorno sicuro.',
  },
  ritorno_arrivato: { titolo: 'Un amico è arrivato', testo: 'Il ritorno sicuro è concluso.' },
  badge_ottenuto: { titolo: 'Nuovo badge', testo: 'Apri Noxa per vederlo.' },
  riepilogo_pronto: { titolo: 'Il tuo riepilogo è pronto', testo: 'Apri Noxa per vederlo.' },
};

const PER_ESITO: Record<string, TestoPush> = {
  flyer_pubblicato: { titolo: 'Il tuo flyer è stato pubblicato', testo: 'Ora lo vedono tutti in Scopri.' },
  flyer_unito: { titolo: 'Il tuo flyer è stato aggiunto a un evento', testo: 'Apri Noxa per vederlo.' },
  flyer_rifiutato: {
    titolo: 'Il tuo flyer non è stato pubblicato',
    testo: 'Trovi il motivo in Noxa. Puoi presentare reclamo.',
  },
  segnalazione_decisa: {
    titolo: 'Abbiamo deciso sulla tua segnalazione',
    testo: 'Apri Noxa per leggere la decisione.',
  },
  contenuto_rimosso: {
    titolo: 'Abbiamo rimosso un tuo contenuto',
    testo: 'Trovi il motivo e come fare reclamo in Noxa.',
  },
  contenuto_nascosto: {
    titolo: 'Un tuo contenuto è nascosto',
    testo: 'È in attesa di un controllo. Trovi i dettagli in Noxa.',
  },
  contenuto_ripristinato: {
    titolo: 'Un tuo contenuto è di nuovo visibile',
    testo: 'Apri Noxa per i dettagli.',
  },
  account_sospeso: { titolo: 'Il tuo account è sospeso', testo: 'Trovi il motivo in Noxa.' },
  reclamo_deciso: { titolo: 'Abbiamo deciso sul tuo reclamo', testo: 'Apri Noxa per leggere la decisione.' },
};

const ESITO_GENERICO: TestoPush = {
  titolo: 'Novità dalla moderazione',
  testo: 'Apri Noxa per leggere la decisione.',
};

/** Testo di sistema per una notifica, o null per un tipo sconosciuto (non si invia). */
export function testoPush(tipo: string, dati: Record<string, unknown>): TestoPush | null {
  if (tipo === 'esito_moderazione') {
    const esito = typeof dati.esito === 'string' ? dati.esito : '';
    return PER_ESITO[esito] ?? ESITO_GENERICO;
  }
  return PER_TIPO[tipo] ?? null;
}

/**
 * Per quanto il servizio push conserva la notifica se il telefono è spento: un check-in dura
 * 6 ore, le altre notifiche restano utili per un giorno.
 */
export function durataPush(tipo: string): number {
  return tipo === 'checkin_amico' || tipo.startsWith('ritorno_') ? 6 * 60 * 60 : 24 * 60 * 60;
}

/** Le allerte del ritorno sicuro hanno urgenza alta, le altre normale (RFC 8030 §5.3). */
export function urgenzaPush(tipo: string): 'normal' | 'high' {
  return tipo === 'ritorno_allerta' ? 'high' : 'normal';
}

/** Tutti i testi, per i test che verificano l'assenza di nomi e username. */
export const TUTTI_I_TESTI: readonly TestoPush[] = [
  ...Object.values(PER_TIPO),
  ...Object.values(PER_ESITO),
  ESITO_GENERICO,
];
