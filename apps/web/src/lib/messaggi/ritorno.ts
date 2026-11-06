/**
 * Testi del ritorno sicuro (design/F-21-ritorno-sicuro): "tu", frasi brevi, sobri. Niente
 * parole di controllo ("traccia", "segui", "localizza", "monitora"), nessuna pressione
 * sociale (R-43) e nessun allarmismo: l'allerta informa e suggerisce cosa fare.
 */

const amici = (n: number) => (n === 1 ? '1 amico' : `${n} amici`);

export const ritorno = {
  etichetta: 'Ritorno sicuro',
  invito: {
    titolo: 'Torni a casa?',
    testo:
      'Fai sapere ad alcuni amici che stai rientrando: se non arrivi in tempo, li avvisiamo noi.',
    avvia: 'Avvia il ritorno sicuro',
    offline: 'Senza rete il ritorno non parte: nessuno lo riceverebbe.',
  },
  tratta: {
    casa: 'Casa',
    verso: (arrivo: string) => `Verso ${arrivo}`,
    freccia: '→',
  },
  mio: {
    etichetta: 'Il tuo ritorno',
    inViaggio: 'In viaggio',
    inRitardo: 'In ritardo',
    partito: (ora: string) => `Partito ${ora}`,
    arrivoPrevisto: (ora: string) => `Arrivo previsto ${ora}`,
    posizione: {
      condivisa: (quando: string) => `Posizione condivisa · aggiornata ${quando}`,
      inAttesa: 'In attesa della prima posizione',
      vecchia: (ora: string) => `Gli amici vedono una posizione delle ${ora}`,
      altroTelefono: 'Avviato su un altro telefono: la posizione arriva da lì.',
    },
    loVedono: (n: number) => `Lo vedono ${amici(n)}`,
    arrivato: 'Sono arrivato',
    proroga: 'Proroga',
    chiLoVede: 'Chi lo vede',
    annulla: 'Annulla ritorno',
    dettaglio: 'Apri il ritorno',
    arrivatoFatto: 'Gli amici sanno che sei a casa.',
    nonConcluso: 'Non siamo riusciti a concluderlo. Riprova.',
    annullato: 'Ritorno annullato. Gli amici non vedono più la tua posizione.',
  },
  promemoria: {
    titolo: 'Mancano 10 minuti all’arrivo previsto',
    testo: 'Se sei arrivato, dillo agli amici. Se ti serve più tempo, proroga.',
  },
  arrivoAutomatico: {
    titolo: (area: string) => `Sei arrivato nell’area ${area}`,
    testo:
      'Tra un minuto concludiamo il ritorno e lo diciamo agli amici. Se non è così, riprendilo.',
    nonEro: 'Non ero arrivato',
    entro: (ora: string) => `entro ${ora}`,
    ripreso: 'Ritorno ripreso: l’arrivo automatico si riattiva quando esci dall’area.',
  },
  barra: {
    titolo: 'Ritorno attivo',
    dettaglio: (ora: string, n: number) => `Arrivo ${ora} · ${amici(n)}`,
    pwa: 'Tieni Noxa aperta: con lo schermo bloccato gli amici vedono l’ultima posizione.',
  },
  notificaFissa: {
    titolo: 'Ritorno sicuro attivo',
    testo: (ora: string, n: number) =>
      `Arrivo previsto ${ora} · lo vedono ${amici(n)}. Tocca per «Sono arrivato».`,
  },
  dettaglio: {
    sopratitolo: 'Vivi',
    titolo: 'Il tuo ritorno',
    arrivoPrevisto: 'Arrivo previsto',
    partito: 'Partito',
    ultimaPosizione: 'Ultima posizione',
    precisione: 'Precisione',
    circa: (metri: number) => `circa ${metri} m`,
    nessuna: '—',
    tu: (quando: string) => `Tu · aggiornata ${quando}`,
    delle: (ora: string) => `Posizione delle ${ora}`,
    mappa: 'Mappa con la tua ultima posizione e il cerchio di precisione',
    vecchia: {
      titolo: (ora: string) => `Gli amici vedono una posizione delle ${ora}`,
      testo:
        'Da più di 5 minuti il telefono non la aggiorna. Tieni Noxa aperta o controlla la rete.',
    },
    offline: {
      titolo: 'Le posizioni ripartono con la rete',
      testo: (ora: string) => `Se alle ${ora} non confermi, l’allerta parte lo stesso dal server.`,
    },
    nessunRitorno: 'Non hai un ritorno attivo.',
    torna: 'Torna a Vivi',
  },
  proroga: {
    titolo: 'Proroga l’arrivo',
    ora: (ora: string) => `Ora è previsto alle ${ora}. Gli amici vedono il nuovo orario.`,
    piu15: '+15 min',
    piu30: '+30 min',
    scelta: 'Di quanto prorogare',
    nuovo: 'Nuovo arrivo previsto alle',
    limite: (ora: string) =>
      `Il ritorno può durare al massimo 4 ore dall’avvio (fino alle ${ora}). Se ti serve ancora tempo, concludi questo e avviane un altro.`,
    annulla: 'Annulla',
    conferma: 'Proroga',
    fatto: (ora: string) => `Arrivo previsto spostato alle ${ora}.`,
    errore: 'La proroga non è riuscita. Riprova.',
  },
  annulla: {
    titolo: 'Annullare il ritorno?',
    testo: 'Gli amici sapranno che hai annullato e smettono di vedere la tua posizione.',
    no: 'No, continua',
    si: 'Annulla ritorno',
  },
  chiLoVede: {
    sopratitolo: 'Il tuo ritorno',
    titolo: 'Chi lo vede',
    sottotitolo: (ora: string) => `Arrivo ${ora}`,
    destinatari: 'Destinatari',
    conteggio: (n: number) => `${n} di 5`,
    togli: 'Togli',
    togliPersona: (nome: string) => `Togli ${nome}`,
    conferma: (nome: string) => `Togliere ${nome}?`,
    confermaTesto: 'Smette subito di vedere la tua posizione.',
    confermaUltima: 'È l’ultima persona: se la togli, il ritorno si annulla e lo sa.',
    no: 'No',
    si: 'Togli',
    siUltima: 'Togli e annulla',
    nota: 'Chi togli smette subito di vedere la tua posizione. Se togli l’ultima persona, il ritorno si annulla.',
    tolto: (nome: string) => `${nome} non vede più il ritorno.`,
    errore: 'Non siamo riusciti a toglierlo. Riprova.',
  },
  avvia: {
    titolo: 'Avvia il ritorno sicuro',
    passo: (n: number) => `Passo ${n} di 4`,
    cambia: 'Cambia',
    continua: 'Continua',
    arrivo: {
      titolo: 'Arrivo previsto',
      scorciatoie: 'Tra quanto arrivi',
      min30: '30 min',
      ora1: '1 ora',
      ora1e30: '1 ora e ½',
      orario: 'Oppure scegli l’orario',
      previstoAlle: 'Arrivo previsto alle',
      limiti: (da: string, a: string) =>
        `Tra 10 minuti e 4 ore da adesso (${da} – ${a}). Potrai prorogarlo.`,
      fuori: 'Scegli un orario tra 10 minuti e 4 ore da adesso.',
      riassunto: (ora: string, tra: string) => `Alle ${ora}, tra ${tra}`,
    },
    chi: {
      titolo: 'Chi lo vede',
      conteggio: (n: number) => `${n} di 5`,
      selezionati: (n: number) => `${n} di 5 amici selezionati`,
      dallaSerata: (titolo: string) => `Dalla serata ${titolo}`,
      tornaConTe: 'Torna con te',
      altri: 'Altri amici',
      cerca: 'Cerca tra i tuoi amici',
      limite: 'Hai già scelto 5 amici: togline uno per aggiungerla.',
      regola: 'Da 1 a 5 amici confermati, scelti ogni volta.',
      nessunAmico:
        'Non hai ancora amici confermati. Il ritorno si condivide solo con loro: aggiungili da Amici.',
      nessunRisultato: 'Nessun amico con questo nome.',
      caricamento: 'Carico i tuoi amici',
      errore: 'Gli amici non si sono caricati. Riprova.',
    },
    area: {
      titolo: 'Area di arrivo',
      facoltativa: 'facoltativa',
      nessuna: 'Nessuna, confermo io',
      nessunaTesto: 'Tocchi «Sono arrivato» quando sei arrivato.',
      dettaglio: (raggio: number) =>
        `Arrivo automatico · raggio ${raggio} m · solo su questo telefono`,
      vuoto:
        'Puoi salvare un’area in Profilo › Privacy e dati › Ritorno sicuro. Resta solo su questo telefono.',
    },
    riepilogo: {
      titolo: 'Riepilogo',
      chi: (nomi: string) => `${nomi} vedono dove sei fino a quando arrivi.`,
      chiUno: (nome: string) => `${nome} vede dove sei fino a quando arrivi.`,
      allerta: (ora: string) =>
        `Se alle ${ora} non hai confermato, li avvisiamo, anche se il telefono è spento o senza rete.`,
      cancella: 'Le posizioni si cancellano 24 ore dopo.',
      pwa: {
        titolo: 'Su questo telefono funziona solo con Noxa aperta.',
        testo: 'Con lo schermo bloccato gli amici vedono l’ultima posizione.',
      },
      avvia: 'Avvia',
    },
    fatto: (n: number) => `Ritorno avviato: lo vedono ${amici(n)}.`,
    esclusi: {
      titolo: (nomi: string) => `Abbiamo tolto ${nomi}`,
      testo: 'Non è più tra i tuoi amici, quindi non vede il ritorno.',
    },
    errori: {
      rete: {
        titolo: 'Il ritorno non è partito',
        testo: 'Manca la rete: nessuno vede la tua posizione. Riprova quando sei connesso.',
      },
      giaAttivo: {
        titolo: 'Hai già un ritorno attivo',
        testo: 'Lo trovi in Vivi. Concludilo prima di avviarne un altro.',
      },
      troppi: {
        titolo: 'Hai avviato molti ritorni oggi',
        testo: 'Ne puoi avviare al massimo 10 in 24 ore.',
      },
      arrivo: {
        titolo: 'L’orario non va bene',
        testo: 'Scegli un arrivo tra 10 minuti e 4 ore da adesso.',
      },
      senzaAmici: {
        titolo: 'Nessuno tra i destinatari è tuo amico',
        testo: 'Scegli da 1 a 5 amici confermati.',
      },
      generico: {
        titolo: 'Il ritorno non è partito',
        testo: 'Non è colpa tua: riprova tra un attimo.',
      },
    },
  },
  permessi: {
    sopratitolo: 'Ritorno sicuro',
    spiegazione: {
      titolo: 'La tua posizione, solo durante il ritorno',
      testo: 'Prima che il telefono te lo chieda, ecco a cosa serve.',
      punti: [
        {
          titolo: 'Perché serve',
          testo:
            'Gli amici che scegli vedono dove sei mentre torni; se non arrivi, l’allerta parte con l’ultima posizione.',
        },
        {
          titolo: 'Solo durante il ritorno',
          testo: 'Da «Avvia» a «Sono arrivato». Mai in un altro momento.',
        },
        { titolo: 'Chi la vede', testo: 'Solo gli amici che scegli, da 1 a 5, ogni volta.' },
        { titolo: 'Quando si cancella', testo: '24 ore dopo la fine del ritorno.' },
      ],
      android: {
        titolo: 'Sull’app Android consenti la posizione e le notifiche.',
        testo:
          'Una notifica fissa ti ricorda che il ritorno è attivo e tiene la posizione aggiornata anche con lo schermo bloccato.',
      },
      nonOra: 'Non ora',
      continua: 'Continua',
    },
    negata: {
      titolo: 'Posizione negata',
      testo:
        'Senza posizione il ritorno sicuro non può partire. Puoi sempre usare il check-in, che non la chiede.',
      avviso: 'Hai negato la posizione a Noxa',
      avvisoTesto: 'Se cambi idea, la riattivi dalle impostazioni del telefono.',
      percorsoApp: ['Impostazioni', 'App', 'Noxa', 'Posizione', 'Consenti'],
      percorsoBrowser: ['Impostazioni del browser', 'Siti', 'Noxa', 'Posizione', 'Consenti'],
      apriImpostazioni: 'Apri le impostazioni',
      torna: 'Torna a Vivi',
    },
    spenta: {
      titolo: 'Posizione spenta',
      testo: 'Il permesso c’è, ma la posizione del telefono è spenta.',
      avviso: 'Accendi la posizione del telefono',
      avvisoTesto: 'Poi torna qui e riprova: non serve rifare nient’altro.',
      percorso: ['Impostazioni rapide', 'Posizione'],
      riprova: 'Riprova',
    },
    imprecisa: {
      titolo: (metri: number) => `Precisione circa ${metri} m`,
      testo:
        'Gli amici vedranno un cerchio grande. Spesso migliora all’aperto o con la posizione precisa attiva.',
      avvia: 'Avvia lo stesso',
    },
    attesa: 'Cerco la tua posizione',
  },
  amico: {
    sopratitolo: 'Vivi',
    etichetta: 'Ritorno sicuro',
    inViaggio: 'In viaggio',
    inRitardo: 'In ritardo',
    arrivato: 'Arrivato',
    terminato: 'Terminato',
    arrivoPrevisto: 'Arrivo previsto',
    ultimaPosizione: 'Ultima posizione',
    aggiornata: 'Aggiornata',
    precisione: 'Precisione',
    arrivoRiga: (ora: string) => `Arrivo previsto ${ora}`,
    allaRiga: (ora: string) => `Alle ${ora}`,
    etichettaMappa: (quando: string) => `Aggiornata ${quando}`,
    etichettaMappaVecchia: (ora: string) => `Ultima posizione alle ${ora}`,
    mappa: (nome: string) => `Mappa con l’ultima posizione di ${nome} e il cerchio di precisione`,
    nessunaPosizione: 'Ancora nessuna posizione: arriva appena il telefono la trova.',
    privacy:
      'Vedi solo l’ultima posizione, finché il ritorno è attivo. Nessun percorso, nessun indirizzo.',
    allerta: {
      titolo: (nome: string, ora: string) => `${nome} non ha confermato l’arrivo delle ${ora}`,
      posizione: (ora: string, metri: number) =>
        `Ultima posizione alle ${ora}, precisione circa ${metri} m.`,
      senzaPosizione: 'Non abbiamo ricevuto posizioni dal telefono.',
      cosaFare: 'Cosa puoi fare',
      passi: [
        'Prova a sentire la persona, con il telefono o come fate di solito.',
        'Se pensi che sia in pericolo, chiama il 112.',
      ],
    },
    esito: {
      arrivato: (nome: string, ora: string) => `${nome} ha confermato l’arrivo alle ${ora}`,
      arrivatoTesto: (ora: string) =>
        `Non vedi più la sua posizione. Questa schermata sparisce alle ${ora}.`,
      terminato: (nome: string) => `Il ritorno di ${nome} è terminato`,
      annullato: 'L’ha annullato. La posizione non si vede più.',
      scaduto: 'Si è concluso da solo. La posizione non si vede più.',
    },
    nonDisponibile: 'Non è più disponibile',
    nonDisponibileTesto: 'Il ritorno che volevi aprire non si può più vedere.',
    caricamento: 'Carico il ritorno',
    errore: 'Il ritorno non si è caricato.',
    apri: (nome: string) => `Apri il ritorno di ${nome}`,
  },
  amici: {
    etichetta: 'Ritorni degli amici',
  },
  notifica: {
    titolo: {
      ritorno_avviato: (nome: string) => `${nome} ha avviato il ritorno sicuro`,
      ritorno_allerta: (nome: string) => `${nome} non ha confermato l’arrivo`,
      ritorno_arrivato: (nome: string) => `${nome} ha confermato il rientro`,
    },
    vedi: 'Vedi ritorno',
    finito: 'Il ritorno è terminato: la posizione non si vede più.',
  },
  aree: {
    etichetta: 'Ritorno sicuro',
    spiegazione:
      'Le aree di arrivo restano solo su questo telefono. Noxa non conosce il tuo indirizzo.',
    titolo: 'Aree di arrivo',
    conteggio: (n: number) => (n === 1 ? '1 area' : `${n} aree`),
    raggio: (metri: number) => `raggio ${metri} m · solo qui`,
    vuoto: 'Nessuna area. Puoi sempre confermare l’arrivo a mano.',
    aggiungi: 'Aggiungi area',
    elimina: 'Elimina',
    eliminaArea: (nome: string) => `Elimina l’area ${nome}`,
    eliminata: (nome: string) => `Area ${nome} eliminata.`,
    cancellazione: 'Le posizioni dei ritorni si cancellano 24 ore dopo la fine.',
    limite: 'Puoi salvare al massimo 10 aree.',
    nuova: {
      titolo: 'Nuova area di arrivo',
      testo:
        'Parte da dove sei ora. Sposta il segnaposto sulla mappa per mettere il centro dove vuoi.',
      mappa: 'Mappa del centro dell’area di arrivo',
      segnaposto: 'Centro',
      centro: 'Centro dell’area',
      nome: 'Nome',
      segnapostoNome: 'Casa',
      aiutoNome: 'Un nome tuo, per esempio «Casa» o «Da Sara». Niente indirizzi.',
      raggio: 'Raggio',
      soloQui: 'Resta solo su questo telefono: non la mandiamo a Noxa.',
      annulla: 'Annulla',
      salva: 'Salva qui',
      salvata: (nome: string) => `Area ${nome} salvata su questo telefono.`,
      nonSalvata: 'Questo browser non permette di salvare dati sul telefono.',
      cerco: 'Cerco la tua posizione',
      fuoriMappa:
        'Sei fuori dalla zona della mappa: le aree si salvano solo a Milano e in Brianza.',
    },
  },
  tempo: {
    adesso: 'adesso',
    minFa: (n: number) => `${n} min fa`,
    oraFa: 'più di un’ora fa',
    tra: (minuti: number) => {
      const ore = Math.floor(minuti / 60);
      const resto = minuti % 60;
      if (ore === 0) return `${resto} min`;
      if (resto === 0) return ore === 1 ? '1 ora' : `${ore} ore`;
      return `${ore} h ${resto} min`;
    },
  },
};
