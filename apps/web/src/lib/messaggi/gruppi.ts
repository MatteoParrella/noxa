/**
 * Testi di gruppi e serate di gruppo (design/F-13-gruppi, design/F-14-serata): "tu", frasi
 * brevi, chiari sulle regole senza allarmismo, nessuna pressione (R-43).
 */

const persone = (n: number) => (n === 1 ? '1 persona' : `${n} persone`);

export const gruppi = {
  organizza: {
    sottotitolo: 'Amici e gruppi',
    titolo: 'Organizza',
    schede: 'Amici e gruppi',
    amici: 'Amici',
    gruppi: 'Gruppi',
  },

  elenco: {
    titolo: 'I miei gruppi',
    crea: 'Crea un gruppo',
    caricamento: 'Carico i gruppi',
    inviti: 'Inviti ricevuti',
    tuoiGruppi: 'I tuoi gruppi',
    prossimeSerate: 'Le prossime serate dei tuoi gruppi',
    admin: 'Admin',
    membri: (n: number) => (n === 1 ? '1 membro' : `${n} membri`),
    conteggio: (n: number) => `${n}/30`,
    conteggioMembri: (n: number) => `${n}/30 membri`,
    conteggioAccessibile: (n: number) => `${n} membri su 30`,
    prossima: 'Prossima:',
    nessunaSerata: 'Nessuna serata in programma',
    apri: (nome: string) => `Apri ${nome}`,
    vuoto: {
      titolo: 'Ancora nessun gruppo',
      testo: 'Crea un gruppo con i tuoi amici per organizzare le serate.',
    },
    vuotoSenzaAmici: {
      titolo: 'Ancora nessun gruppo',
      testo:
        'Un gruppo si fa con i tuoi amici confermati. Prima aggiungi qualcuno dagli Amici, poi crea un gruppo per organizzare le serate.',
      azione: 'Vai agli Amici',
    },
    errore: {
      titolo: 'I gruppi non si sono caricati',
      testo: 'Colpa nostra o della rete. Riprova tra un attimo.',
    },
    offline: 'Sei offline: vedi i gruppi salvati. Crea, invita e rispondi quando torna la rete.',
  },

  invito: {
    voce: (chi: string, gruppo: string) => `${chi} ti invita in «${gruppo}»`,
    voceAnonima: (gruppo: string) => `Sei invitato in «${gruppo}»`,
    accetta: 'Accetta',
    rifiuta: 'Rifiuta',
    dettagli: 'Vedi chi c’è',
    titolo: (gruppo: string) => `Invito in «${gruppo}»`,
    caricamento: 'Carico l’invito',
    chiTiInvita: 'Ti invita',
    conosci: 'Persone che conosci',
    altri: (n: number) => (n === 1 ? 'e un’altra persona' : `e altre ${n} persone`),
    nessunoConosciuto: 'Nel gruppo non ci sono altre persone che conosci.',
    spiegazione:
      'Se accetti, i membri del gruppo vedono il tuo profilo e le tue risposte alle serate. Puoi uscire quando vuoi.',
    rifiutaTesto: 'Nessuno riceve un avviso se rifiuti.',
    accettato: (gruppo: string) => `Sei entrato in «${gruppo}»`,
    rifiutato: 'Invito rifiutato',
    nonValido: {
      titolo: 'Questo invito non è più valido',
      testo:
        'Il gruppo potrebbe essere pieno, essere stato eliminato o essere cambiato. Non è colpa tua: se vuoi, chiedi a chi ti ha invitato di riprovare.',
    },
  },

  crea: {
    titolo: 'Crea un gruppo',
    nome: 'Nome del gruppo',
    nomeAiuto: 'Per esempio «Quelli del sabato». Lo vedono solo i membri.',
    invita: 'Invita amici',
    invitaFacoltativo: 'Puoi invitare anche dopo.',
    conferma: 'Crea il gruppo',
    creato: (inviti: number) =>
      inviti === 0
        ? 'Gruppo creato'
        : `Gruppo creato · ${inviti === 1 ? '1 invito inviato' : `${inviti} inviti inviati`}`,
    errori: {
      nomeMancante: 'Scrivi un nome per il gruppo.',
      nomeLungo: 'Il nome può avere al massimo 40 caratteri.',
      pieno: 'Il gruppo può avere al massimo 30 membri: togli qualcuno dalla selezione.',
      nonInvitabile:
        'Qualcuno tra gli amici scelti non si può più invitare: controlla la selezione e riprova.',
      troppi: 'Hai creato molti gruppi oggi: riprova domani.',
      generico: 'Il gruppo non è stato creato. Controlla la connessione e riprova.',
    },
  },

  selettore: {
    cerca: 'Cerca tra i tuoi amici',
    regola:
      'Per sicurezza, in un gruppo con minorenni tutti devono essere amici tra loro. Per questo qualcuno può non essere invitabile.',
    selezionati: (n: number, totale: number) =>
      `${n === 1 ? '1 selezionato' : `${n} selezionati`} · ${totale}/30`,
    selezionatiAccessibile: (n: number, totale: number) =>
      `${n === 1 ? '1 amico selezionato' : `${n} amici selezionati`}, ${totale} membri su 30`,
    caricamento: 'Carico i tuoi amici',
    nessunAmico: 'Non hai ancora amici confermati da invitare.',
    nessunRisultato: 'Nessun amico con questo nome.',
    motivi: {
      gia_nel_gruppo: 'È già nel gruppo',
      invito_in_attesa: 'Ha già un invito in attesa',
      fasce: 'Non è amico di tutte le persone del gruppo',
      non_disponibile: 'Non può entrare in questo gruppo',
      pieno: 'Il gruppo è pieno',
    },
    errore: 'Non riesco a caricare i tuoi amici. Riprova tra un attimo.',
  },

  dettaglio: {
    etichetta: 'Gruppo',
    caricamento: 'Carico il gruppo',
    creatoDa: (nome: string) => `Creato da ${nome}`,
    tu: '(tu)',
    invitaAmici: 'Invita amici',
    proponi: 'Proponi una serata',
    serate: 'Serate',
    nessunaSerata: 'Nessuna serata in programma. Proponine una quando volete uscire.',
    passate: (n: number) => `Serate passate · ${n}`,
    membri: 'Membri',
    invitato: 'Invitato',
    altri: (n: number) =>
      n === 1 ? 'e un’altra persona che non vedi' : `e altre ${n} persone che non vedi`,
    altreAzioni: (nome: string) => `Altre azioni per ${nome}`,
    altreAzioniMembro: (username: string) => `Altre azioni per @${username}`,
    vediProfilo: 'Vedi profilo',
    segnala: 'Segnala',
    blocca: 'Blocca',
    rendiAdmin: 'Rendi admin',
    togli: 'Togli dal gruppo',
    rinomina: 'Rinomina',
    segnalaNome: 'Segnala il nome',
    esci: 'Esci dal gruppo',
    elimina: 'Elimina il gruppo',
    risposte: (si: number, forse: number) => `${si} sì · ${forse} forse`,
    nonDisponibile: {
      titolo: 'Non fai più parte di questo gruppo',
      testo: 'Il gruppo e le sue serate non sono più visibili per te.',
      torna: 'Torna a Organizza',
    },
    errore: {
      titolo: 'Il gruppo non si è caricato',
      testo: 'Colpa nostra o della rete. Riprova tra un attimo.',
    },
    offline: 'Sei offline: vedi il gruppo salvato. Le azioni tornano quando c’è rete.',
    erroreAzione: 'Non è andata: controlla la connessione e riprova.',
    invitiInviati: (n: number) => (n === 1 ? '1 invito inviato' : `${n} inviti inviati`),
    adminNominato: (nome: string) => `${nome} ora è admin`,
    tolto: (nome: string) => `${nome} non fa più parte del gruppo`,
    rinominato: 'Nome cambiato',
  },

  conferme: {
    annulla: 'Annulla',
    esci: {
      titolo: (gruppo: string) => `Uscire da «${gruppo}»?`,
      effetto:
        'Non vedrai più il gruppo e le sue serate. Le tue risposte alle serate spariscono. Per rientrare serve un nuovo invito.',
      conferma: 'Esci dal gruppo',
      scegliAdmin: 'Sei l’unico admin: scegli chi lo diventa al posto tuo.',
      nuovoAdmin: 'Nuovo admin',
      nessunAltro:
        'Sei l’ultima persona del gruppo: uscendo, il gruppo e le sue serate verranno eliminati.',
    },
    togli: {
      titolo: (nome: string) => `Togliere ${nome} dal gruppo?`,
      effetto:
        'Non vedrà più il gruppo e le sue serate. Riceve un avviso, senza sapere chi l’ha tolto.',
      conferma: 'Togli dal gruppo',
    },
    elimina: {
      titolo: (gruppo: string) => `Eliminare «${gruppo}»?`,
      effetto: 'Le serate del gruppo verranno eliminate per tutti. Non si può annullare.',
      conferma: 'Elimina il gruppo',
    },
    rinomina: {
      titolo: 'Rinomina il gruppo',
      conferma: 'Salva',
    },
    invita: {
      titolo: 'Invita amici',
      sottotitolo: (gruppo: string) => `In «${gruppo}» · solo tra i tuoi amici confermati.`,
      conferma: (n: number) =>
        n === 0 ? 'Invita' : n === 1 ? 'Invita 1 amico' : `Invita ${n} amici`,
    },
  },

  segnala: {
    titoloGruppo: 'Segnala il nome del gruppo',
    titoloSerata: 'Segnala titolo, luogo o note',
    spiegazione: 'Tocca un motivo: la segnalazione parte subito. Resta anonima.',
    motivi: [
      { valore: 'contenuto_inappropriato', etichetta: 'Contenuto inappropriato' },
      { valore: 'molestie', etichetta: 'Molestie o offese' },
      {
        valore: 'adescamento_o_rischio_minore',
        etichetta: 'Mi sembra che metta a rischio una persona minorenne',
      },
      { valore: 'spam', etichetta: 'Spam o truffa' },
      { valore: 'altro', etichetta: 'Altro' },
    ],
  },

  serata: {
    proposta: 'Proposta',
    confermata: 'Confermata',
    annullata: 'Annullata',
    passata: 'Passata',
    libera: 'Serata libera',
    caricamento: 'Carico la serata',
    ritrovo: (ora: string | null, luogo: string | null) =>
      [ora ? `Ritrovo ${ora}` : null, luogo].filter(Boolean).join(' · ') || 'Ritrovo da decidere',
    gruppoProposta: (gruppo: string, chi: string | null) =>
      chi ? `${gruppo} · proposta da ${chi}` : gruppo,
    miaRisposta: 'La mia risposta',
    risposte: { si: 'Sì', forse: 'Forse', no: 'No' },
    conti: (si: number, forse: number, no: number) => `${si} sì · ${forse} forse · ${no} no`,
    rispostaAiuto: 'Puoi cambiare idea quando vuoi. Il gruppo vede la tua risposta.',
    nonRisposto: 'Non hai ancora risposto. Puoi cambiare idea quando vuoi.',
    nonRispostoBreve: 'Da rispondere',
    rispostaSalvata: (risposta: string) => `Hai risposto ${risposta}`,
    aggiornamento: (nome: string, risposta: string) => `${nome} ha risposto ${risposta}`,
    chiCe: 'Chi c’è',
    gruppiRisposta: { si: 'Sì', forse: 'Forse', no: 'No', nessuna: 'Non hanno risposto' },
    altri: (n: number) => `${persone(n)} del gruppo che non vedi`,
    biglietti: 'Biglietti',
    prevendita: 'Prevendita',
    lista: 'Lista',
    fuoriNoxa: 'fuori da Noxa',
    mioBiglietto: 'Il mio biglietto',
    statiBiglietto: {
      nessuno: 'Nessuno',
      prevendita: 'Prevendita',
      lista: 'In lista',
      alla_cassa: 'Alla cassa',
    },
    riepilogoBiglietti: (prevendita: number, lista: number, cassa: number) =>
      `${prevendita} in prevendita · ${lista} in lista · ${cassa} alla cassa`,
    nessunPagamento: 'Noxa non vende biglietti: i link aprono i siti del locale.',
    trasporto: 'Trasporto',
    comeVai: 'Come vai?',
    comeTorni: 'Come torni?',
    andata: 'andata',
    ritorno: 'ritorno',
    mezzi: {
      auto_guido: 'Guido',
      passaggio: 'Passaggio',
      mezzi_pubblici: 'Mezzi pubblici',
      taxi_ncc: 'Taxi/NCC',
      a_piedi: 'A piedi',
      altro: 'Altro',
    },
    postiLiberi: 'Posti liberi',
    postiMeno: 'Un posto in meno',
    postiPiu: 'Un posto in più',
    passaggioDa: 'Passaggio da…',
    postiRimasti: (n: number) =>
      n === 0 ? 'nessun posto libero' : n === 1 ? '1 posto libero' : `${n} posti liberi`,
    nessunoGuida: 'Per ora nessuno del gruppo guida.',
    autoDelGruppo: 'Auto del gruppo',
    guida: 'guida',
    libero: 'libero',
    liberi: (n: number) => (n === 1 ? '1 libero' : `${n} liberi`),
    avvisoRitorno: (n: number) =>
      n === 1
        ? '1 persona che viene non ha ancora un mezzo per tornare'
        : `${n} persone che vengono non hanno ancora un mezzo per tornare`,
    avvisoRitornoTesto: 'Chi non l’ha ancora fatto può sceglierlo qui sotto.',
    daDecidere: 'Da decidere',
    note: 'Note',
    menu: (titolo: string) => `Altre azioni per ${titolo}`,
    conferma: 'Conferma la serata',
    annulla: 'Annulla la serata',
    segnala: 'Segnala titolo, luogo o note',
    annullaTitolo: (titolo: string) => `Annullare «${titolo}»?`,
    annullaEffetto:
      'Tutti i membri del gruppo ricevono una notifica. La serata resta visibile in sola lettura, con il badge «Annullata».',
    indietro: 'Indietro',
    confermataToast: 'Serata confermata · il gruppo riceve una notifica',
    annullataToast: 'Serata annullata',
    annullataAvviso: 'Questa serata è stata annullata: resta in sola lettura.',
    passataAvviso: 'Questa serata è passata: resta in sola lettura.',
    eventoAnnullato:
      'Il locale ha annullato l’evento. La serata resta qui, così potete decidere cosa fare.',
    offline: 'Sei offline: vedi la serata salvata. Risposte e cambi tornano quando c’è rete.',
    nonDisponibile: {
      titolo: 'Questa serata non è disponibile',
      testo: 'Potrebbe essere stata eliminata o non essere più visibile per te.',
      torna: 'Torna a Organizza',
    },
    errore: {
      titolo: 'La serata non si è caricata',
      testo: 'Colpa nostra o della rete. Riprova tra un attimo.',
    },
    erroreRisposta: 'La risposta non è stata salvata. Controlla la connessione e riprova.',
    erroriTrasporto: {
      guida_solo_maggiorenni: 'Solo chi ha almeno 18 anni può guidare.',
      posti_esauriti: 'In quest’auto non ci sono più posti.',
      passaggio_non_disponibile: 'Questo passaggio non è più disponibile.',
    },
    esterno: {
      titolo: 'Stai lasciando Noxa',
      testo: (dominio: string) =>
        `Apriamo ${dominio} nel browser. Noxa non gestisce pagamenti e non vede cosa compri.`,
      resta: 'Resta qui',
      apri: 'Apri il sito',
    },
  },

  proponi: {
    titolo: 'Proponi una serata',
    daEvento: 'Da un evento',
    libera: 'Serata libera',
    modo: 'Tipo di serata',
    cerca: 'Cerca un evento o un locale',
    regola: 'Mostriamo solo le serate adatte a tutto il gruppo.',
    caricamento: 'Carico gli eventi adatti',
    nessunEvento: {
      titolo: 'Nessun evento adatto a tutto il gruppo in questi giorni',
      testo:
        'Puoi proporre una serata libera: una pizza, un concerto all’aperto, una sera da qualcuno.',
      azione: 'Proponi una serata libera',
    },
    erroreEventi: 'Non riesco a caricare gli eventi. Riprova tra un attimo.',
    titoloSerata: 'Titolo della serata',
    data: 'Data',
    ritrovo: 'Ritrovo',
    facoltativo: 'facoltativo',
    ora: 'Ora del ritrovo',
    luogo: 'Luogo del ritrovo',
    bigliettiSezione: 'Biglietti',
    urlPrevendita: 'Link alla prevendita',
    urlLista: 'Link alla lista',
    urlAiuto: 'Solo link che iniziano con https://',
    note: 'Note per il gruppo',
    noteAiuto: 'Le vedono solo i membri del gruppo.',
    piede: 'Il gruppo riceve una notifica.',
    conferma: 'Proponi',
    fatto: {
      titolo: 'Serata proposta',
      testo: (gruppo: string) =>
        `Il gruppo «${gruppo}» riceve una notifica. Le risposte arrivano qui man mano.`,
      apri: 'Apri la serata',
      torna: 'Torna al gruppo',
    },
    errori: {
      eventoMancante: 'Scegli un evento dall’elenco.',
      titoloMancante: 'Scrivi un titolo per la serata.',
      dataMancante: 'Scegli la data della serata.',
      dataPassata: 'La data è già passata: scegline una da oggi in poi.',
      link: 'Il link deve iniziare con https://',
      eventoNonAdatto:
        'Questo evento non è più disponibile per tutto il gruppo. Scegline un altro o proponi una serata libera.',
      generico: 'La serata non è stata proposta. Controlla la connessione e riprova.',
    },
  },
} as const;
