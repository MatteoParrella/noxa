# ADR-0036: Elenco pubblico delle serate sul sito

- **Stato**: Accettato
- **Data**: 2026-11-23

## Contesto
Fino a oggi senza account non si vedeva nulla (R-07): un link condiviso o una visita al sito
portavano al Benvenuto, e chi non conosceva Noxa non aveva modo di capire che cosa offre. Il
product owner vuole che il sito, più dell'app, mostri le serate anche senza account, ma che
ogni clic porti all'iscrizione: i dettagli sono il vantaggio di chi è iscritto (D-18).

Il vincolo è R-07: senza un'età nota non si possono applicare R-20 e R-23. Chi guarda il sito
senza account può avere 14 anni, e una serata con riferimenti all'alcol non va mostrata a un
minorenne (L. 125/2001; R-23), nemmeno con il solo titolo, che spesso contiene il riferimento.

## Decisione
- **Sul sito**, e solo lì, la pagina di Scopri senza sessione mostra l'elenco delle serate dei
  prossimi 7 giorni in forma ridotta: copertina generata, titolo, locale, comune, data, ora,
  età minima e generi. Nell'app installata (Capacitor) l'accesso resta obbligatorio.
- **Ogni clic** su una pagina dell'app (una serata, la barra delle schede, le altre aree) porta
  all'iscrizione; la pagina scelta si riapre dopo l'accesso. Non esiste un dettaglio pubblico:
  descrizione, prezzo, biglietti, mappa, filtri, amici e partecipazioni restano agli iscritti.
- **Serate con riferimenti all'alcol**: restano nell'elenco ma senza titolo, generi e colori
  della copertina; compaiono come «Serata 18+» con locale, data e ora, e la nota che si vedono
  con un account maggiorenne. L'età minima risulta almeno 18.
- **Database**: l'unico accesso del ruolo `anon` sono due RPC `security definer`,
  `cerca_eventi_pubblici(dal, al)` (al massimo 31 giorni, da ieri a 92 giorni da oggi, 300
  righe; stesse condizioni della policy di `eventi` e di `locali` per un adulto: eventi
  pubblicati o annullati, locali attivi, serate non concluse) e `generi_pubblici()`. Il ruolo
  `anon` continua a non avere policy su nessuna tabella. Le due funzioni non sono eseguibili
  dagli utenti con account, che usano `cerca_eventi` con la propria età (R-20).
- Nessun dato degli utenti nell'elenco pubblico: niente amici, conteggi o partecipazioni
  (R-43), nessuna posizione (R-33), nessun cookie o tracciamento (R-61).

## Alternative considerate
- **Visitatore trattato come un 14enne** (solo serate 14+ senza alcol): la scelta più
  prudente, ma oggi l'elenco sarebbe quasi vuoto e il sito non mostrerebbe che cosa offre.
- **Età chiesta all'ingresso del sito**: un'età dichiarata dal client viola il vincolo 2 di
  CLAUDE.md (età calcolata solo nel database) e si aggira cambiando risposta.
- **Pagina pubblica di dettaglio** per le serate 18+ senza alcol (proposta iniziale di D-18):
  scartata dal product owner, che preferisce tenere i dettagli per gli iscritti.
- **Serate con alcol escluse del tutto**: possibile, ma il product owner vuole che l'elenco
  dica che la serata esiste; senza titolo né generi non resta nessun riferimento all'alcol.

## Conseguenze
- R-07 cambia: senza account si vede solo l'elenco ridotto delle serate sul sito.
  SAFETY_PRIVACY.md, DATA_MODEL.md (§5.3), PRD.md (F-01), ARCHITECTURE.md e DECISIONI_APERTE.md
  (D-18 chiusa) aggiornati; test pgTAP `045_catalogo_pubblico`, e2e `scopri-pubblico.spec.ts`.
- Un minorenne senza account vede l'esistenza di serate 18+ (titolo e locale), come sui siti
  dei locali: è informazione pubblica e non contiene riferimenti all'alcol. Un minorenne con
  account continua a vedere solo le serate a cui può entrare.
- L'elenco è leggibile da chiunque con la chiave pubblica: chi volesse copiarlo ottiene al più
  le serate di una settimana alla volta, che sono già pubblicate dai locali.
- I motori di ricerca non leggono l'elenco (pagina generata nel browser, export statico): le
  pagine per la ricerca richiederebbero un'altra decisione.
