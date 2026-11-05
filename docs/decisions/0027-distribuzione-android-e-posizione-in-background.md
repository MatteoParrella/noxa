# ADR-0027: Distribuzione su Google Play per ultima e posizione in background open source

- **Stato**: Accettato
- **Data**: 2026-11-05

## Contesto
Il ritorno sicuro (ADR-0006) ha valore solo se la posizione arriva anche con lo schermo
bloccato, e questo nella PWA non è possibile. Serve quindi un'app nativa, ma gli account
degli store costano (D-13: Apple 99 $ l'anno, Google Play 25 $ una tantum) e il budget è
minimo (ADR-0021). Il product owner vuole pubblicare negli store solo quando l'app è
completa e curata, non durante lo sviluppo. Restava da scegliere anche il plugin Capacitor
per la posizione in background (D-04).

## Decisione
- **Plugin (D-04 chiusa)**: `@capacitor-community/background-geolocation`, open source e
  gratuito, con la notifica di sistema permanente durante la sessione (R-31). Nessun plugin
  commerciale.
- **Android sì, su Google Play per ultimo**: l'account Google Play Console (25 $ una tantum)
  si crea solo nell'iterazione 12, a funzionalità complete e verificate. Fino ad allora la
  build Android si prova sui telefoni del team installando l'APK di debug da Android Studio,
  senza account e senza costi. Le notifiche native Android passano da FCM con un progetto
  Firebase gratuito, aggiunto a `invia-push` con gli stessi testi di sistema (ADR-0026).
- **iOS rimandato**: niente account Apple Developer finché il product owner non decide;
  D-13 resta aperta solo per Apple. Su iPhone Noxa resta la PWA, con il ritorno sicuro solo
  in primo piano (ADR-0006).
- **Dominio (D-01)**: si compra quando si crea lo staging per la beta PWA, come previsto da
  ADR-0021; serve anche agli App Links di Android per aprire nell'app i link delle email.

## Alternative considerate
- **Solo PWA**: gratis, ma il ritorno sicuro in background non esisterebbe su nessun
  telefono, che è il motivo stesso di ADR-0006.
- **Entrambi gli store subito**: 99 $ l'anno in più per Apple prima di sapere se la beta
  funziona, e una revisione Apple più severa su minorenni e posizione.
- **Account Google Play subito con test interni**: l'APK di debug basta per le prove sui
  dispositivi; l'account aggiungerebbe una scheda dello store da tenere aggiornata durante lo
  sviluppo senza un vantaggio per le prove.
- **Plugin commerciale per la posizione**: più affidabile su iOS, che però è rimandato; ha
  un costo annuo.

## Conseguenze
- Il criterio 1 della Fase 2 si verifica su Android con l'APK di debug; la parte iOS si
  aggiunge quando D-13 si chiude per Apple.
- Con un account personale, Google chiede un test chiuso con almeno 12 tester per 14 giorni
  prima della pubblicazione: va messo in calendario nell'iterazione 12, dopo la creazione
  dell'account, insieme alla dichiarazione d'uso della posizione in background (con video) e
  al questionario del pubblico (D-06).
- I link delle email aperti nell'app Android (App Links) richiedono il dominio di D-01; finché
  manca si aprono nel browser.
- Documenti aggiornati: DECISIONI_APERTE.md (D-04, D-13), ROADMAP.md (Fase 2, iterazioni 10
  e 12), PRD.md (F-43), ARCHITECTURE.md, GUIDA_OPERATIVA.md, ADR-0006, ADR-0026.
