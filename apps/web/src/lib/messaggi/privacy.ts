/**
 * Testi di Privacy e dati (design/F-42-privacy): comprensibili da un quattordicenne, precisi,
 * senza formule legali né minimizzazioni dell'eliminazione, nessun dark pattern (R-43, R-63).
 * Il riassunto dell'informativa deve restare coerente con SAFETY_PRIVACY.md e con /privacy.
 */

export const privacy = {
  voce: {
    titolo: 'Privacy e dati',
    testo: 'Chi vede cosa, i tuoi dati, l’account',
  },
  pagina: {
    titolo: 'Privacy e dati',
    sopratitolo: 'Profilo',
    intro: 'Decidi tu chi vede cosa. Le scelte già impostate sono le più protettive.',
    caricamento: 'Carico le tue impostazioni',
    chiVedeCosa: 'Chi vede cosa',
    partecipazioni: 'Mostra ai tuoi amici a quali eventi vai',
    partecipazioniAcceso:
      'Quando segni «interessato» o «partecipo», lo vedono solo i tuoi amici confermati, mai gli sconosciuti.',
    partecipazioniSpento:
      'Spento: nei nuovi eventi i tuoi amici non vedono se ci vai. Lo vedi solo tu.',
    perEvento: 'Puoi cambiarlo anche per ogni evento, dal suo dettaglio.',
    perEventoOffline: 'Sei offline: per cambiarlo serve la rete.',
    bloccati: 'Persone bloccate',
    bloccatiTesto: 'Non ti trovano e non ti vedono su Noxa.',
    bloccatiConteggio: (n: number) => (n === 1 ? '1 persona bloccata' : `${n} persone bloccate`),
    tuoiDati: 'I tuoi dati',
    scarica: 'Scarica i tuoi dati',
    scaricaTesto: 'Un file con tutto ciò che Noxa conserva su di te.',
    informativa: 'Informativa in breve',
    informativaTesto: 'Cosa raccogliamo e perché, in una schermata.',
    account: 'Account',
    elimina: 'Elimina l’account',
    eliminaTesto: 'Cancella subito profilo, amici, gruppi e diario.',
    salvataggio: {
      titolo: 'Non siamo riusciti a salvare',
      testo: (acceso: boolean) =>
        `L’interruttore è tornato com’era: ${acceso ? 'acceso' : 'spento'}. Riprova tra un attimo.`,
    },
    salvato: 'Impostazione salvata',
    offline: 'Sei offline: vedi le impostazioni salvate.',
    errore: {
      titolo: 'Le impostazioni non si sono caricate',
      testo: 'Controlla la connessione e riprova.',
    },
  },
  scarica: {
    titolo: 'Scarica i tuoi dati',
    sopratitolo: 'Privacy e dati',
    intro:
      'Prepariamo un file con tutto ciò che Noxa conserva su di te. Lo salvi sul tuo dispositivo: nessuna email, nessun link pubblico.',
    contenuto: 'Cosa c’è dentro',
    voci: {
      profilo: 'Profilo',
      amicizie: 'Amicizie',
      gruppi: 'Gruppi e serate',
      partecipazioni: 'Partecipazioni',
      diario: 'Diario',
      segnalazioni: 'Segnalazioni fatte',
      consensi: 'Consensi',
    },
    formato: 'Formato JSON: un file di testo leggibile anche da altri servizi.',
    prepara: 'Prepara il file',
    regola: 'Puoi chiederlo una volta ogni ora. Di solito è pronto in pochi secondi.',
    preparazione: 'Sto preparando il file…',
    preparazioneAiuto: 'Puoi restare qui: ti avviso quando è pronto.',
    pronto: 'File pronto',
    scarica: 'Scarica',
    prontoAiuto: 'Contiene i tuoi dati personali: salvalo in un posto sicuro.',
    dimensione: (kb: number) => (kb < 1 ? 'meno di 1 KB' : `${Math.round(kb)} KB`),
    nomeFile: (data: string) => `noxa-dati-${data}.json`,
    offline: {
      titolo: 'Sei offline',
      testo: 'Per preparare il file serve la rete. Torna qui quando sei connesso.',
    },
    errore: {
      titolo: 'Il file non si è preparato',
      testo: 'Non è colpa tua. I tuoi dati sono a posto: riprova.',
    },
    limite: {
      titolo: (ora: string) => `Hai già chiesto il file alle ${ora}`,
      testo: (ora: string) => `Puoi richiederlo di nuovo alle ${ora}.`,
    },
    annuncioPronto: 'Il file è pronto da scaricare.',
  },
  elimina: {
    sopratitolo: 'Account',
    titolo: 'Elimina l’account',
    intro: 'Lo fai da qui, senza scrivere a nessuno. Prima leggi cosa succede.',
    passo: (n: number) => `Passo ${n} di 2`,
    spariscono: 'Sparisce subito',
    sparisconoQuando: 'appena confermi',
    elenco: [
      'Il tuo profilo, la foto e l’username',
      'Le amicizie e le richieste',
      'Il tuo posto nei gruppi e nelle serate',
      'Le partecipazioni agli eventi',
      'Il diario di Ricorda, con spese e note',
    ],
    copie: 'Le copie di sicurezza',
    copieQuando: 'entro 30 giorni',
    copieTesto:
      'Le copie che teniamo per i guasti si cancellano da sole entro 30 giorni. Nessuno le usa per ripristinare il tuo account.',
    resta: 'Cosa resta',
    restaQuando: 'solo per legge',
    restaTesto:
      'Le segnalazioni che hai fatto restano alla moderazione per i tempi previsti, senza il tuo nome. Se c’è stata una segnalazione grave, la legge ci chiede di tenerne il registro: resta separato da te e non si vede nell’app.',
    irreversibile: 'Non si può annullare: dopo, non possiamo recuperare niente.',
    primaScarica: 'Se vuoi, prima ',
    primaScaricaLink: 'scarica i tuoi dati',
    annulla: 'Annulla',
    continua: 'Continua',
    conferma: {
      titolo: 'Conferma con la password',
      testo: 'Per sicurezza ti chiediamo la password. Dopo questo passo l’account sparisce subito.',
      testoDueFattori:
        'Per sicurezza servono la password e il codice dei due fattori. Dopo questo passo l’account sparisce subito.',
      password: 'Password',
      codice: 'Codice a sei cifre dall’app di autenticazione',
      elimina: 'Elimina definitivamente',
      riprova: 'Riprova a eliminare',
      annulla: 'Annulla',
    },
    errori: {
      passwordMancante: 'Scrivi la password del tuo account.',
      password: 'La password non è giusta. Controlla maiuscole e spazi, poi riprova.',
      codice: 'Il codice non è giusto o è scaduto. Usa quello che vedi adesso nell’app.',
      codiceMancante: 'Scrivi le sei cifre del codice.',
      tentativi: 'Troppi tentativi con una password sbagliata. Riprova tra un’ora.',
      offline: {
        titolo: 'Sei offline',
        testo: 'Per eliminare l’account serve la rete. Non abbiamo cancellato niente.',
      },
      nonRiuscita: {
        titolo: 'L’eliminazione non è riuscita',
        testo: 'Il tuo account è ancora qui, com’era. Riprova.',
      },
    },
    fatto: {
      titolo: 'Il tuo account è stato eliminato',
      testo:
        'Profilo, amicizie, gruppi, diario e partecipazioni non ci sono più. Le copie di sicurezza si cancellano entro 30 giorni.',
      saluto: 'Grazie per le serate passate con Noxa.',
      inizio: 'Torna all’inizio',
    },
  },
  informativa: {
    sopratitolo: 'Privacy e dati',
    titolo: 'Informativa in breve',
    intro: 'La versione corta, in parole semplici. Se qualcosa non torna, vale il testo completo.',
    blocchi: [
      {
        titolo: 'Cosa raccogliamo',
        righe: [
          'Quello che ci dai: email, username, nome, data di nascita (per la fascia d’età) e la foto, se la metti.',
          'Quello che fai su Noxa: amici, gruppi, serate, partecipazioni, diario e segnalazioni.',
          'I consensi che hai dato, e quando. Mai telefono, indirizzo di casa o rubrica.',
        ],
      },
      {
        titolo: 'Chi lo vede',
        righe: [
          'Nome e username: chi ti cerca nella tua fascia d’età. La foto: amici e compagni di gruppo.',
          'A quali eventi vai: solo i tuoi amici confermati, se lo lasci acceso.',
          'Il diario: solo tu. Le tue segnalazioni: solo la moderazione, mai la persona segnalata.',
        ],
      },
      {
        titolo: 'Quanto lo teniamo',
        righe: [
          'Finché hai l’account.',
          'Se lo elimini sparisce subito; le copie di sicurezza entro 30 giorni.',
          'Le segnalazioni restano 12 mesi; quelle gravi solo quanto chiede la legge.',
        ],
      },
      {
        titolo: 'I tuoi diritti',
        righe: [
          'Vedere e scaricare i tuoi dati, correggerli, cancellarli: da Profilo › Privacy e dati.',
          'Chiederci spiegazioni o fare reclamo al Garante per la protezione dei dati personali.',
        ],
      },
    ],
    completa: 'Leggi l’informativa completa',
    versione: (versione: string, dal: string) => `Versione ${versione} · in vigore dal ${dal}`,
  },
};
