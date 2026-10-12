# Roadmap

Ogni fase si chiude solo quando **tutti** i criteri di completamento sono soddisfatti e
verificati. Le funzionalità (`F-xx`) sono definite in [PRD.md](PRD.md). Una funzionalità è
completa solo se rispetta la definizione di completato del §6.

| Fase | Nome | Esito |
|---|---|---|
| 0 | Fondamenta | Infrastruttura, schema di base, sicurezza e design system pronti |
| 1 | Beta chiusa Milano e Brianza | Tracker, amicizie, gruppi, eventi da 3 fonti + flyer, con utenti reali su invito |
| 2 | Lancio pubblico (MVP completo) | Vivi (check-in, ritorno sicuro), notifiche push, badge, Wrapped, app negli store |
| 3 | Crescita | Aggregatori con accordo, nuove aree, accesso social |

## Fase 0 — Fondamenta

**Contenuto**

- Monorepo (ADR-0015): `apps/web` inizializzata con Next.js in export statico, TypeScript
  strict, Tailwind, ESLint, Prettier, Vitest, Playwright; `services/worker` con uv, Ruff,
  mypy strict, pytest; `supabase/` inizializzata con la CLI.
- CI su GitHub Actions: lint, typecheck, test unitari, `supabase test db`, build web, build
  Docker del worker, controllo delle dipendenze, `scripts/verifica_documentazione.py`.
- Progetti Supabase `staging` e `produzione` nella regione di Francoforte; Vercel e Fly.io
  configurati in regione UE (ADR-0012).
- Migrazioni di base: estensioni, enum, schema `private` con le funzioni del DATA_MODEL.md
  §4, `profili`, `profili_privati`, `ruoli_utente`, `consensi`, trigger di registrazione,
  test pgTAP `001_rls_abilitata` e seed con gli utenti di test per età.
- Registrazione, accesso e verifica email funzionanti end-to-end con il controllo dell'età
  (F-10, parte tecnica).
- Design system da Claude Design: token, tipografia, componenti di base e layout di
  navigazione (ADR-0011, [DESIGN.md](DESIGN.md)).
- Struttura del worker: `coda` (prelievo, lease, retry), `ClientHttpConforme`, funzioni di
  `normalizzazione/`, registro degli adattatori, test di architettura, schema e prompt
  iniziali dei flyer, strumenti `fonti.prova`, `fonti.salva_fixture` e `flyer.valuta`.
- Funzioni di supporto ai test `supabase/tests/000_supporto.test.sql`.
- Mappa: file `milano-brianza.pmtiles`, font e icone nel bucket `mappe`; stili Protomaps
  `dark` e `light` personalizzati con i design token; job trimestrale di aggiornamento
  (ADR-0016).
- Shell Capacitor iOS e Android compilabile, con la PWA servita dallo stesso export.
- Pratiche esterne avviate: App Review Meta per Business Discovery, account sviluppatore Apple
  e Google, bozza di termini, informativa e DPIA con un legale (D-07).

**Criteri di completamento**

1. Una PR con una migrazione senza RLS o senza test fa fallire la CI (verificato con una PR di
   prova).
2. `supabase test db` passa con i casi R-01, R-02, R-04, R-05 per tutti gli utenti del seed.
3. Un utente con data di nascita inferiore ai 14 anni non riesce a registrarsi né dall'app né
   chiamando direttamente l'API di Auth (test e2e).
4. L'app si compila in export statico e gira su simulatore iOS, emulatore Android e browser.
5. I token del design system sono in `apps/web/src/styles/tokens.css`, usati dalla
   configurazione di Tailwind e documentati in DESIGN.md.
6. La decisione D-01 (dominio) è chiusa e gli ADR e i documenti che la citano sono
   aggiornati (DECISIONI_APERTE.md).
7. La richiesta di App Review Meta è stata inviata.

## Fase 1 — Beta chiusa Milano e Brianza

**Funzionalità**: F-01, F-02, F-03, F-04, F-05, F-06, F-10, F-11, F-12, F-13, F-14, F-15,
F-16, F-30, F-40, F-41, F-42, F-43 (PWA + build interne iOS e Android), F-44, F-45.

**Fonti degli eventi** (2–3 fonti più i flyer, come da perimetro):

1. adattatore `sito_jsonld` (siti dei locali con dati strutturati);
2. almeno un adattatore `sito_html_<locale>` per i locali senza dati strutturati;
3. adattatore `instagram_business_discovery`;
4. caricamento flyer con estrazione Claude API e pre-moderazione.

**Criteri di completamento**

1. Almeno 40 locali attivi in `locali` per le province MI e MB, ognuno con almeno una fonte
   `consentita` o raggiungibile tramite flyer.
2. Per 4 settimane consecutive: almeno 150 eventi pubblicati a settimana; correttezza dei
   campi chiave ≥ 95% sul campione mensile; precisione della deduplicazione ≥ 98% sul golden
   set e sul campione (PRD §2).
3. Estrazione dai flyer valutata sul golden set di almeno 50 flyer: data e locale corretti in
   almeno il 90% dei casi, età minima mai più bassa di quella reale (0 errori verso il basso).
4. Tutte le tabelle usate dalle funzionalità della fase hanno test pgTAP per ogni policy,
   inclusi i casi negativi per fascia d'età (DATA_MODEL.md §9).
5. Test e2e Playwright per i percorsi: registrazione, ricerca evento, amicizia per ricerca e
   per codice invito, creazione di un gruppo misto valido e rifiuto di uno non valido, serata
   di gruppo con conferme, voce del tracker, caricamento flyer, segnalazione, esportazione ed
   eliminazione dell'account.
6. Nessuna violazione WCAG 2.2 AA rilevata da axe sulle schermate della fase; verifica
   manuale con VoiceOver e TalkBack sui percorsi del punto 5.
7. Beta con almeno 200 utenti su invito, di cui almeno 50 minorenni con il consenso
   informato previsto dall'informativa; zero incidenti di sicurezza aperti; il 95% delle
   segnalazioni gestite nei tempi di R-53.
8. Ogni funzionalità della fase ha superato la skill `safety-review`, con l'esito registrato
   nella PR.

## Fase 2 — Lancio pubblico (MVP completo)

**Funzionalità**: F-20, F-21, F-22, F-31, F-32, F-33, F-43 (pubblicazione negli store), più
il consolidamento di tutte le funzionalità della Fase 1.

**Contenuto aggiuntivo**

- Plugin di geolocalizzazione in background scelto (D-04) e testato su dispositivi reali iOS
  e Android, con l'app in background e con lo schermo bloccato.
- Notifiche push per Android, iOS e web.
- DPIA definitiva, informativa e termini definitivi, nomina del DPO se richiesta (D-07).
- Penetration test esterno su app, API Supabase ed Edge Functions.
- Test di carico: 100.000 utenti sintetici, 5.000 eventi futuri, 500 ritorni sicuri
  simultanei.

**Criteri di completamento**

1. Ritorno sicuro: su 20 prove reali per piattaforma (iOS e Android) con l'app in background
   per almeno 30 minuti, la posizione arriva ai destinatari con un intervallo massimo di 2
   minuti nel 95% del tempo; l'allerta parte entro 2 minuti dall'arrivo previsto superato nel
   100% delle prove.
2. Test pgTAP di R-30, R-31 e R-41 superati; nessuna posizione più vecchia di 24 ore dalla
   fine della sessione presente nel database (query di verifica in CI su staging).
3. Penetration test senza vulnerabilità di gravità alta o critica aperte.
4. DPIA approvata; termini e informativa pubblicati; questionari di età degli store compilati
   (D-06).
5. App approvate su App Store e Google Play; PWA in produzione.
6. Test di carico: `cerca_eventi` < 800 ms al 95° percentile; nessun errore Realtime sopra
   l'1%.
7. Crash-free sessions ≥ 99,5% nell'ultima settimana di beta.
8. Wrapped (F-33) e badge (F-32), se presenti nel rilascio, verificati con `safety-review`
   (R-41, R-42); se in ritardo, il lancio procede senza (sono P1).

## Fase 3 — Crescita

**Funzionalità**: F-07 (aggregatori con accordo), F-17 (accesso con Apple e Google), F-46
(nuove aree geografiche).

**Criteri di completamento**

1. Per ogni aggregatore attivato: accordo scritto o API ufficiale archiviati e citati in
   `fonti.note_conformita`; ADR di integrazione accettato.
2. Accesso social: impossibile creare un profilo senza data di nascita (test e2e);
   esperienza conforme alle linee guida Apple (Sign in with Apple presente se è presente
   Google).
3. Nuova area: almeno 30 locali verificati e le soglie di qualità del PRD §2 rispettate per 4
   settimane.

## 6. Definizione di completato

Una funzionalità è completa quando:

1. il PRD contiene la funzionalità con i criteri di accettazione e la riga nella matrice di
   tracciabilità;
2. DATA_MODEL.md, ARCHITECTURE.md e gli eventuali ADR sono aggiornati;
3. le migrazioni hanno RLS e test pgTAP positivi e negativi (skill `db-migration`);
4. il codice è tipizzato (TypeScript strict, mypy strict), con gestione degli errori e
   logging secondo ARCHITECTURE.md §5.2 e §8;
5. esistono test unitari e, per i percorsi utente, test e2e; la CI è verde;
6. l'interfaccia rispetta WCAG 2.2 AA e DESIGN.md (skill `implement-design`);
7. la skill `safety-review` è stata superata e l'esito è riportato nella PR;
8. la revisione del codice è stata approvata da almeno un'altra persona.
