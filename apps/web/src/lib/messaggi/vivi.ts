/**
 * Testi dell'area Vivi e del check-in "sono qui" (design/F-20-checkin): "tu", frasi brevi,
 * nessuna parola di controllo ("traccia", "segui") e nessuna pressione sociale (R-43).
 */

const amici = (n: number) => (n === 1 ? '1 amico' : `${n} amici`);
/** "lo vede 1 amico", "lo vedono 2 amici". */
const loVede = (n: number) => (n === 1 ? 'lo vede 1 amico' : `lo vedono ${n} amici`);
const LoVede = (n: number) => (n === 1 ? 'Lo vede 1 amico' : `Lo vedono ${n} amici`);

/** "Giulia R.", "Giulia R. e Marco B.", "Giulia R., Marco B. e Sara C." */
export function elencoNomi(nomi: readonly string[]): string {
  if (nomi.length <= 1) return nomi[0] ?? '';
  return `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}`;
}

export const vivi = {
  sottotitolo: 'Durante la serata',
  titolo: 'Vivi',
  stasera: 'Stasera',
  caricamento: 'Carico l’area Vivi',
  errore: {
    titolo: 'Vivi non si è caricato',
    testo: 'Se hai un check-in attivo, resta attivo. Riprova tra un attimo.',
  },
  offline: 'Sei offline: il check-in non parte senza rete.',
  aggiornato: (ora: string) => `Agg. ${ora}`,
  spento: {
    etichetta: 'Check-in «sono qui»',
    titolo: 'Dì ad alcuni amici in quale locale sei',
    testo: 'Così vi ritrovate senza scrivervi. Non è una mappa e non segue nessuno.',
    punti: [
      { titolo: 'Solo il locale', testo: 'Lo scegli tu per nome. Mai la tua posizione esatta.' },
      { titolo: 'Solo a chi scegli', testo: 'Amici confermati, scelti ogni volta.' },
      { titolo: 'Per 6 ore', testo: 'Poi sparisce per tutti. Puoi terminarlo prima in un tocco.' },
    ],
    attiva: 'Attiva il check-in',
    nota: 'È spento finché non lo accendi tu, in Profilo › Privacy e dati.',
  },
  mio: {
    etichetta: 'Il tuo check-in',
    invito: 'Dì ad alcuni amici in quale locale sei. Lo vedono per 6 ore, solo quelli che scegli.',
    fai: 'Fai check-in',
    offline: 'Senza rete il check-in non parte: nessuno lo riceverebbe.',
    bollo: ['Sono', 'qui'],
    dalle: (ora: string) => `Dalle ${ora}`,
    finoAlle: (ora: string) => `Fino alle ${ora}`,
    loVedono: LoVede,
    andatoVia: 'Sono andato via',
    chiLoVede: 'Chi lo vede',
    terminato: 'Check-in terminato. Nessuno lo vede più.',
    nonTerminato: 'Il check-in non si è terminato. Riprova.',
  },
  amici: {
    etichetta: 'Amici in giro stasera',
    vuoto: 'Nessun amico ha condiviso dove si trova.',
    dalle: (ora: string) => `Dalle ${ora}`,
    eA: 'è a',
    apri: (nome: string, locale: string) => `${nome} è a ${locale}: apri`,
  },
  fai: {
    titolo: 'Fai check-in',
    passo: (n: number) => `Passo ${n} di 3`,
    cambia: 'Cambia',
    continua: 'Continua',
    dove: {
      titolo: 'Dove',
      perStasera: 'Per stasera',
      partecipi: 'Partecipi stasera',
      serata: (titolo: string) => `Serata di gruppo · ${titolo}`,
      cerca: 'Oppure cerca un locale per nome',
      segnaposto: 'Nome del locale',
      nessuno: 'Nessun locale con questo nome nel catalogo.',
      cercaErrore: 'La ricerca non ha funzionato. Riprova.',
      privacy: 'Non usiamo la posizione del telefono: il locale lo scegli tu.',
      senzaEvento: 'Stasera qui non c’è un evento in Noxa: i tuoi amici vedono solo il locale.',
      togli: 'Togli il locale scelto',
      scegli: 'Scegli un locale per continuare.',
    },
    chi: {
      titolo: 'Chi lo vede',
      dallaSerata: (titolo: string) => `Dalla serata ${titolo}`,
      altri: 'Altri amici',
      cerca: 'Cerca tra i tuoi amici',
      regola: 'Solo amici confermati. Serve almeno una persona.',
      nessunAmico:
        'Non hai ancora amici confermati. Il check-in si condivide solo con loro: aggiungili da Amici.',
      nessunRisultato: 'Nessun amico con questo nome.',
      selezionati: (n: number) => (n === 1 ? '1 amico selezionato' : `${n} amici selezionati`),
      conteggio: amici,
      caricamento: 'Carico i tuoi amici',
      errore: 'Gli amici non si sono caricati. Riprova.',
    },
    riepilogo: {
      titolo: 'Riepilogo',
      testo: (locale: string, nomi: string, ora: string) =>
        `${locale} · lo vedono ${nomi} fino alle ${ora}.`,
      durata: (ora: string) => `Dalle ${ora} · 6 ore`,
      nota: 'Dopo 6 ore sparisce per tutti. Puoi terminarlo prima con «Sono andato via».',
      invia: 'Fai check-in',
    },
    fatto: (n: number) => `Check-in fatto: ${loVede(n)}.`,
    esclusi: {
      titolo: (nomi: string) => `Abbiamo tolto ${nomi}`,
      testo: 'Non è più tra i tuoi amici, quindi non vede il check-in.',
    },
    errori: {
      rete: {
        titolo: 'Il check-in non è partito',
        testo: 'Manca la rete, quindi nessuno lo vede. Riprova quando sei connesso.',
      },
      spento: {
        titolo: 'Il check-in è stato spento',
        testo:
          'L’hai spento in Privacy e dati da un altro dispositivo. Se vuoi farlo, riaccendilo prima.',
        azione: 'Vai a Privacy e dati',
      },
      giaAttivo: {
        titolo: 'Hai già un check-in attivo',
        testo: 'Per cambiare locale terminalo e fanne uno nuovo.',
      },
      troppi: {
        titolo: 'Hai fatto molti check-in oggi',
        testo: 'Ne puoi fare al massimo 10 in 24 ore. Riprova più tardi.',
      },
      locale: {
        titolo: 'Questo locale non è disponibile',
        testo: 'Scegline un altro.',
      },
      senzaAmici: {
        titolo: 'Nessuno tra i destinatari è tuo amico',
        testo: 'Scegli almeno un amico confermato.',
      },
      generico: {
        titolo: 'Il check-in non è partito',
        testo: 'Non è colpa tua: riprova tra un attimo.',
      },
    },
    suggerimentoPush: 'Vuoi saperlo quando un amico fa check-in? Attiva le notifiche sul telefono.',
    suggerimentoPushAzione: 'Attiva',
  },
  chiLoVede: {
    sopratitolo: 'Il tuo check-in',
    titolo: 'Chi lo vede',
    luogo: (locale: string, ora: string) => `${locale} · fino alle ${ora}`,
    destinatari: 'Destinatari',
    conteggio: amici,
    togli: 'Togli',
    togliPersona: (nome: string) => `Togli ${nome}`,
    annulla: 'Annulla',
    conferma: (nome: string) => `Togliere ${nome}?`,
    confermaTesto: 'Il check-in sparisce subito dal suo telefono.',
    ultima: 'È l’ultima persona: se la togli, il check-in termina per tutti.',
    togliETermina: 'Togli e termina',
    nota: 'Togliendo una persona, il check-in sparisce subito dal suo telefono. Se togli l’ultima, il check-in termina.',
    tolta: (nome: string) => `${nome} non vede più il tuo check-in.`,
    terminato: 'Check-in terminato. Nessuno lo vede più.',
    errore: 'Non siamo riusciti a togliere la persona. Riprova.',
    nessuno: {
      titolo: 'Nessun check-in attivo',
      testo: 'Quando fai check-in, qui vedi chi lo riceve.',
      azione: 'Torna a Vivi',
    },
  },
  impostazione: {
    titolo: 'Check-in «sono qui»',
    testo:
      'Quando fai check-in, gli amici che scegli vedono in quale locale sei per 6 ore. Mai la tua posizione esatta. Dopo 24 ore dalla fine lo cancelliamo.',
    spento: 'Spento finché non lo accendi tu.',
    acceso: 'Acceso. Ogni check-in lo fai tu, dall’area Vivi.',
    offline: 'Sei offline: per cambiarlo serve la rete.',
    spegni: {
      titolo: 'Spegnere il check-in?',
      testo: (locale: string, nomi: string) =>
        `Quello attivo a ${locale} termina subito: ${nomi} non lo vedono più.`,
      annulla: 'Annulla',
      conferma: 'Spegni',
    },
  },
  notifica: {
    titolo: (nome: string, locale: string) => `${nome} è a ${locale}`,
    dalle: (ora: string) => `Dalle ${ora}`,
    vediLocale: 'Vedi locale',
    terminato: 'Check-in terminato',
    terminatoTesto: 'Un amico aveva condiviso dove si trovava.',
  },
} as const;
