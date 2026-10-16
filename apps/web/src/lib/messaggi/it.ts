/**
 * Testi dell'app in italiano (DESIGN.md §6: "tu", frasi brevi, niente pressione). I testi
 * delle schermate di accesso vengono da design/F-10-accesso.
 */
export const messaggi = {
  comune: {
    indietro: 'Indietro',
    avanti: 'Avanti',
    riprova: 'Riprova',
    chiudi: 'Chiudi',
    mostra: 'Mostra',
    nascondi: 'Nascondi',
    caricamentoAccount: 'Carico il tuo account',
    erroreRete: {
      titolo: 'Non riusciamo a raggiungere Noxa',
      testo: 'Controlla la connessione e riprova. Non hai perso niente.',
    },
    erroreSconosciuto: {
      titolo: 'Qualcosa non ha funzionato',
      testo: 'Riprova tra poco. Se succede ancora, scrivici dal profilo.',
    },
    limite: {
      titolo: 'Troppi tentativi',
      testo: 'Riprova tra qualche minuto.',
    },
  },

  benvenuto: {
    luogo: 'Milano · Brianza',
    marchio: 'noxa',
    frase: 'Le tue serate a Milano e in Brianza, dall’idea al ritorno a casa.',
    aree: ['Scopri', 'Organizza', 'Vivi', 'Ricorda'],
    creaAccount: 'Crea un account',
    hoGiaUnAccount: 'Ho già un account',
    termini: 'Termini',
    privacy: 'Informativa privacy',
  },

  registrazione: {
    passo: (passo: number, totale: number) => `${passo} di ${totale}`,
    passoAccessibile: (passo: number, totale: number) => `Passo ${passo} di ${totale}`,
    data: {
      etichettaSezione: 'Iniziamo',
      titolo: 'Quando sei nata o nato?',
      campo: 'Data di nascita',
      segnaposto: 'gg.mm.aaaa',
      aiuto:
        'Ci serve per mostrarti solo eventi adatti alla tua età. Non potrai cambiarla e nessuno la vedrà.',
      apriCalendario: 'Apri il calendario',
      mancante: 'Scrivi la tua data di nascita, per esempio 14.03.2009.',
      formato: 'Scrivi la data come gg.mm.aaaa, per esempio 14.03.2009.',
      inesistente: (anno: number, mese: string, giorni: number) =>
        `Questa data non esiste: nel ${anno} ${mese} ha ${giorni} giorni. Controlla il giorno.`,
      meseInesistente: 'Questa data non esiste: i mesi vanno da 01 a 12.',
      futura: 'Questa data è nel futuro: controlla l’anno.',
      troppoLontana: 'Controlla l’anno: deve essere dopo il 1900.',
    },
    calendario: {
      titolo: 'Data di nascita',
      mese: 'Mese',
      anno: 'Anno',
      annulla: 'Annulla',
      conferma: 'Conferma',
      giorniSettimana: ['Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa', 'Do'],
    },
    credenziali: {
      etichettaSezione: 'Il tuo accesso',
      titolo: 'Email e password',
      email: 'Email',
      emailAiuto: 'Ti mandiamo un link per verificarla.',
      emailNonValida: 'Scrivi un’email valida, per esempio giulia.rota@example.com.',
      password: 'Password',
      requisitoLunghezza: 'Almeno 10 caratteri',
      requisitoDiversa: 'Diversa da email e username',
      requisitoNonSoddisfatto: 'requisito non ancora soddisfatto',
      requisitoSoddisfatto: 'requisito soddisfatto',
      passwordCorta: 'La password deve avere almeno 10 caratteri.',
      passwordUgualeEmail: 'La password non può contenere la tua email: scegline un’altra.',
      passwordViolata:
        'Questa password è comparsa in una violazione di dati: scegline un’altra. Prova una frase di tre o quattro parole che sai solo tu.',
    },
    profilo: {
      etichettaSezione: 'Come ti vedono gli altri',
      titolo: 'Username e nome',
      username: 'Username',
      usernameAiuto: 'Da 3 a 20 caratteri: lettere minuscole, numeri, punto e trattino basso.',
      usernameCorto: 'Lo username deve avere almeno 3 caratteri.',
      usernameCaratteri: 'Usa solo lettere minuscole, numeri, punto e trattino basso.',
      usernameUgualePassword: 'Username e password devono essere diversi.',
      usernameInUso: (proposta: string) => `Già in uso, prova ${proposta}`,
      usaProposta: (proposta: string) => `Usa ${proposta}`,
      nome: 'Nome visualizzato',
      nomeAiuto: 'Puoi cambiarlo quando vuoi. Non serve il tuo nome vero.',
      nomeMancante: 'Scrivi il nome che vuoi mostrare agli amici.',
    },
    consensi: {
      etichettaSezione: 'Ultimo passo',
      titolo: 'I tuoi dati, in breve',
      riassunto: [
        {
          titolo: 'Cosa raccogliamo',
          testo:
            'Email, username, il nome che scegli e la data di nascita. Mai telefono, indirizzo o rubrica.',
        },
        {
          titolo: 'Chi lo vede',
          testo: 'Gli altri vedono solo username e nome. La data di nascita non la vede nessuno.',
        },
        {
          titolo: 'Quanto lo teniamo',
          testo: 'Finché hai l’account. La posizione si cancella dopo 24 ore.',
        },
        {
          titolo: 'Come cancellare tutto',
          testo:
            'Profilo → Elimina account. Cancelliamo tutto subito; dalle copie di sicurezza sparisce entro 30 giorni.',
        },
      ],
      leggiInformativa: 'Leggi l’informativa completa',
      accettoTermini: 'Accetto i ',
      terminiDiServizio: 'Termini di servizio',
      hoLettoPrivacy: 'Ho letto l’',
      informativaPrivacy: 'informativa privacy',
      caselleMancanti: 'Spunta tutte e due le caselle per creare l’account.',
      verificaUmana: 'Verifica di sicurezza',
      verificaUmanaMancante: 'Completa la verifica di sicurezza qui sopra.',
      verificaUmanaFallita: 'La verifica di sicurezza non è andata a buon fine: riprova.',
      consensiCambiati:
        'Termini e informativa sono appena cambiati: ricarica la pagina per leggerli.',
      crea: 'Crea l’account',
      creazione: 'Creazione dell’account',
      offline: 'Serve la connessione per creare l’account. Il pulsante si riattiva da solo.',
    },
    offline: 'Sei offline. Quello che hai scritto resta qui.',
  },

  eta: {
    etichettaSezione: 'Noxa',
    titolo: 'Ci vediamo più avanti',
    testo: 'Noxa è per chi ha almeno 14 anni. Ti aspettiamo quando li avrai compiuti.',
    nienteSalvato: 'Non abbiamo salvato niente di quello che hai scritto.',
    hoCapito: 'Ho capito',
  },

  verifica: {
    etichettaSezione: 'Quasi fatto',
    titolo: 'Controlla la posta',
    titoloScaduto: 'Il link è scaduto',
    titoloInCorso: 'Verifico il link',
    abbiamoMandato: 'Abbiamo mandato un link a',
    reinvia: 'Reinvia l’email',
    reinviaTra: 'Puoi reinviarla tra',
    nuovoLink: 'Mandami un nuovo link',
    hoSbagliato: 'Ho sbagliato email',
    reinviata: {
      titolo: 'Email inviata di nuovo',
      testo: (ora: string) => `Alle ${ora}. Guarda anche nello spam.`,
    },
    erroreInvio: {
      titolo: 'L’email non è partita',
      testo: 'Succede quando la rete è debole. Riprova tra poco.',
    },
    scadutoSenzaEmail:
      'Scrivi l’email con cui ti sei registrata o registrato: ti mandiamo un nuovo link.',
    email: 'Email',
  },

  accesso: {
    etichettaSezione: 'Di nuovo qui',
    titolo: 'Accedi',
    email: 'Email',
    password: 'Password',
    passwordDimenticata: 'Password dimenticata?',
    accedi: 'Accedi',
    accessoInCorso: 'Accesso in corso',
    creaAccount: 'Non hai un account? Creane uno',
    credenzialiErrate: 'Email o password non corretti. Controlla e riprova.',
    campiMancanti: 'Scrivi email e password.',
    nonVerificata: {
      titolo: 'Manca la verifica dell’email',
      testo: 'Apri il link che abbiamo mandato a',
      reinvia: 'Reinvia il link',
      reinviato: 'Link inviato di nuovo. Guarda anche nello spam.',
    },
    troppiTentativi: {
      titolo: 'Troppi tentativi',
      testo: 'Riprova tra qualche minuto. Intanto puoi reimpostare la password.',
    },
  },

  recupero: {
    etichettaSezione: 'Password dimenticata',
    titolo: 'Ti mandiamo un link',
    testo: 'Scrivi l’email del tuo account. Il link vale per un’ora.',
    email: 'Email',
    invia: 'Invia il link',
    torna: 'Torna all’accesso',
    inviato: {
      titolo: 'Controlla la posta',
      testo:
        'Se c’è un account con questa email, ti abbiamo mandato un link. Guarda anche nello spam.',
    },
  },

  nuovaPassword: {
    etichettaSezione: 'Ultimo passaggio',
    titolo: 'Scegli una nuova password',
    campo: 'Nuova password',
    requisitoLunghezza: 'Almeno 10 caratteri',
    requisitoDiversa: 'Diversa da quella di prima',
    altriDispositivi: 'Dopo il salvataggio esci da tutti gli altri dispositivi.',
    salva: 'Salva e accedi',
    salvataggio: 'Salvataggio',
    uguale: 'È la stessa password di prima: scegline un’altra.',
    linkScaduto: {
      titolo: 'Il link è scaduto',
      testo: 'Il link per la nuova password vale un’ora. Chiedine un altro.',
      azione: 'Chiedi un nuovo link',
    },
  },

  onboarding: {
    schermataAccessibile: (n: number) => `Schermata ${n} di 3`,
    avanti: 'Avanti',
    fine: 'Ho capito, iniziamo',
    schermate: [
      {
        etichetta: 'Sicurezza · 1 di 3',
        titolo: 'Chi può trovarti',
        minorenne: [
          'Ti trovano solo persone della tua età.',
          'Una persona maggiorenne può aggiungerti solo con il codice che le dai tu, di persona.',
          'Ogni amicizia la accetti tu.',
        ],
        maggiorenne: [
          'Trovi e ti trovano solo persone maggiorenni.',
          'Puoi aggiungere una persona più giovane solo se ti dà il suo codice di persona.',
          'Ogni amicizia va accettata.',
        ],
      },
      {
        etichetta: 'Sicurezza · 2 di 3',
        titolo: 'La tua posizione',
        tutti: [
          'Check-in e ritorno sicuro sono spenti finché non li accendi tu.',
          'Scegli tu quali amici possono vederti, e la posizione si cancella dopo 24 ore.',
        ],
      },
      {
        etichetta: 'Sicurezza · 3 di 3',
        titolo: 'Segnala e blocca',
        tutti: [
          'Ogni profilo, evento o flyer si segnala in due tocchi.',
          'Chi blocchi non vede più nulla di te, e non saprà di essere stato bloccato.',
        ],
      },
    ],
  },

  nuoviTermini: {
    aggiornamento: 'Aggiornamento · in vigore dal',
    titolo: 'Abbiamo aggiornato termini e informativa',
    leggi: 'Leggi il testo completo',
    accettoTermini: 'Accetto i nuovi Termini',
    hoLettoPrivacy: 'Ho letto la nuova informativa',
    caselleMancanti: 'Per continuare spunta tutte e due. Se non ti va, puoi uscire.',
    esci: 'Esci dall’account',
    accetta: 'Accetta e continua',
  },

  profilo: {
    account: 'Account',
    esci: 'Esci dall’account',
  },
} as const;
