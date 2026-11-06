# ADR-0028: Ritorno sicuro: servizio in primo piano, posizioni lette con la RLS e dati solo sul telefono

- **Stato**: Accettato
- **Data**: 2026-11-06

## Contesto
L'iterazione 10 implementa il ritorno sicuro (F-21) con il plugin
`@capacitor-community/background-geolocation` (ADR-0027) e l'allerta dal server (ADR-0006).
ARCHITECTURE.md §4.4 prevedeva che l'app pubblicasse le posizioni su un canale Realtime
Broadcast e le salvasse a parte; il brief di design chiedeva "Consenti sempre" su Android, una
proroga dell'arrivo previsto, un'area di arrivo di 150 m e l'azione "Sono arrivato" nella
notifica fissa. Implementandolo sono emersi vincoli tecnici che cambiano alcuni dettagli.

## Decisione
- **Servizio in primo piano, nessun permesso di posizione in background.** Il plugin avvia un
  servizio Android di tipo `location` con la notifica fissa (R-31): con il permesso "Mentre usi
  l'app" la posizione arriva anche con lo schermo bloccato. Non si chiede
  `ACCESS_BACKGROUND_LOCATION` ("Consenti sempre"), che non serve e complica la revisione di
  Google Play. Si chiede il permesso delle notifiche (Android 13+), senza il quale la notifica
  fissa non compare. Il bridge legacy di Capacitor (`android.useLegacyBridge`) evita che la
  posizione si fermi dopo 5 minuti in background; nell'app le posizioni si inviano con il client
  HTTP nativo, che Android non rallenta.
- **Le coordinate non viaggiano su Realtime.** L'app chiama la RPC `invia_posizione_ritorno`
  (al massimo una posizione ogni 30 secondi, controllata dal database); un trigger invia un
  avviso **senza dati** sul canale privato `ritorno:<id>` e chi guarda rilegge l'ultima posizione
  con la RLS (`ritorni_vivi`), come per gruppi e serate (ADR-0024). Così una sola strada scrive
  le posizioni, la RLS decide sempre chi le vede e nessuna coordinata passa dai log di Realtime.
- **Chi riceve vede solo l'ultima posizione e solo a ritorno attivo**; con l'esito (15 minuti)
  la posizione non si vede più. Le notifiche contengono solo identificativi.
- **Proroga** di 15 o 30 minuti con la RPC `proroga_ritorno`, sempre entro 4 ore dall'avvio;
  dopo un'allerta la proroga riporta il ritorno "in viaggio" e l'allerta può ripartire.
- **Dati solo sul telefono (R-32)**: le aree di arrivo (nome, centro, raggio di 100, 150 o
  300 m, al massimo 10) e, per il ritorno avviato lì, la tratta e l'area scelta stanno nel
  `localStorage` del dispositivo. Il database non ha colonne per l'area né per la destinazione.
  L'arrivo nell'area conclude il ritorno dopo un minuto in cui si può toccare "Non ero arrivato".
- **Un telefono per ritorno**: la posizione si condivide solo dal dispositivo che ha avviato il
  ritorno; dagli altri si può concludere o prorogare.
- **Limiti anti-abuso**: al massimo 10 ritorni in 24 ore per persona (ognuno avvisa gli amici).
- **Notifica fissa senza pulsante**: il plugin non permette azioni nella notifica; il tocco apre
  Noxa, dove "Sono arrivato" è nella barra permanente.

## Alternative considerate
- **Broadcast delle coordinate dal telefono**: più immediato, ma una seconda strada di scrittura
  con una policy di `INSERT` su `realtime.messages` e coordinate nei messaggi Realtime.
- **"Consenti sempre" su Android**: necessario solo senza servizio in primo piano; richiede la
  dichiarazione d'uso in background con video a Google e non migliora il ritorno.
- **Area di arrivo sul server**: arrivo automatico anche dagli altri telefoni, ma è un indirizzo
  di casa sul server (R-32).
- **Plugin commerciale con azioni nella notifica**: costo annuo (ADR-0021, ADR-0027).

## Conseguenze
- La dichiarazione della posizione in background su Google Play (iterazione 12) diventa più
  semplice: servizio in primo piano di tipo `location` con notifica visibile.
- I criteri della Fase 2 si verificano su un telefono Android reale con l'APK di debug.
- Documenti aggiornati: DATA_MODEL.md (§5.5, §7, §8), ARCHITECTURE.md (§4.4, §5.3),
  SAFETY_PRIVACY.md (R-31, R-32, §10), PRD.md (F-21), ADR-0006 e ADR-0027 restano validi.
