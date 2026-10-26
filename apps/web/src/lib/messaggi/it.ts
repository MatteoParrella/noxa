import { gruppi } from './gruppi';
import { moderazione } from './moderazione';

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
    verificaUmanaInCorso: 'Stiamo completando la verifica di sicurezza: riprova tra un attimo.',
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
    titolo: 'Profilo',
    sottotitolo: 'Il tuo account',
    account: 'Account',
    esci: 'Esci dall’account',
    modifica: 'Modifica nome e username',
    amici: 'Amici',
    richieste: (n: number) => (n === 1 ? '1 richiesta' : `${n} richieste`),
    bloccati: 'Persone bloccate',
    segnalazioni: 'Le mie segnalazioni',
    moderazione: 'Area di moderazione',
    aspetto: 'Aspetto',
    caricamento: 'Carico il tuo profilo',
    modificaTitolo: 'Modifica',
    nomeAiuto: 'Fino a 40 caratteri. Non serve il tuo nome vero.',
    usernameAttuale: 'È il tuo username attuale',
    salva: 'Salva',
    salvato: 'Profilo aggiornato',
    usernameInUso: 'Questo username è già in uso: provane un altro.',
    fotoTitolo: 'Foto profilo',
    fotoAiuto: 'Verrà mostrata ai tuoi amici.',
    fotoSeleziona: 'Seleziona una foto',
    fotoCambia: 'Cambia foto',
    fotoRimuovi: 'Rimuovi foto',
    fotoCaricamento: 'Carico la foto…',
    fotoSuccesso: 'Foto aggiornata',
    fotoErrore: 'Non riusciamo a caricare la foto. Riprova.',
    fotoRimossaSuccesso: 'Foto rimossa',
    fotoRimossaErrore: 'Non riusciamo a rimuovere la foto. Riprova.',
  },

  amici: {
    titolo: 'Amici',
    cerca: 'Cerca per username',
    mioCodice: 'Il mio codice',
    caricamento: 'Carico gli amici',
    offline:
      'Servono la connessione per cercare, creare codici e rispondere alle richieste. Si riattivano da sole.',
    errore: {
      titolo: 'L’elenco non si è caricato',
      testo: 'Colpa nostra o della rete. Riprova tra un attimo.',
    },
    vuoto: {
      titolo: 'Non hai ancora amici su Noxa',
      testo: 'Cercali per username o mostra il tuo codice a chi è con te.',
    },
    richieste: 'Richieste',
    inviate: 'Inviate da te',
    elenco: 'Amici',
    accetta: 'Accetta',
    rifiuta: 'Rifiuta',
    annulla: 'Annulla',
    inAttesa: 'In attesa',
    richiestaInviata: 'Richiesta inviata',
    aggiungi: 'Aggiungi',
    giaAmici: 'Amici',
    altreAzioni: (username: string) => `Altre azioni per @${username}`,
    rimuovi: 'Rimuovi dall’elenco',
    segnala: 'Segnala',
    blocca: 'Blocca',
    rimuoviTitolo: (username: string) => `Rimuovere @${username} dagli amici?`,
    rimuoviTesto: 'Non vedrà più le tue serate e non saprà di essere stata rimossa o rimosso.',
    rimuoviConferma: 'Rimuovi',
    vediProfilo: 'Vedi il profilo',
    arrivataConCodice: 'Richiesta arrivata con il tuo codice',
    vuoleAggiungerti: 'Vuole aggiungerti agli amici.',
    erroreAzione: 'Non è andata: controlla la connessione e riprova.',
  },

  ricerca: {
    titolo: 'Cerca per username',
    campo: 'Username',
    aiuto:
      'Trovi solo persone della tua fascia d’età. Per aggiungere qualcun altro usate il codice, di persona.',
    corto: 'Scrivi almeno 3 lettere.',
    nessuno: {
      titolo: 'Nessuno con questo username nella tua fascia',
      testo: 'Se è con te, mostragli il tuo codice.',
    },
    errore: { titolo: 'La ricerca non ha funzionato', testo: 'Riprova tra un attimo.' },
    offline: 'La ricerca torna disponibile appena sei di nuovo online.',
    limite: {
      titolo: 'Hai inviato molte richieste oggi',
      testo: 'Riprova domani. Il limite è di 20 al giorno e 50 in attesa.',
    },
    risultati: (n: number) => (n === 1 ? '1 risultato' : `${n} risultati`),
  },

  codice: {
    titolo: 'Il mio codice',
    spiegazione: 'Mostralo a chi è con te. Vale 15 minuti e funziona una volta sola.',
    qrAlternativa: 'Codice QR. Il codice scritto è sotto.',
    valido: (minuti: number) => `Valido ancora ${minuti} min`,
    scaduto: 'Questo codice è scaduto',
    usato: 'Questo codice è già stato usato',
    condividi: 'Condividi link',
    copiato: 'Link copiato',
    nuovo: 'Nuovo codice',
    scansiona: 'Scansiona un codice',
    errore: 'Non siamo riusciti a creare il codice',
    limite: { titolo: 'Hai creato 10 codici oggi', testo: 'Puoi crearne uno nuovo domani.' },
    offline: 'Per creare un codice e per usarne uno serve la connessione.',
    caricamento: 'Creo il tuo codice',
    testoCondivisione: 'Aggiungimi su Noxa con questo link. Vale 15 minuti.',
  },

  scansione: {
    titolo: 'Scansiona un codice',
    inquadra: 'Inquadra il QR di chi è con te',
    senzaPermesso:
      'Noxa non ha il permesso di usare la fotocamera. Va bene così: puoi scrivere il codice qui sotto. Se cambi idea, il permesso si attiva dalle impostazioni del telefono.',
    nonSupportata: 'Su questo dispositivo il codice si scrive a mano.',
    scrivi: 'Scrivi il codice',
    continua: 'Continua',
    formato: 'Il codice ha 10 caratteri, per esempio K7Q4-M2XP-9H.',
  },

  anteprima: {
    titolo: 'Codice invito',
    invia: 'Invia richiesta',
    annulla: 'Annulla',
    hoCapitoInvia: 'Ho capito, invia',
    avvisoTitolo: 'Persona maggiorenne',
    avvisoTesto:
      'Stai aggiungendo una persona maggiorenne: aggiungi solo persone che conosci di persona.',
    scaduto: { titolo: 'Codice scaduto', testo: 'Chiedi un codice nuovo: vale 15 minuti.' },
    usato: { titolo: 'Codice già usato', testo: 'Ogni codice funziona una volta sola.' },
    nonValido: {
      titolo: 'Codice non valido',
      testo: 'Controlla di averlo scritto giusto o chiedine uno nuovo.',
    },
    giaAmici: 'Siete già amici',
    inAttesa: 'C’è già una richiesta tra voi',
    inviata: 'Richiesta inviata. Diventerete amici quando la accetta.',
    altro: 'Scansiona un altro codice',
    torna: 'Torna agli amici',
    caricamento: 'Controllo il codice',
  },

  persona: {
    titolo: 'Profilo',
    nonDisponibile: 'Questo profilo non si può vedere.',
    torna: 'Torna indietro',
    caricamento: 'Carico il profilo',
  },

  segnala: {
    titolo: (username: string) => `Segnala @${username}`,
    titoloFoto: (username: string) => `Segnala la foto di @${username}`,
    spiegazione: 'Tocca un motivo: la segnalazione parte subito. Resta anonima.',
    motivi: [
      { valore: 'contenuto_inappropriato', etichetta: 'Contenuto inappropriato' },
      { valore: 'molestie', etichetta: 'Molestie' },
      {
        valore: 'adescamento_o_rischio_minore',
        etichetta: 'Mi sembra che metta a rischio una persona minorenne',
      },
      { valore: 'spam', etichetta: 'Spam o truffa' },
      { valore: 'eta_errata', etichetta: 'Età falsa' },
      { valore: 'altro', etichetta: 'Altro' },
    ],
    dettagli: 'Vuoi aggiungere qualcosa?',
    bloccaAnche: 'Blocca anche questa persona',
    invio: 'Invio',
    offline: 'Sei offline: puoi già scrivere, la segnalazione parte quando torna la connessione.',
    errore: { titolo: 'La segnalazione non è partita', testo: 'Non hai perso niente.' },
    limite: 'Hai inviato molte segnalazioni oggi: riprova domani.',
    inviata: {
      titolo: 'Grazie, ce ne occupiamo noi.',
      testo: 'Chi hai segnalato non lo saprà. Trovi lo stato in Profilo › Le mie segnalazioni.',
    },
    rischio: {
      titolo: 'Lo guardiamo entro 4 ore',
      testo: 'Se c’è un pericolo immediato chiama il 112.',
      chiama: 'Chiama il 112',
    },
  },

  blocca: {
    titolo: (username: string) => `Bloccare @${username}?`,
    testo:
      'Non vedrà più il tuo profilo, le tue serate e i tuoi check-in, e tu non vedrai i suoi. Non riceverà nessun avviso.',
    conferma: 'Blocca',
    annulla: 'Annulla',
    fatto: 'Persona bloccata',
  },

  bloccati: {
    titolo: 'Persone bloccate',
    spiegazione: 'Non vedono te e tu non vedi loro. Non sanno di essere bloccati.',
    vuoto: {
      titolo: 'Non hai bloccato nessuno.',
      testo: 'Puoi bloccare qualcuno dal menu ⋯ del suo profilo.',
    },
    sblocca: 'Sblocca',
    sbloccaTitolo: (username: string) => `Sbloccare @${username}?`,
    sbloccaTesto: 'Potrà di nuovo trovarti e mandarti richieste. Non tornerete amici da soli.',
    caricamento: 'Carico le persone bloccate',
  },

  scopri: {
    titolo: 'Scopri',
    milanoBrianza: 'Milano e Brianza',
    vicinoATe: 'Vicino a te',
    entro: (km: number) => `entro ${km} km`,
    fino: (eta: number) => `fino a ${eta}+`,
    conAmici: 'con amici',
    tuttiGliEventi: 'Tutti gli eventi',
    vista: 'Vista',
    elenco: 'Elenco',
    mappa: 'Mappa',
    quando: 'Quando',
    stasera: 'Stasera',
    domani: 'Domani',
    weekend: 'Weekend',
    scegliData: 'Scegli data',
    filtri: 'Filtri',
    filtriAttivi: (numero: number) =>
      numero === 0 ? 'Filtri' : numero === 1 ? 'Filtri, 1 attivo' : `Filtri, ${numero} attivi`,
    etaNonDichiarata: 'non dichiarata',
    ingressoLibero: 'Ingresso libero',
    caricamento: 'Carico gli eventi',
    soloVisibili: 'Vedi solo gli eventi a cui puoi entrare.',
    annullato: 'Annullato',
    amici: {
      vanno: (nomi: string[], altri: number) => {
        const elenco =
          altri > 0
            ? `${nomi.join(', ')} e ${altri === 1 ? 'un’altra persona' : `altri ${altri}`}`
            : nomi.join(' e ');
        return `${elenco} ${nomi.length + altri === 1 ? 'ci va' : 'ci vanno'}`;
      },
      interessa: (nomi: string[], altri: number) =>
        altri > 0
          ? `Interessa a ${nomi.join(', ')} e ad ${altri === 1 ? 'un’altra persona' : `altre ${altri} persone`}`
          : `Interessa a ${nomi.join(' e ')}`,
    },
    evento: (dati: {
      titolo: string;
      locale: string;
      comune: string;
      quando: string;
      eta: string;
      altro: string[];
    }) => [dati.titolo, dati.locale, dati.comune, dati.quando, dati.eta, ...dati.altro].join(', '),
    limite: (numero: number) =>
      `Vedi i primi ${numero} eventi: restringi date o filtri per vedere gli altri.`,
    vuoto: {
      titolo: 'Nessun evento con questi filtri',
      testo: 'Prova a togliere un genere o ad allargare la distanza.',
      azione: 'Togli i filtri',
      titoloSenzaFiltri: 'Nessun evento in questa data',
      testoSenzaFiltri: 'Prova un altro giorno: il catalogo si aggiorna ogni giorno.',
    },
    errore: {
      titolo: 'Gli eventi non si sono caricati',
      testo: 'Colpa nostra o della rete. Riprova tra un attimo.',
    },
    offline: 'Sei offline: vedi gli eventi salvati sul telefono.',
    offlineVuoto: {
      titolo: 'Sei offline',
      testo: 'Gli eventi compaiono quando torna la connessione.',
    },
    distanze: { tutte: 'tutte le distanze', tutteBreve: 'Tutte' },
    foglio: {
      titolo: 'Filtri',
      chiudi: 'Chiudi i filtri',
      quando: 'Quando',
      dove: 'Dove',
      ovunque: 'Tutta Milano e Brianza',
      usaPosizione: 'Usa la mia posizione',
      scegliComune: 'Scegli un comune',
      comune: 'Comune',
      comuneSegnaposto: 'Scrivi il nome del comune',
      nessunComune: 'Nessun comune di Milano o della Brianza con questo nome.',
      posizioneNota: 'La posizione serve solo a calcolare le distanze e non viene salvata.',
      posizioneAttesa: 'Cerco la posizione…',
      posizioneNegata: {
        titolo: 'Posizione non disponibile',
        testo:
          'Noxa non ha il permesso di usare la posizione. Va bene così: scegli un comune e calcoliamo le distanze da lì.',
      },
      posizioneAssente: {
        titolo: 'Posizione non trovata',
        testo:
          'Il telefono non ha dato la posizione. Scegli un comune e calcoliamo le distanze da lì.',
      },
      distanza: 'Distanza',
      generi: 'Generi musicali',
      eta: 'Età minima',
      etaSpiegazione:
        'Restringe tra gli eventi che puoi già vedere: utile se esci con amici più piccoli.',
      etaTutte: 'Tutte',
      soloAmici: 'Solo eventi con amici',
      soloAmiciDescrizione: 'Dove un tuo amico ci va o è interessato.',
      azzera: 'Azzera',
      mostra: (numero: number | null) =>
        numero === null
          ? 'Mostra gli eventi'
          : numero === 1
            ? 'Mostra 1 evento'
            : `Mostra ${numero} eventi`,
    },
    calendario: {
      titolo: 'Scegli una data',
      mese: 'Mese',
      anno: 'Anno',
      annulla: 'Annulla',
      mostra: (giorno: string) => `Mostra ${giorno}`,
      passato: 'giorno passato',
    },
    mappaVista: {
      etichetta: 'Mappa degli eventi',
      mostraElenco: 'Mostra elenco',
      caricamento: 'Carico la mappa…',
      errore: {
        titolo: 'La mappa non si è caricata',
        testo: 'Vedi gli eventi in elenco: sono gli stessi.',
      },
      offline: {
        titolo: 'La mappa non è disponibile offline',
        testo: 'Gli eventi salvati sul telefono sono nell’elenco.',
      },
      vediElenco: 'Vedi gli eventi in elenco',
      vuota: {
        titolo: 'Nessun evento in quest’area',
        testo: 'Sposta la mappa o allarga la distanza nei filtri.',
      },
      locale: (nome: string, eventi: number) =>
        `${nome}, ${eventi === 1 ? '1 evento' : `${eventi} eventi`}`,
      gruppo: (locali: number) => `${locali} locali vicini, tocca per avvicinarti`,
      anteprima: (nome: string) => `Anteprima: ${nome}`,
      eventiLocale: (nome: string, eventi: number) => `${nome} · ${eventi} eventi`,
      apri: 'Apri',
      apriEvento: (titolo: string) => `Apri ${titolo}`,
      chiudiAnteprima: 'Chiudi l’anteprima',
    },
    caricaFlyer: {
      titolo: 'Carica un flyer',
      sottotitolo: 'Scopri',
      indietro: 'Scopri',
      descrizione:
        'Hai trovato il flyer di un evento a Milano o in Brianza? Caricalo: un moderatore lo esamina e, se tutto è a posto, lo pubblichiamo.',
      seleziona: 'Scegli un’immagine',
      cambia: 'Cambia immagine',
      dati: {
        titolo: 'Che cosa trovi nel flyer?',
        titoloCampo: 'Titolo evento',
        dataCampo: 'Data',
        localeCampo: 'Locale o luogo',
      },
      carica: 'Carica il flyer',
      caricamento: 'Carico il flyer…',
      successo: {
        titolo: 'Flyer ricevuto, grazie!',
        testo: 'Un moderatore lo esamina. Ti avvisiamo quando è pronto.',
        azione: 'Vai a "I miei flyer"',
      },
      errori: {
        tipoNonValido: 'Scegli un file JPEG, PNG o WebP.',
        troppoGrande: 'Il file è troppo grande: massimo 10 MB.',
        troppiOggi: 'Hai già caricato 10 flyer nelle ultime 24 ore. Riprova domani.',
        generico: 'Qualcosa non ha funzionato. Riprova tra poco.',
      },
      note: 'L’immagine viene esaminata da una persona del team prima della pubblicazione.',
    },
    mieiFlyer: {
      titolo: 'I miei flyer',
      sottotitolo: 'Scopri',
      indietro: 'Scopri',
      caricaFlyer: 'Carica un flyer',
      caricamento: 'Carico i tuoi flyer',
      vuoto: {
        titolo: 'Nessun flyer caricato',
        testo:
          'Carica un flyer di un evento di Milano o della Brianza: lo esaminiamo e, se è tutto a posto, lo pubblichiamo.',
        azione: 'Carica un flyer',
      },
      errore: {
        titolo: 'I flyer non si sono caricati',
        testo: 'Controlla la connessione e riprova.',
      },
      stati: {
        caricato: 'Caricato',
        in_analisi: 'In analisi',
        in_revisione: 'In revisione',
        approvato: 'Approvato',
        unito: 'Pubblicato',
        rifiutato: 'Rifiutato',
        errore: 'Errore',
      } as const,
      motivoRifiuto: 'Motivo:',
      vaiAllevento: 'Vedi l’evento',
      elimina: 'Elimina richiesta',
      eliminaConferma: 'Eliminare la richiesta?',
      eliminaConfermaTesto: 'Il flyer verrà rimosso e l’evento in attesa sarà annullato.',
      eliminaConfermaAzione: 'Elimina',
      eliminaAnnulla: 'Annulla',
      eliminaSuccesso: 'Richiesta eliminata.',
      eliminaErrore: 'Non è stato possibile eliminare la richiesta.',
    },
  },

  evento: {
    caricamento: 'Carico l’evento',
    indietro: 'Indietro',
    nonDisponibile: {
      titolo: 'Questo evento non c’è più o non è adatto alla tua età',
      testo: 'Trovi altri eventi in Scopri.',
      azione: 'Torna a Scopri',
    },
    errore: {
      titolo: 'L’evento non si è caricato',
      testo: 'Colpa nostra o della rete. Riprova tra un attimo.',
    },
    offline: 'Sei offline: vedi i dettagli salvati sul telefono.',
    offlineAzioni: 'Partecipazione e link tornano attivi con la connessione.',
    foto: (attribuzione: string) => `Foto: ${attribuzione}`,
    fotoLocale: (locale: string) => `Foto di ${locale}`,
    flyer: (titolo: string) => `Flyer approvato: ${titolo}`,
    annullato: {
      titolo: 'Il locale ha annullato l’evento',
      testo: 'Se avevi un biglietto, il rimborso lo gestisce chi l’ha venduto.',
    },
    etaNonDichiarata: {
      titolo: 'Età non dichiarata',
      testo: 'Il locale non ha indicato un’età minima: la consideriamo 18+.',
    },
    dove: 'Dove',
    lineUp: 'Line-up',
    prezzo: 'Prezzo',
    prezzoNonIndicato: 'Prezzo non indicato',
    apriInMappe: 'Apri in Mappe',
    fonte: {
      sito_locale: 'Fonte: sito del locale',
      instagram: 'Fonte: Instagram del locale',
      altro: 'Fonte: pagina dell’evento',
    },
    biglietti: 'Biglietti',
    sitoEsterno: 'sito esterno',
    apreSitoEsterno: '(apre un sito esterno)',
    altreAzioni: (titolo: string) => `Altre azioni per ${titolo}`,
    condividi: 'Condividi il link',
    linkCopiato: 'Link copiato',
    linkNonCopiato: 'Non siamo riusciti a copiare il link.',
    segnala: 'Segnala',
    amici: {
      titolo: 'Amici a questo evento',
      partecipa: 'ci va',
      interessato: 'è interessato',
      nota: 'Vedi solo gli amici che hanno reso visibile la loro scelta.',
    },
    partecipazione: {
      gruppo: 'La tua partecipazione',
      interessa: 'Mi interessa',
      partecipo: 'Partecipo',
      nessuna: 'Non hai ancora scelto.',
      statoInteressa: 'Segnato: ti interessa. Tocca di nuovo per togliere.',
      statoPartecipo: 'Segnato: partecipi. Tocca di nuovo per togliere.',
      visibile: 'Visibile ai tuoi amici',
      visibileTesto: 'Gli amici vedono la tua scelta per questo evento.',
      soloTe: 'Solo per te',
      soloTeTesto: 'Gli amici non vedono la tua scelta per questo evento.',
      toastInteressa: 'Segnato: ti interessa',
      toastPartecipo: 'Segnato: partecipi',
      toastTolta: 'Scelta tolta',
      toastVisibile: 'Ora i tuoi amici la vedono',
      toastSoloTe: 'Ora è solo per te',
      annulla: 'Annulla',
      errore: 'La scelta non è stata salvata. Riprova.',
    },
    segnalaFoglio: {
      titolo: 'Segnala l’evento',
      spiegazione: 'Tocca un motivo: la segnalazione parte subito. Resta anonima.',
      motivi: [
        { valore: 'evento_falso', etichetta: 'Evento falso' },
        { valore: 'dati_errati', etichetta: 'Dati sbagliati (orari, luogo, età)' },
        { valore: 'contenuto_inappropriato', etichetta: 'Contenuto inappropriato' },
        { valore: 'alcol_a_minori', etichetta: 'Riferimenti all’alcol non segnalati' },
        { valore: 'altro', etichetta: 'Altro' },
      ],
      foto: 'Foto del locale inappropriata',
      inviata: {
        titolo: 'Grazie, ce ne occupiamo noi.',
        testo: 'Trovi lo stato in Profilo › Le mie segnalazioni.',
      },
    },
  },

  mieSegnalazioni: {
    titolo: 'Le mie segnalazioni',
    vuoto: {
      titolo: 'Non hai fatto segnalazioni.',
      testo: 'Profili, eventi e flyer si segnalano dal menu ⋯.',
    },
    stati: { aperta: 'Inviata', in_lavorazione: 'In lavorazione', chiusa: 'Chiusa' },
    oggetto: {
      profilo: 'Profilo',
      profiloRimosso: 'Profilo non più disponibile',
      evento: 'Evento',
      eventoRimosso: 'Evento non più disponibile',
      immagine_locale: 'Foto di',
      immagineRimossa: 'Foto di un locale non più disponibile',
    },
    decisione: 'Decisione del',
    dsa: 'art. 17 DSA',
    persona: 'Decisione presa da una persona del team, non da un sistema automatico.',
    caricamento: 'Carico le tue segnalazioni',
    reclamo: {
      presenta: 'Presenta reclamo',
      stati: {
        inviato: 'Reclamo inviato',
        in_esame: 'In esame',
        deciso: 'Deciso',
      },
      esiti: {
        confermata: 'Decisione confermata',
        cambiata: 'Decisione cambiata',
      },
    },
  },

  reclamo: {
    titolo: 'Presenta reclamo',
    sottotitolo: 'La tua motivazione',
    descrizione: 'Spiega perché non sei d’accordo con la decisione.',
    campo: 'Motivazione',
    aiuto: 'Massimo 1000 caratteri.',
    invia: 'Invia reclamo',
    invio: 'Invio…',
    successo: {
      titolo: 'Reclamo inviato',
      testo: 'Un altro moderatore lo esaminerà entro i tempi previsti.',
    },
    errori: {
      vuoto: 'Scrivi perché non sei d’accordo.',
      scaduto: 'Il termine di 6 mesi è scaduto.',
      giaInviato: 'Hai già inviato un reclamo per questa decisione.',
      generico: 'Non è andata: controlla la connessione e riprova.',
    },
  },

  notifiche: {
    titolo: 'Notifiche',
    caricamento: 'Carico le notifiche',
    apriNotifiche: 'Notifiche',
    campanella: (n: number) => (n === 1 ? '1 notifica non letta' : `${n} notifiche non lette`),
    vuoto: {
      titolo: 'Nessuna notifica',
      testo: 'Le richieste di amicizia, i badge e gli aggiornamenti importanti arrivano qui.',
    },
    errore: {
      titolo: 'Non riesco a caricare le notifiche',
      testo: 'Controlla la connessione e riprova.',
    },
    gruppi: {
      oggi: 'Oggi',
      settimana: 'Questa settimana',
      prima: 'Prima',
    },
    tipi: {
      richiesta_amicizia: 'Hai ricevuto una richiesta di amicizia.',
      amicizia_accettata: 'La tua richiesta di amicizia è stata accettata.',
      invito_gruppo: 'Hai un invito in un gruppo.',
      nuova_serata: 'Nel tuo gruppo c’è una nuova serata.',
      aggiornamento_serata: 'Una serata del tuo gruppo è cambiata.',
      checkin_amico: 'Un amico ha fatto il check-in a un evento.',
      ritorno_avviato: 'Un amico ha avviato il ritorno sicuro.',
      ritorno_allerta: 'Allerta: un amico non è ancora rientrato.',
      ritorno_arrivato: 'Un amico è rientrato sano e salvo.',
      esito_moderazione: 'Il tuo contenuto è stato esaminato.',
      rimozione_gruppo: 'Non fai più parte di un gruppo.',
      badge_ottenuto: 'Hai ottenuto un nuovo badge.',
      riepilogo_pronto: 'Il tuo Wrapped è pronto.',
    } as const,
    /** Titoli degli esiti di moderazione (`dati.esito`); la motivazione segue sotto. */
    esiti: {
      segnalazione_decisa: 'Abbiamo esaminato la tua segnalazione',
      contenuto_rimosso: 'Abbiamo rimosso un tuo contenuto',
      contenuto_rimosso_foto: 'Abbiamo rimosso la tua foto profilo',
      contenuto_nascosto: 'La tua foto profilo è nascosta in attesa di un controllo',
      contenuto_ripristinato: 'La tua foto profilo è di nuovo visibile',
      account_sospeso: 'Il tuo account è sospeso',
      flyer_pubblicato: 'Il tuo flyer è stato pubblicato',
      flyer_unito: 'Il tuo flyer è stato aggiunto a un evento',
      flyer_rifiutato: 'Il tuo flyer non è stato pubblicato',
      reclamo_deciso: 'Abbiamo deciso sul tuo reclamo',
      contenuto_rimosso_gruppo: 'Abbiamo rimosso il nome di un tuo gruppo',
      contenuto_rimosso_serata: 'Abbiamo rimosso un testo di una tua serata di gruppo',
    } as Record<string, string>,
    /** Serate di gruppo cambiate (`dati.cambio`). */
    serata: {
      confermata: 'Una serata del tuo gruppo è confermata.',
      annullata: 'Una serata del tuo gruppo è stata annullata.',
      modificata: 'Ritrovo o data di una serata del tuo gruppo sono cambiati.',
    } as Record<string, string>,
    /**
     * Uscita da un gruppo (`dati.motivo`, R-15). Senza il nome del gruppo: è scritto da un
     * altro utente e le notifiche non contengono testi di altri.
     */
    rimozione: {
      fasce:
        'Non fai più parte di un gruppo: ci sono persone minorenni che non sono tue amiche confermate.',
      compleanno:
        'Hai compiuto 18 anni: non fai più parte di un gruppo in cui ci sono persone minorenni che non sono tue amiche confermate.',
      tolto: 'Non fai più parte di un gruppo.',
      invitoScaduto: 'Un invito in un gruppo non è più valido.',
      cosaFare:
        'Se vi conoscete di persona, potete diventare amici con un codice invito e poi chiedere un nuovo invito.',
    },
  },

  gruppi,
  moderazione,
} as const;
