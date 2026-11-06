/**
 * Testi delle notifiche sul telefono (design/F-22-notifiche): consenso esplicito, "Attiva" e
 * "Non ora" con lo stesso peso, nessun richiamo né pressione (R-43). I testi che arrivano sulla
 * schermata di blocco sono in supabase/functions/_shared/testi_push.ts.
 */

export const push = {
  foglio: {
    sopratitolo: 'Notifiche',
    titolo: 'Ricevi le notifiche sul telefono',
    intro: 'Sono spente finché non le accendi tu. Ecco cosa arriva, e cosa no.',
    cosaArriva: 'Cosa arriva',
    arriva: [
      'Richieste di amicizia',
      'Inviti e novità dei tuoi gruppi e delle serate',
      'Check-in degli amici che ti scelgono',
      'Esiti di moderazione: flyer e segnalazioni',
    ],
    cosaNo: 'Cosa non arriva mai',
    no: [
      'Pubblicità',
      'Richiami come «non ti vediamo da un po’»',
      'Nomi e testi di altre persone sulla schermata di blocco',
    ],
    spegni: 'Puoi spegnerle quando vuoi, in Profilo › Privacy e dati.',
    nonOra: 'Non ora',
    attiva: 'Attiva',
    attesa: {
      titolo: 'Ora rispondi alla richiesta del telefono',
      testo:
        'Il telefono ti chiede se Noxa può mandarti notifiche. Scegli tu: qui non cambia niente finché non rispondi.',
    },
    attive: {
      titolo: 'Notifiche attive',
      avviso: 'Notifiche attive su questo dispositivo',
      testo: 'Le spegni quando vuoi in Profilo › Privacy e dati.',
      anteprima: 'Così appaiono sulla schermata di blocco',
      esempioTitolo: 'Un amico ha fatto check-in',
      esempioTesto: 'Apri Noxa per vedere dove.',
      ora: 'ora',
      nota: 'Mai nomi né testi di altre persone: i dettagli li vedi solo aprendo l’app.',
      fatto: 'Fatto',
    },
    negato: {
      titolo: 'Notifiche bloccate',
      avviso: 'Il telefono ha bloccato le notifiche',
      testo: 'Noxa non può chiederlo di nuovo. Se cambi idea, le riaccendi nelle impostazioni.',
      nota: 'Intanto le notifiche restano nell’app, nella campanella.',
    },
    nonCompatibile: {
      titolo: 'Qui non possono arrivare',
      avviso: 'Questo browser non riceve notifiche',
      testo:
        'Non è colpa tua: non le supporta. Le trovi comunque nell’app, nella campanella. Con un browser aggiornato puoi riprovare.',
    },
    iphone: {
      titolo: 'Prima aggiungi Noxa alla Home',
      avviso: 'Su iPhone serve Noxa sulla schermata Home',
      testo: 'Da Safari le notifiche non arrivano. Bastano due passi:',
      passi: [
        { prima: 'Tocca ', grassetto: 'Condividi', dopo: ' nella barra di Safari' },
        { prima: 'Scegli ', grassetto: 'Aggiungi alla schermata Home', dopo: '' },
      ],
      poi: 'Poi apri Noxa dalla Home e accendile da Privacy e dati.',
    },
    errore: {
      titolo: 'Non siamo riusciti ad attivarle',
      testo:
        'Il permesso c’è, ma la registrazione del dispositivo non è andata. Riprova tra un attimo.',
    },
    hoCapito: 'Ho capito',
    riprova: 'Riprova',
  },
  /** Percorsi delle impostazioni del browser e del telefono, mostrati come etichette. */
  percorsi: [
    ['icona accanto all’indirizzo', 'Impostazioni sito', 'Notifiche', 'Consenti'],
    ['Impostazioni del telefono', 'Notifiche', 'Noxa o il browser'],
  ],
  impostazioni: {
    sezione: 'Notifiche',
    titolo: 'Notifiche sul telefono',
    testo:
      'Richieste di amicizia, gruppi e serate, check-in degli amici, esiti di moderazione. Sulla schermata di blocco mai nomi né testi di altre persone.',
    spento: 'Spento finché non lo accendi tu.',
    acceso: 'Acceso su questo dispositivo.',
    negato: 'Spento: il permesso è bloccato nelle impostazioni, vedi sotto.',
    offline: 'Sei offline: per cambiarlo serve la rete.',
    negatoAvviso: {
      titolo: 'Le notifiche sono bloccate dal browser',
      testo: 'Da qui non possiamo riaccenderle: lo decidi tu nelle impostazioni.',
    },
    iphone: {
      titolo: 'Su iPhone serve Noxa sulla schermata Home',
      testo:
        'Da Safari le notifiche non arrivano. Aggiungi Noxa alla Home, aprila da lì e accendile qui.',
    },
    nonCompatibile: 'Questo browser non riceve notifiche: restano nell’app, nella campanella.',
    dispositivi: 'Dispositivi',
    conteggio: (n: number) => (n === 1 ? '1 dispositivo' : `${n} dispositivi`),
    nessuno: 'Nessun dispositivo. Le notifiche restano nell’app, nella campanella.',
    questo: 'Questo dispositivo',
    attivoOra: 'attivo ora',
    ultimoUso: (data: string) => `ultimo uso ${data}`,
    togli: 'Togli',
    togliDispositivo: (nome: string) => `Togli ${nome}`,
    tolto: 'Dispositivo tolto: lì le notifiche non arrivano più.',
    nonTolto: 'Il dispositivo non si è tolto. Riprova.',
    nota: 'Le notifiche restano anche nell’app per 90 giorni. Togliere un dispositivo spegne le notifiche solo lì.',
    caricamento: 'Carico le notifiche',
    salvataggio: (acceso: boolean) =>
      `L’interruttore è tornato com’era: ${acceso ? 'acceso' : 'spento'}. Riprova tra un attimo.`,
    attivate: 'Notifiche attive su questo dispositivo',
    spente: 'Notifiche spente su questo dispositivo',
  },
  /** Etichette generiche dei dispositivi, scritte dall'app: niente modello né versione. */
  dispositivo: {
    home: 'Telefono · Noxa dalla Home',
    app: 'Android · app Noxa',
    browser: (sistema: string, browser: string) => `${sistema} · ${browser}`,
    computer: (browser: string) => `Browser · ${browser} su computer`,
    generico: 'Browser',
  },
  elenco: {
    invito: 'Vuoi riceverle anche sul telefono?',
    attiva: 'Attiva',
    nascondi: 'Non mostrare più',
    nonDisponibile: 'Non è più disponibile.',
  },
} as const;
