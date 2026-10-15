# Product Requirements Document — Noxa

> Il nome del prodotto è **Noxa**. Il dominio è la decisione aperta D-01
> ([DECISIONI_APERTE.md](DECISIONI_APERTE.md)).

## 1. Visione

Noxa accompagna i ragazzi dai 14 ai 25 anni in tutto il ciclo della serata (**scopri →
organizza → vivi → ricorda**) a Milano e in Brianza, con regole di sicurezza per i minorenni
integrate nel prodotto e non aggiunte dopo.

## 2. Obiettivi e metriche

| Obiettivo | Metrica | Traguardo Fase 1 (beta chiusa) | Traguardo Fase 2 (lancio) |
|---|---|---|---|
| Catalogo eventi affidabile | Eventi pubblicati per settimana nell'area | ≥ 150 | ≥ 300 |
| | Correttezza dei campi chiave (data, locale, età minima) su un campione mensile di 100 eventi | ≥ 95% | ≥ 97% |
| | Precisione della deduplicazione automatica (coppie unite correttamente) | ≥ 98% | ≥ 98% |
| Utilità sociale | Utenti attivi settimanali con almeno un amico confermato | ≥ 60% | ≥ 70% |
| | Serate di gruppo create per settimana ogni 100 utenti attivi | ≥ 5 | ≥ 8 |
| Memoria | Utenti attivi mensili con almeno una serata nel tracker | ≥ 40% | ≥ 50% |
| Fidelizzazione | Retention a 4 settimane | ≥ 25% | ≥ 30% |
| Sicurezza | Contatti adulto–minorenne fuori dalle regole (R-10…R-15) | 0 | 0 |
| | Segnalazioni gestite entro i tempi di R-53 | ≥ 95% | ≥ 98% |
| Qualità | Crash-free sessions (app native) | ≥ 99% | ≥ 99,5% |

Le metriche sono calcolate in forma aggregata nel database (R-62, ADR-0014).

## 3. Utenti tipo

| Persona | Età | Bisogno principale | Vincoli |
|---|---|---|---|
| **Giulia**, studentessa, Monza | 15 | Trovare feste pomeridiane e serali 14+ e capire chi delle amiche ci va. | Vede solo eventi 14+ senza riferimenti all'alcol; può essere trovata solo da minorenni; i genitori le chiedono di condividere il rientro. |
| **Marco**, studente, Lissone | 17 | Organizzare con il gruppo una serata 16+: chi ha la prevendita, chi accompagna. | Non può scegliere "guido l'auto"; è in un gruppo con un amico di 18 anni con cui ha un'amicizia confermata. |
| **Luca**, universitario, Milano | 20 | Scoprire serate techno, tenere traccia di locali, DJ e spese, avere il Wrapped di fine anno. | Non vede eventi 21+; vede la categoria `alcolici` nel tracker. |
| **Sara**, lavoratrice, Seregno | 23 | Coordinare il gruppo: chi guida, posti in auto, chi è in lista; tornare a casa sicura. | Usa il ritorno sicuro con due amiche. |
| **Moderatore** (staff Noxa) | — | Revisionare flyer, risolvere duplicati, gestire segnalazioni nei tempi previsti. | Autenticazione a due fattori; nessun accesso a posizioni e tracker (R-69). |

## 4. Funzionalità

Priorità:
- **P0**: necessaria per il lancio pubblico (MVP).
- **P1**: prevista nel MVP; se è in ritardo il lancio può avvenire senza.
- **P2**: dopo il lancio.

La fase è quella di [ROADMAP.md](ROADMAP.md).

### 4.1 Scopri

| ID | Funzionalità | Priorità | Fase | Criteri di accettazione |
|---|---|---|---|---|
| F-01 | Elenco eventi con filtri per data, distanza, genere musicale ed età minima | P0 | 1 | Mostra solo eventi visibili secondo R-20 e R-23. Ogni evento ha come immagine di sfondo la foto del locale (ADR-0018). Filtri combinabili; la distanza usa la posizione del dispositivo, se concessa, oppure un comune scelto a mano (R-33). Risposta in meno di 800 ms al 95° percentile con 5.000 eventi futuri. |
| F-02 | Mappa degli eventi (MapLibre con basemap Protomaps auto-ospitata, tema scuro e chiaro) | P0 | 1 | Stessi filtri dell'elenco; raggruppamento dei marker; attribuzione OpenStreetMap visibile; utilizzabile anche senza mappa (l'elenco è l'alternativa accessibile). |
| F-03 | Dettaglio evento | P0 | 1 | Foto del locale come immagine di copertina, con attribuzione se richiesta dalla licenza (in mancanza: flyer approvato, poi fondo tipografico; ADR-0018). Titolo, data, orari, locale, età minima (con l'indicazione "età non dichiarata, considerata 18+" se `eta_minima_dichiarata = false`), generi, artisti, prezzo minimo, link alla fonte originale sempre presente, link ai biglietti se disponibile. |
| F-04 | Amici che partecipano in evidenza | P0 | 1 | Nell'elenco e nel dettaglio compaiono il numero e gli avatar degli amici confermati con partecipazione visibile (R-67); filtro "solo eventi con amici". |
| F-05 | "Mi interessa" / "Partecipo" | P0 | 1 | Si imposta in un tocco; la visibilità è regolabile per evento; si annulla in un tocco. |
| F-06 | Caricamento flyer | P0 | 1 | Foto o screenshot (JPEG, PNG, WebP fino a 10 MB); EXIF rimosso; stato visibile a chi ha caricato ("in analisi", "in revisione", "pubblicato", "unito a un evento esistente", "rifiutato" con motivo); pubblicazione solo dopo revisione (R-51); 10 caricamenti al giorno (R-54). |
| F-07 | Eventi dagli aggregatori (Resident Advisor, Xceed, Dice) | P2 | 3 | Solo con accordo scritto o API ufficiale (ADR-0008, D-05). |

### 4.2 Organizza

| ID | Funzionalità | Priorità | Fase | Criteri di accettazione |
|---|---|---|---|---|
| F-10 | Registrazione e profilo | P0 | 1 | Email e password con verifica dell'email; CAPTCHA; data di nascita obbligatoria e immutabile (R-01, R-02); username e nome visualizzato; consenso a termini e informativa con versione (R-63); onboarding che spiega le regole di sicurezza in 3 schermate. |
| F-11 | Amicizie | P0 | 1 | Ricerca per username nella propria fascia (R-10); richiesta e accettazione (R-11); codice invito QR o link per qualsiasi amicizia, unico canale tra fasce diverse (R-12); elenco amici; rimozione. |
| F-12 | Blocco e segnalazione | P0 | 1 | Blocco da profilo, gruppo e serata (R-17); segnalazione di ogni contenuto in al massimo due tocchi (R-50); stato delle proprie segnalazioni. |
| F-13 | Gruppi | P0 | 1 | Creazione, invito di amici confermati, accettazione, uscita, ruoli admin e membro; massimo 30 membri; invariante delle fasce (R-15). |
| F-14 | Serata di gruppo con conferme | P0 | 1 | Proposta legata a un evento adatto a tutti i membri (R-24) oppure libera; risposte sì, forse, no aggiornate in tempo reale; riepilogo "chi c'è". |
| F-15 | Prevendite e liste | P0 | 1 | Link esterni a prevendita e lista sulla serata; stato del biglietto per ogni membro (nessuno, prevendita, lista, alla cassa). Nessun pagamento nell'app. |
| F-16 | Trasporto: chi guida e come si torna | P0 | 1 | Mezzo per l'andata e per il ritorno per ogni membro; chi guida indica i posti liberi; gli altri scelgono "passaggio da"; `auto_guido` solo per maggiorenni; avviso se qualcuno non ha un mezzo per il ritorno. |
| F-17 | Accesso con Apple e Google | P2 | 3 | Il flusso deve comunque raccogliere la data di nascita prima di creare il profilo (D-08). |

### 4.3 Vivi

| ID | Funzionalità | Priorità | Fase | Criteri di accettazione |
|---|---|---|---|---|
| F-20 | Check-in "sono qui" | P0 | 2 | Disattivato di default; si attiva nelle impostazioni; indica solo il locale; destinatari scelti tra gli amici confermati (proposti di default: i membri della serata di gruppo che sono anche amici confermati); scade dopo 6 ore; si termina in un tocco (R-30). |
| F-21 | Ritorno sicuro | P0 | 2 | Avvio esplicito con arrivo previsto e da 1 a 5 amici confermati; posizione condivisa anche con l'app in background (app native, ADR-0006); indicatore permanente; "sono arrivato" in un tocco oppure arrivo automatico in un'area salvata solo sul dispositivo; allerta push ai destinatari se l'arrivo previsto passa senza conferma; fine automatica (R-31, R-32). Nella PWA la funzione è disponibile solo in primo piano e lo dichiara chiaramente. |
| F-22 | Notifiche push | P0 | 2 | iOS e Android tramite FCM/APNs, Web Push per la PWA; consenso esplicito; nessun testo scritto da altri utenti nelle notifiche (solo testi di sistema). Nella Fase 1 le notifiche sono solo nell'app. |

### 4.4 Ricorda

| ID | Funzionalità | Priorità | Fase | Criteri di accettazione |
|---|---|---|---|---|
| F-30 | Tracker personale delle serate | P0 | 1 | Voce collegata a un evento o a un locale, oppure libera; data, spese per categoria (R-40), amici confermati presenti, DJ, voto da 1 a 5, note; sempre privato; creazione rapida "ero a questo evento" dal dettaglio di un evento passato. |
| F-31 | Statistiche personali | P1 | 2 | Serate per mese, spesa totale e per categoria, locali e generi più frequenti, DJ più visti. |
| F-32 | Badge | P1 | 2 | Catalogo conforme a R-41; notifica all'ottenimento; bacheca dei badge nel profilo personale (visibile solo al titolare). |
| F-33 | Riepilogo annuale "Wrapped" | P1 | 2 | Disponibile dal 1° dicembre; da 5 a 8 schede animate (con `prefers-reduced-motion` rispettato); esportazione come immagine generata sul dispositivo; nessun dato di altri utenti (R-42). |

### 4.5 Piattaforma

| ID | Funzionalità | Priorità | Fase | Criteri di accettazione |
|---|---|---|---|---|
| F-40 | Moderazione | P0 | 1 | Area riservata con autenticazione a due fattori: coda dei flyer, coda dei duplicati, coda delle segnalazioni ordinate per priorità (R-53); azioni motivate e registrate; gestione dei locali e delle fonti con verifica di conformità. |
| F-41 | Diritti privacy | P0 | 1 | Esportazione JSON ed eliminazione dell'account self-service (R-64); informativa a livelli (R-63). |
| F-42 | Impostazioni di privacy | P0 | 1 | Visibilità predefinita delle partecipazioni, check-in (attivabile dalla Fase 2), notifiche, elenco dei bloccati. |
| F-43 | App installabile | P0 | 1–2 | Fase 1: PWA installabile e build interne iOS (TestFlight) e Android (test interno). Fase 2: pubblicazione su App Store e Google Play. |
| F-44 | Raccolta eventi automatica | P0 | 1 | Almeno 2 adattatori per siti dei locali (dati strutturati e HTML) e l'adattatore Instagram Business Discovery, più i flyer; deduplicazione; conformità ADR-0008. |
| F-45 | Accessibilità | P0 | 1 | WCAG 2.2 livello AA su tutte le schermate; verifiche automatiche (axe) e manuali (VoiceOver, TalkBack) prima di ogni rilascio. |
| F-46 | Nuove aree geografiche | P2 | 3 | Aggiunta di province tramite migrazione su `locali.provincia` e nuovo bootstrap dei locali. |

## 5. Requisiti non funzionali

- **Sicurezza e privacy**: tutte le regole di [SAFETY_PRIVACY.md](SAFETY_PRIVACY.md).
- **Prestazioni**: prima visualizzazione utile in meno di 2,5 s su rete 4G con un dispositivo
  Android di fascia media; navigazione tra le schermate in meno di 300 ms.
- **Disponibilità**: 99,5% mensile nella Fase 2 (limite del piano Supabase scelto).
- **Lingua**: italiano. I testi sono in file di messaggi per una futura traduzione.
- **Offline**: elenco degli eventi già scaricati, dettaglio delle proprie serate di gruppo e
  tracker consultabili offline; le scritture offline del tracker vengono sincronizzate al
  ritorno della connessione.
- **Compatibilità**: iOS 16+, Android 10+, ultime due versioni di Chrome, Safari, Firefox ed
  Edge per la PWA.

## 6. Fuori perimetro del MVP

| Elemento | Motivo |
|---|---|
| Strumenti B2B per PR e organizzatori | Scelta di prodotto: il MVP è solo per chi esce. |
| Pagamenti e biglietteria nell'app | Obblighi PSD2 e fiscali, rischi legati ai minorenni; si usano link esterni (F-15). |
| Chat libera e messaggi privati | R-16. |
| Pubblicità di qualsiasi tipo | R-61. |
| Mappa degli amici sempre attiva | R-34. |
| Ricerca globale degli utenti o suggerimenti di persone sconosciute | R-10. |
| Verifica dell'età con documenti | R-03. |
| Post, foto o recensioni pubbliche dei locali | Moderazione sproporzionata per il MVP. |
| Scraping di Instagram o di servizi che lo vietano | ADR-0008. |

## 7. Matrice di tracciabilità

Ogni funzionalità è collegata a un componente dell'architettura, alle tabelle che usa e alla
fase della roadmap. La matrice va aggiornata insieme alla funzionalità (skill `new-feature`).

| ID | Componenti (ARCHITECTURE.md) | Tabelle e oggetti (DATA_MODEL.md) | Regole | Fase |
|---|---|---|---|---|
| F-01 | App · RPC `cerca_eventi` | `eventi`, `eventi_generi`, `generi_musicali`, `locali` | R-20, R-23, R-33 | 1 |
| F-02 | App (MapLibre) · bucket `mappe` | come F-01 | R-20, R-23, R-33 | 1 |
| F-03 | App | `eventi`, `eventi_fonti`, `locali` | R-20, R-21 | 1 |
| F-04 | App · RPC `cerca_eventi` | `partecipazioni_evento`, `amicizie` | R-67 | 1 |
| F-05 | App | `partecipazioni_evento` | R-67 | 1 |
| F-06 | App · Storage · Worker (flyer) · Claude API | `caricamenti_flyer`, `eventi_grezzi`, `coda_job`, bucket `flyer-caricati` e `flyer-pubblicati` | R-51, R-54, R-66 | 1 |
| F-07 | Worker (adattatori aggregatori) | `fonti`, `eventi_grezzi` | ADR-0008 | 3 |
| F-10 | App · Supabase Auth | `profili`, `profili_privati`, `consensi` | R-01, R-02, R-05, R-60, R-63 | 1 |
| F-11 | App · RPC `cerca_utenti`, `crea_codice_invito`, `usa_codice_invito` | `amicizie`, `codici_invito` | R-10…R-14 | 1 |
| F-12 | App · area di moderazione | `blocchi`, `segnalazioni` | R-17, R-50 | 1 |
| F-13 | App | `gruppi`, `membri_gruppo` | R-15 | 1 |
| F-14 | App · Realtime | `serate_gruppo`, `partecipazioni_serata` | R-16, R-24 | 1 |
| F-15 | App | `serate_gruppo`, `partecipazioni_serata` | — | 1 |
| F-16 | App | `partecipazioni_serata` | — | 1 |
| F-17 | Supabase Auth | `profili_privati` | R-01, R-02 | 3 |
| F-20 | App · Realtime | `checkin`, `checkin_destinatari`, `profili_privati` | R-30 | 2 |
| F-21 | App nativa (geolocalizzazione in background) · Realtime Broadcast · `pg_cron` · Edge Function `invia-push` | `ritorni_sicuri`, `ritorni_destinatari`, `posizioni_ritorno`, `notifiche` | R-31, R-32 | 2 |
| F-22 | Edge Function `invia-push` · FCM/APNs/Web Push | `dispositivi_push`, `notifiche` | R-66 | 2 |
| F-30 | App (offline) | `serate_tracker`, `tracker_spese`, `tracker_dj`, `tracker_amici` | R-40 | 1 |
| F-31 | App · viste SQL | come F-30 | R-40 | 2 |
| F-32 | `pg_cron` · funzione SQL `private.assegna_badge()` | `badge`, `badge_utente` | R-41 | 2 |
| F-33 | `pg_cron` · funzione SQL `private.genera_riepiloghi()` · App | `riepiloghi_annuali` | R-42 | 2 |
| F-40 | App (area di moderazione) · RPC di moderazione | `segnalazioni`, `azioni_moderazione`, `caricamenti_flyer`, `eventi_grezzi`, `locali`, `fonti` | R-06, R-53, R-55, R-69 | 1 |
| F-41 | Edge Functions `esporta-dati`, `elimina-account` | tutte le tabelle personali | R-64 | 1 |
| F-42 | App | `profili_privati`, `blocchi` | R-30, R-67 | 1 |
| F-43 | App (Next.js export statico + Capacitor) · service worker | — | — | 1–2 |
| F-44 | `pg_cron` · Worker (coda, adattatori, normalizzazione, dedup) | `fonti`, `eventi_grezzi`, `eventi`, `eventi_fonti`, `coda_job` | R-21, R-22, ADR-0008 | 1 |
| F-45 | App · CI (axe) | — | — | 1 |
| F-46 | Worker (bootstrap locali) | `locali` | — | 3 |
