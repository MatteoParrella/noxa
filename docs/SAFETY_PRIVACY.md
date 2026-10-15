# Sicurezza dei minorenni e privacy

Questo documento è la **fonte di verità** per tutte le regole di sicurezza e privacy di Noxa.
Ogni regola ha un identificatore stabile (`R-xx`), il motivo per cui esiste e il punto in cui
viene applicata. Le regole sono **vincoli non negoziabili**: una funzionalità che ne viola una
non può essere rilasciata, indipendentemente da scadenze o richieste commerciali.

- Le policy che applicano queste regole sono descritte in [DATA_MODEL.md](DATA_MODEL.md).
- La verifica di ogni nuova funzionalità segue la skill `safety-review`
  (`.claude/skills/safety-review/SKILL.md`).
- Modificare una regola richiede un ADR in `docs/decisions/` e l'aggiornamento di questo file,
  di `DATA_MODEL.md`, dei test pgTAP collegati e di `CLAUDE.md` se la regola vi è citata.

## 1. Principi

1. **Il database è l'unico punto di autorizzazione.** Ogni regola che riguarda chi può vedere o
   fare cosa è applicata con Row Level Security (RLS), vincoli, trigger o funzioni SQL. Il
   frontend replica le regole solo per offrire una buona esperienza, mai come protezione.
2. **Privacy di default.** Ogni impostazione che espone dati parte dal valore più restrittivo
   ragionevole. Le funzioni di posizione sono sempre disattivate finché l'utente non le avvia.
3. **Minimizzazione.** Si raccolgono solo i dati indispensabili alla funzione; quando una
   funzione può lavorare con un dato meno preciso (il locale invece delle coordinate) si usa
   quello meno preciso.
4. **Simmetria prudente.** Quando una regola protegge i minorenni dagli adulti, si applica
   anche nell'altra direzione se questo riduce le occasioni di contatto non voluto.
5. **Trasparenza.** Le regole sono spiegate agli utenti in linguaggio semplice, comprensibile
   da un quattordicenne.

## 2. Definizioni

| Termine | Significato |
|---|---|
| Età | Anni compiuti alla data odierna nel fuso `Europe/Rome`, calcolati da `profili_privati.data_nascita` con la funzione `private.eta_di(uuid)`. |
| Minorenne | Utente con età compresa tra 14 e 17 anni. |
| Maggiorenne (adulto) | Utente con età pari o superiore a 18 anni. |
| Fascia | `minore` oppure `adulto`. Due utenti sono nella stessa fascia se `private.stessa_fascia(a, b)` è vera. |
| Amico confermato | Utente con cui esiste una riga in `amicizie` con `stato = 'accettata'` e nessun blocco in nessuna delle due direzioni (`private.sono_amici(a, b)`). |
| Età minima evento | `eventi.eta_minima`: intero tra 14 e 30 (14+, 16+, 18+, 20+, 21+…). |
| Contenuto caricato | Qualsiasi dato inserito da un utente e visibile ad altri: flyer, avatar, nome visualizzato, username, nomi di gruppi, titoli e note di serate di gruppo. |

## 3. Età e account

| ID | Regola | Motivo | Applicazione |
|---|---|---|---|
| R-01 | La registrazione è consentita solo a chi ha almeno 14 anni. Sotto i 14 anni la registrazione viene rifiutata. | In Italia il consenso al trattamento per i servizi della società dell'informazione è autonomo dai 14 anni (art. 2-quinquies D.Lgs. 196/2003, art. 8 GDPR). Sotto i 14 anni servirebbe il consenso dei genitori, che Noxa non gestisce. | Trigger `private.gestisci_nuovo_utente` su `auth.users`: rifiuta la creazione se l'età è inferiore a 14. Validazione anche nel form, solo per l'esperienza d'uso. Test pgTAP `profili_eta_minima`. |
| R-02 | La data di nascita è obbligatoria e **non modificabile dall'utente** dopo la registrazione. Una correzione è possibile solo tramite il supporto, che chiede una verifica e registra l'operazione in `azioni_moderazione`. | Se la data fosse modificabile, un adulto potrebbe dichiararsi minorenne per entrare in contatto con minorenni, oppure un minorenne potrebbe sbloccare eventi 18+. | Trigger `private.blocca_modifica_data_nascita` su `profili_privati`; nessuna policy `UPDATE` sulla colonna. Test pgTAP. |
| R-03 | L'età è **dichiarata**, non verificata con documenti. È un rischio accettato e dichiarato, mitigato da R-10…R-17, R-50…R-55 e dal pulsante "segnala età errata" su ogni profilo visibile. | La verifica documentale per un'app di questo tipo è sproporzionata rispetto al principio di minimizzazione e non è richiesta dalla normativa applicabile al servizio. La mitigazione si basa sulla riduzione delle superfici di contatto. | Motivo di segnalazione `eta_errata`; un moderatore può sospendere l'account (`profili.stato_account = 'sospeso'`). |
| R-04 | L'età e la fascia sono sempre calcolate nel database al momento della richiesta. Il client non invia mai età o fascia come parametro di autorizzazione. | Un valore inviato dal client può essere falsificato; inoltre l'età cambia nel tempo (compleanni). | Funzioni `private.eta_di`, `private.e_minorenne`, `private.stessa_fascia` usate nelle policy. |
| R-05 | Nessun altro utente vede l'età, la data di nascita o la fascia di un utente. | Esporre l'età permetterebbe di individuare i minorenni come bersaglio. | `profili_privati` leggibile solo dal titolare; `profili` non contiene dati sull'età. |
| R-06 | Gli account dei moderatori e degli amministratori richiedono l'autenticazione a due fattori. | Un account di moderazione compromesso darebbe accesso a segnalazioni che riguardano minorenni. | Funzione `private.e_moderatore()` restituisce vero solo se la sessione ha `aal2` (claim `aal` nel JWT). |
| R-07 | Non è previsto l'accesso anonimo all'app: senza account non si vedono eventi, profili o mappe. | Senza età nota non è possibile applicare R-20…R-23. | Nessuna policy per il ruolo `anon` su alcuna tabella, tranne il bucket pubblico `mappe` che non contiene dati personali. |

## 4. Contatti tra utenti

| ID | Regola | Motivo | Applicazione |
|---|---|---|---|
| R-10 | La ricerca utenti restituisce solo utenti **della stessa fascia**, esclusi gli utenti bloccati in entrambe le direzioni e gli account sospesi. La ricerca richiede almeno 3 caratteri di username, avviene per prefisso e restituisce al massimo 20 risultati. Non esistono elenchi o suggerimenti di utenti sconosciuti: la tabella dei profili non è elencabile tramite l'API, e un profilo è visibile solo a sé stessi, agli amici, ai membri dei propri gruppi e a chi ha una richiesta di amicizia in attesa con quella persona. | Requisito di prodotto: un adulto non deve poter trovare un minorenne. La simmetria (un minorenne non trova adulti) riduce l'esposizione dei minorenni a profili adulti sconosciuti. I minorenni dai 14 ai 17 anni sono un'unica fascia e possono cercarsi tra loro (ADR-0017). Il limite impedisce di enumerare gli utenti. | RPC `public.cerca_utenti(testo)` `security definer` con filtri interni; funzione `private.puo_vedere_profilo` nella policy di `profili`. Test pgTAP con utenti 14, 16, 17, 18, 21 anni, compreso il tentativo di elencare `profili` direttamente. |
| R-11 | Un'amicizia esiste solo dopo una richiesta accettata esplicitamente dal destinatario. | Nessuno deve trovarsi collegato a un'altra persona senza averlo scelto. | Policy su `amicizie`: solo il destinatario può portare `stato` da `in_attesa` ad `accettata`. |
| R-12 | Un'amicizia tra fasce diverse (adulto e minorenne) può nascere **solo** con un codice invito monouso, valido 15 minuti, mostrato come QR o link dal titolare. Anche in questo caso serve l'accettazione esplicita della controparte. Prima di confermare, il minorenne vede un avviso: "Stai aggiungendo una persona maggiorenne: aggiungi solo persone che conosci di persona". | Garantisce che un adulto non possa contattare un minorenne sconosciuto: il codice deve essergli stato consegnato direttamente, di solito di persona. La scadenza breve impedisce la circolazione dei codici. | RPC `public.crea_codice_invito()`, `public.anteprima_codice_invito(codice)`, `public.usa_codice_invito(codice)` e `public.avviso_richiesta(amicizia)`; la policy `INSERT` su `amicizie` per il canale `ricerca` richiede `private.stessa_fascia`. |
| R-13 | Il profilo di un utente di fascia diversa è invisibile, a meno che i due non siano amici confermati o non abbiano una richiesta di amicizia in attesa nata da un codice invito (R-12), necessaria per decidere se accettarla. | Requisito di prodotto ("non può vedere"). | Funzione `private.puo_vedere_profilo(uuid)` nella policy `SELECT` di `profili` e del bucket `avatar`. |
| R-14 | Limiti anti-abuso: al massimo 20 richieste di amicizia inviate ogni 24 ore e 50 richieste in attesa contemporaneamente; al massimo 10 codici invito generati ogni 24 ore. | Riduce spam e tentativi di contatto di massa. | Trigger `private.limita_richieste_amicizia` e controllo in `crea_codice_invito`. |
| R-15 | **Invariante dei gruppi:** in un gruppo, ogni coppia di membri (invitati o attivi) di fasce diverse deve essere formata da amici confermati. Se l'invariante si rompe (amicizia rimossa, blocco, compimento dei 18 anni di un membro), l'utente maggiorenne della coppia viene rimosso dal gruppo e riceve una notifica con il motivo. | Un gruppo misto non deve diventare un canale per far entrare in contatto adulti e minorenni che non si conoscono. Si rimuove l'adulto perché la protezione del minorenne ha la precedenza. | Funzione `private.puo_entrare_nel_gruppo(gruppo, utente)` nella policy `INSERT` di `membri_gruppo`; trigger su `amicizie` e `blocchi`; job giornaliero `private.verifica_invariante_gruppi()` per i compleanni. |
| R-16 | Nel MVP non esiste una chat libera. La coordinazione avviene con campi strutturati (risposte, biglietto, trasporto) e con testi brevi (titolo e note della serata, massimo 500 caratteri) visibili solo ai membri del gruppo e segnalabili. | La messaggistica privata è il principale canale di adescamento e richiede una moderazione molto più pesante. I gruppi riguardano persone che si conoscono già. | Nessuna tabella di messaggi; vincoli di lunghezza sui campi di testo. |
| R-17 | Il blocco nasconde reciprocamente profili, partecipazioni, check-in e ritorni sicuri; rimuove l'amicizia; impedisce nuovi inviti e richieste tra i due. Il blocco è invisibile al bloccato. | Strumento di autotutela immediato, richiesto anche dalle linee guida degli store per i contenuti generati dagli utenti. | Funzione `private.c_e_blocco(a, b)` in tutte le policy di visibilità tra utenti; trigger `private.applica_blocco`. |

## 5. Eventi

| ID | Regola | Motivo | Applicazione |
|---|---|---|---|
| R-20 | Un utente vede un evento solo se la sua età è almeno pari a `eventi.eta_minima`. La regola vale per tutti, adulti compresi (un ventenne non vede gli eventi 21+). | Requisito di prodotto: mostrare solo eventi a cui si può entrare. Per i minorenni è anche un requisito di sicurezza. | Policy `SELECT` su `eventi`; la RPC `cerca_eventi` è `security invoker`, quindi eredita la policy. Test pgTAP per età 14, 15, 16, 17, 18, 20, 21. |
| R-21 | Se l'età minima di un evento non è nota, l'evento è trattato come 18+ (`eta_minima = 18`, `eta_minima_dichiarata = false`). | In assenza di informazioni si sceglie l'opzione che protegge i minorenni. | Valore predefinito della colonna; normalizzazione nel worker. |
| R-22 | Se due fonti indicano età minime diverse per lo stesso evento, vale la **più alta**. Un'età dichiarata non può essere abbassata in automatico, solo da un moderatore; l'età predefinita 18 (R-21) viene sostituita dalla prima età dichiarata da una fonte verificata. I flyer non modificano mai l'età di un evento pubblicato (R-51). | Prudenza: un errore verso l'alto esclude qualche utente, un errore verso il basso espone un minorenne a un evento inadatto. | Algoritmo di fusione in [EVENT_INGESTION.md](EVENT_INGESTION.md#7-fusione); trigger `private.proteggi_eta_evento`. Test pgTAP. |
| R-23 | Gli eventi con `riferimenti_alcol = true` (open bar, promozioni sugli alcolici, sponsor di alcolici nel titolo o nella descrizione) non sono visibili ai minorenni, qualunque sia la loro età minima. | La legge italiana vieta la vendita e la somministrazione di alcolici ai minori di 18 anni (L. 125/2001 e successive modifiche); Noxa non deve veicolare contenuti promozionali sull'alcol verso i minorenni. | Policy `SELECT` su `eventi`; il campo è valorizzato dall'estrazione e verificato in moderazione. |
| R-24 | Una serata di gruppo può riferirsi solo a un evento visibile a **tutti** i membri attivi del gruppo nel momento della creazione. Se in seguito entra un membro che non può vedere l'evento, la serata gli resta nascosta. | Impedisce di aggirare R-20 e R-23 tramite i gruppi. | Controllo `private.evento_adatto_al_gruppo` nella policy `INSERT`/`UPDATE` di `serate_gruppo`; la policy `SELECT` di `serate_gruppo` richiede che l'evento sia visibile. |

## 6. Posizione

| ID | Regola | Motivo | Applicazione |
|---|---|---|---|
| R-30 | Il check-in "sono qui" è disattivato di default (`profili_privati.checkin_abilitato = false`). Quando è abilitato, ogni check-in indica **solo il locale** (non le coordinate), è visibile solo agli amici confermati scelti come destinatari, scade dopo 6 ore e viene cancellato 24 ore dopo la scadenza. | Requisito di prodotto. La granularità del locale è sufficiente allo scopo e non rivela la posizione precisa. La scadenza evita che i dati si accumulino. | Trigger `private.verifica_checkin` che verifica `checkin_abilitato`; policy su `checkin` e `checkin_destinatari`; job di conservazione. Test pgTAP. |
| R-31 | Il ritorno sicuro si avvia solo esplicitamente, per una singola sessione. Condivide la posizione con al massimo 5 amici confermati scelti. La sessione termina con "sono arrivato", con l'annullamento o automaticamente 2 ore dopo l'arrivo previsto. Le posizioni sono cancellate 24 ore dopo la fine. Durante la sessione l'app mostra un indicatore permanente (notifica di sistema). | Requisito di prodotto. La sessione limitata e l'indicatore visibile impediscono il tracciamento continuo o nascosto. | Tabelle `ritorni_sicuri`, `ritorni_destinatari`, `posizioni_ritorno`; funzione `private.verifica_ritorni_scaduti()` eseguita ogni minuto da `pg_cron`. |
| R-32 | Il server non conosce l'indirizzo di casa. L'arrivo si conferma a mano oppure con un'area di arrivo salvata **solo sul dispositivo**. | Un indirizzo di casa di un minorenne è un dato ad altissimo rischio in caso di violazione. | Nessuna colonna per l'indirizzo; documentato in ADR-0006. |
| R-33 | La posizione usata per ordinare o filtrare gli eventi per distanza non viene salvata né registrata nei log. | Minimizzazione. | Passata come parametro alla RPC `cerca_eventi`; il logging dei parametri delle RPC esclude le coordinate (vedi ARCHITECTURE.md §8). |
| R-34 | Non esiste una mappa degli amici sempre attiva né una condivisione continua della posizione fuori dal ritorno sicuro. | È una funzione ad alto rischio di controllo e di stalking, non necessaria allo scopo del prodotto. | Fuori perimetro (PRD §6). |

## 7. Alcol e contenuti

| ID | Regola | Motivo | Applicazione |
|---|---|---|---|
| R-40 | Nel tracker la categoria di spesa `alcolici` non è disponibile per i minorenni. | Requisito di prodotto: nessuna voce del tracker legata all'alcol per i minorenni. | Trigger `private.verifica_categoria_spesa` su `tracker_spese`; l'interfaccia nasconde la categoria. Test pgTAP. |
| R-41 | Nessun badge premia la spesa, il consumo di alcol, il numero di serate in un periodo breve o l'orario di rientro. I badge per soli maggiorenni (`badge.solo_maggiorenni`) non vengono assegnati né mostrati ai minorenni. | La gamification non deve incentivare comportamenti a rischio. | Catalogo dei badge nel seed revisionato con `safety-review`; policy `SELECT` su `badge`. |
| R-42 | Il riepilogo annuale condivisibile non contiene nomi, username o foto di altri utenti (solo conteggi) né riferimenti all'alcol per i minorenni. | Gli altri utenti non hanno acconsentito a comparire in un contenuto pubblico. | Generazione in `private.genera_riepiloghi()` nel database; il formato di `riepiloghi_annuali.dati` non prevede campi per altri utenti. |
| R-43 | L'interfaccia non contiene pubblicità di alcolici, conti alla rovescia artificiali, notifiche di pressione sociale ("tutti i tuoi amici ci vanno, tu no?") né altri dark pattern. | DSA art. 25 (divieto di interfacce ingannevoli) e tutela dei minorenni. | Checklist di `safety-review` e di `implement-design`. |

## 8. Contenuti caricati e moderazione

| ID | Regola | Motivo | Applicazione |
|---|---|---|---|
| R-50 | Ogni contenuto caricato e ogni profilo visibile può essere segnalato con un massimo di due tocchi. | DSA art. 16 (meccanismo di segnalazione) e linee guida degli store sui contenuti generati dagli utenti. | Tabella `segnalazioni`; componente di segnalazione unico nell'interfaccia. |
| R-51 | Gli eventi estratti dai flyer **non sono pubblicati senza una revisione umana**, salvo quando corrispondono a un evento già pubblicato da una fonte verificata (in quel caso il flyer aggiunge solo la fonte e non modifica i campi). | I flyer possono contenere errori, eventi falsi o immagini inadatte; la revisione protegge gli utenti e la qualità del catalogo. | Stato `in_revisione` su `eventi` e `caricamenti_flyer`; coda di moderazione. |
| R-52 | Avatar, nomi e testi sono visibili solo a chi può vedere il profilo o il gruppo; sono segnalabili e rimovibili dai moderatori. | Limita la diffusione di eventuali contenuti inadatti. | Policy sui bucket e sulle tabelle; azioni in `azioni_moderazione`. |
| R-53 | Tempi massimi di gestione: segnalazioni con motivo `adescamento_o_rischio_minore` entro 4 ore nella fascia 08:00–02:00, entro le 10:00 per quelle ricevute di notte; le altre segnalazioni che coinvolgono minorenni entro 24 ore; tutte le altre entro 72 ore. Ogni decisione è motivata all'utente interessato, che può presentare reclamo. | DSA art. 17 (motivazione) e art. 20 (reclamo); priorità alla tutela dei minorenni. | Ordinamento della coda di moderazione; notifiche con motivazione; metriche nella dashboard di moderazione. |
| R-54 | Limiti di caricamento: al massimo 10 flyer ogni 24 ore per utente, immagini JPEG, PNG o WebP fino a 10 MB. I metadati EXIF vengono rimossi. | Previene abusi; l'EXIF può contenere posizione e dati del dispositivo. | Policy del bucket `flyer-caricati`, trigger `private.limita_caricamenti_flyer`, rimozione EXIF sul client e di nuovo nel worker. |
| R-55 | Contenuti pedopornografici, adescamento o minacce gravi: il contenuto viene reso inaccessibile subito, l'account sospeso e le prove conservate in modo protetto; si segnala alla Polizia Postale e delle Comunicazioni. Nessun moderatore scarica o inoltra il materiale fuori dalla procedura. | Obblighi di legge e tutela delle vittime. | Procedura operativa di moderazione (§11); azione `escalation_autorita` in `azioni_moderazione`. |
| R-56 | Le foto dei locali mostrate come immagine degli eventi hanno una fonte lecita (autorizzazione scritta del locale, foto di Noxa o licenza libera con attribuzione), non ritraggono persone riconoscibili, non mettono in evidenza l'alcol e sono caricate e approvate solo da un moderatore. | Diritti d'autore e termini d'uso (ADR-0008); privacy delle persone fotografate, anche minorenni; le foto sono visibili ai minorenni (R-23, R-40). | ADR-0018; colonne `immagine_*` di `locali` con check; bucket `immagini-locali` scrivibile solo dai moderatori; tipo segnalabile `immagine_locale`. |

## 9. Privacy e dati

| ID | Regola | Motivo | Applicazione |
|---|---|---|---|
| R-60 | Dati raccolti alla registrazione: email, password (gestita da Supabase Auth), username, nome visualizzato, data di nascita. Non si raccolgono numero di telefono, nome reale obbligatorio, rubrica dei contatti, indirizzo di casa o genere. | Minimizzazione (art. 5.1.c GDPR). | Schema di `profili` e `profili_privati`. |
| R-61 | Il MVP non contiene pubblicità. In nessuna versione futura si mostrerà pubblicità basata sulla profilazione a utenti minorenni. | DSA art. 28.2. | Fuori perimetro (PRD §6); qualsiasi modifica richiede un ADR e `safety-review`. |
| R-62 | Nessun SDK di tracciamento o analisi comportamentale di terze parti nell'app. Le metriche di prodotto sono calcolate in modo aggregato nel database. Il monitoraggio degli errori (Sentry, regione UE) non riceve dati personali oltre all'identificativo pseudonimo dell'utente. | Minimizzazione; nessuna profilazione dei minorenni. | ADR-0014; configurazione `beforeSend` di Sentry che rimuove email, coordinate e testi. |
| R-63 | L'informativa privacy è a livelli: un riassunto di una schermata in linguaggio semplice, poi il testo completo. Il consenso a termini e informativa viene registrato con la versione accettata; a ogni nuova versione si chiede di nuovo il consenso. | Art. 12 GDPR (informazioni chiare, in particolare per i minori). | Tabella `consensi`. |
| R-64 | Esportazione dei propri dati in JSON ed eliminazione dell'account sono self-service, dall'app, senza contattare il supporto. | Artt. 15, 17 e 20 GDPR. | Edge Function `esporta-dati` ed `elimina-account`. |
| R-65 | I dati sono conservati secondo la tabella del §10 e cancellati automaticamente. | Art. 5.1.e GDPR (limitazione della conservazione). | Job `pg_cron` `private.applica_conservazione()`. |
| R-66 | Database e storage risiedono nell'UE. Ai fornitori extra-UE (Anthropic per l'estrazione dei flyer, Meta per Instagram, Google per le notifiche push) si inviano solo i dati strettamente necessari: al modello si invia l'immagine del flyer senza identificativi dell'utente. | Artt. 44 e seguenti GDPR. | ADR-0007, ADR-0012; verifiche contrattuali elencate in DECISIONI_APERTE.md (D-07, D-12). |
| R-67 | Le partecipazioni agli eventi ("interessato", "partecipo") sono visibili solo agli amici confermati; l'utente può renderle private per ogni evento o in generale. | Abilita la funzione "amici che partecipano" senza esporre le abitudini a sconosciuti; equivale a un profilo privato. | Colonna `partecipazioni_evento.visibile_agli_amici` (predefinita da `profili_privati.partecipazioni_visibili`). |
| R-68 | RLS abilitata su **ogni** tabella degli schemi esposti; funzioni `security definer` solo nello schema non esposto `private` (oppure in `public` se sono RPC documentate), sempre con `set search_path = ''`. La chiave `service_role` non arriva mai al client. | Difesa in profondità; impostazione corretta delle funzioni privilegiate in Postgres. | Test `supabase/tests/001_rls_abilitata.test.sql` e `scripts/verifica_migrazioni.py` in CI; revisione `db-migration`. |
| R-69 | I moderatori non hanno accesso a posizioni, check-in, tracker, riepiloghi e dati privati. Dei dati degli utenti vedono solo gli oggetti segnalati, tramite RPC che registrano ogni accesso, e i flyer in revisione senza l'identità di chi li ha caricati. | Minimo privilegio; anche il personale interno è un potenziale rischio. | RPC `public.dettaglio_segnalazione(id)` con scrittura in `azioni_moderazione`; RPC `public.coda_flyer()` senza `utente_id`; nessuna policy per i moderatori sulle tabelle di posizione, tracker e riepiloghi. |

## 10. Tempi di conservazione

| Dato | Conservazione | Meccanismo |
|---|---|---|
| `posizioni_ritorno` | 24 ore dalla fine della sessione | `private.applica_conservazione()` ogni ora |
| `checkin`, `checkin_destinatari` | 24 ore dalla scadenza | come sopra |
| Immagini in `flyer-caricati` | 30 giorni dalla decisione di moderazione | job del worker `pulizia_flyer` |
| Immagini in `flyer-pubblicati` | finché l'evento esiste, al massimo 12 mesi dopo la data dell'evento | come sopra |
| Foto in `immagini-locali` | Finché il locale è attivo; eliminata entro 7 giorni dalla revoca dell'autorizzazione o dalla disattivazione del locale | rimozione da parte dei moderatori; `private.applica_conservazione()` per i locali disattivati |
| `eventi_grezzi` | 30 giorni | `private.applica_conservazione()` |
| `coda_job` completati | 14 giorni | come sopra |
| `notifiche` | 90 giorni | come sopra |
| `segnalazioni`, `azioni_moderazione` | 12 mesi dalla chiusura; più a lungo se serve per un procedimento in corso (escalation R-55) | come sopra, escluse le righe con `conservazione_legale = true` |
| `codici_invito` | 24 ore dalla scadenza | come sopra |
| Account eliminato | Cancellazione immediata dei dati nel database e nello storage; scomparsa dai backup alla fine della finestra di backup del piano Supabase (al massimo 30 giorni) | Edge Function `elimina-account` |
| Log applicativi (worker, Edge Functions) | 30 giorni | impostazione del fornitore di hosting |
| Dati dell'account (profilo, amicizie, blocchi, gruppi, serate, partecipazioni, tracker, badge, riepiloghi, consensi, dispositivi) | Fino all'eliminazione dell'account. Un account senza accessi da 24 mesi riceve un avviso via email ed è eliminato dopo altri 30 giorni senza accessi | `private.applica_conservazione()` su `auth.users.last_sign_in_at`; eliminazione con la stessa procedura di `elimina-account` |
| Eventi (`eventi` e tabelle collegate) | Indefinita: sono informazioni pubbliche sugli eventi, non dati personali | — |

## 11. Procedura operativa di moderazione (sintesi)

1. La coda di moderazione ordina le segnalazioni per priorità secondo R-53.
2. Il moderatore apre la segnalazione tramite `dettaglio_segnalazione`: l'accesso viene registrato.
3. Le azioni possibili sono: `nessuna_violazione`, `rimuovi_contenuto`, `modifica_evento`,
   `sospendi_account`, `escalation_autorita`. Ognuna produce una riga in `azioni_moderazione`
   con la motivazione e una notifica alle persone interessate (R-53).
4. Per `escalation_autorita` (R-55): sospensione immediata, contenuto reso inaccessibile ma
   conservato con `conservazione_legale = true`, segnalazione alla Polizia Postale da parte
   dell'amministratore incaricato, nessuna comunicazione all'account sospeso che possa
   compromettere le indagini.
5. Revisione dei flyer: verifica di titolo, data, locale ed età minima confrontandoli con il
   flyer; impostazione di `riferimenti_alcol`; approvazione o rifiuto motivato.

## 12. Verifica

- Ogni regola marcata con "Test pgTAP" ha almeno un test positivo e uno negativo in
  `supabase/tests/`, eseguiti con utenti di test di 14, 15, 16, 17, 18, 20 e 21 anni e con un
  moderatore (seed in `supabase/seed.sql`).
- Ogni funzionalità passa la skill `safety-review` prima di essere considerata completa.
- Prima del lancio pubblico (Fase 2) sono obbligatori una valutazione d'impatto (DPIA) e un
  penetration test esterno, come indicato in [ROADMAP.md](ROADMAP.md).
