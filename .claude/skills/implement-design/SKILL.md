---
name: implement-design
description: Come trasformare una schermata o un componente progettato in Claude Design in codice dell'app Noxa (Next.js + Tailwind) usando i design token, i componenti del design system, gli stati obbligatori e i requisiti di accessibilità WCAG 2.2 AA. Da usare per ogni lavoro di interfaccia.
---

# Implementare un design da Claude Design

Riferimenti: `docs/DESIGN.md`, ADR-0011, `apps/web/src/styles/tokens.css`.

## Prerequisiti

- Fase 0 completata: design system in `src/components/ui/`, `tokens.css` collegato a
  Tailwind, catalogo `page.dev.tsx`, Playwright con `@axe-core/playwright`.
- Accesso al progetto Noxa in Claude Design.

## Input richiesti

Nella cartella `design/F-xx-nome/` devono esserci:

- `brief.md` (obiettivo, stati, varianti per minorenni e maggiorenni, testi);
- il link al progetto Claude Design e le immagini di ogni stato (caricamento, vuoto, errore,
  successo, offline);
- l'eventuale codice o specifica esportata da Claude Design.

Se manca qualcosa, chiedilo prima di iniziare: non inventare stati o testi.

## Procedura

### 1. Analizza il design
1. Elenca gli elementi della schermata e associa ognuno a un componente esistente di
   `src/components/ui/`. Gli elementi senza corrispondenza diventano nuovi componenti (passo 3)
   solo se riutilizzabili; altrimenti vivono in `src/features/<area>/componenti/`.
2. Elenca colori, spaziature, raggi, ombre, tipografia e animazioni usati e trova il token
   corrispondente in `tokens.css`. Un valore senza token **non si scrive a mano**:
   - se è una variazione minima di un token esistente, usa il token e segnalalo nella PR;
   - se è un nuovo valore voluto, aggiungilo prima in Claude Design e poi in `tokens.css` e
     nella configurazione di Tailwind (`@theme inline` in `src/app/globals.css`), nella stessa PR.
3. Verifica i contrasti dei colori con i valori dei token, in entrambi i temi (DESIGN.md §4).

### 2. Codice esportato
Il codice esportato da Claude Design è un **riferimento visivo**. Non va copiato: si
riscrive con i componenti, i token, le convenzioni di nome in italiano e i tipi del progetto.
Da esso si prendono struttura, gerarchia e testi.

### 3. Componenti del design system
Per ogni nuovo componente in `src/components/ui/`:
- props tipizzate, varianti con un'unica mappa di classi Tailwind basate sui token;
- elementi HTML semantici (`button`, `a`, `label`, `fieldset`) prima di ARIA;
- focus visibile, area di tocco ≥ 44 × 44 px, stato disabilitato e di caricamento;
- test unitario (rendering, interazione da tastiera, etichetta accessibile);
- esempio nel catalogo `src/app/catalogo/page.dev.tsx` (incluso solo in sviluppo, DESIGN.md §3).

### 4. Schermata
In `src/features/<area>/`:
- dati da hook con TanStack Query; nessuna chiamata a Supabase dentro i componenti di
  presentazione;
- tutti gli stati del brief: caricamento (scheletro), vuoto (con un'azione utile), errore
  (`ErroreConAzione`), offline, successo;
- testi da `src/lib/messaggi/it.ts`, mai scritti nel JSX;
- `PulsanteSegnala` su ogni contenuto caricato da utenti (R-50);
- varianti per età: le differenze (per esempio la categoria `alcolici` nel tracker) dipendono
  dai dati restituiti dal database, non da un controllo dell'età nel client. Il client può
  nascondere un elemento, ma la regola è sempre nel DB;
- aggiornamenti in tempo reale annunciati con `aria-live="polite"`.

### 5. Accessibilità
1. Navigazione completa da tastiera, ordine logico, nessuna trappola del focus.
2. Etichette accessibili per tutti i controlli e le icone senza testo.
3. Zoom del testo al 200% senza perdita di contenuto; layout da 320 px di larghezza.
4. `prefers-reduced-motion`: animazioni ridotte o assenti.
5. Il colore non è l'unico modo per indicare uno stato.
6. Test e2e della schermata con axe:
   ```ts
   const risultati = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
   expect(risultati.violations).toEqual([]);
   ```
7. Prova manuale con VoiceOver o TalkBack del percorso principale (annotala nella PR).

### 6. Confronto con il design
- Cattura le schermate di ogni stato a 390 px (mobile) e 1280 px (desktop, area di
  moderazione) in tema scuro e chiaro.
- Confrontale con le immagini in `design/F-xx-nome/`; le differenze volute vanno motivate
  nella PR.

### 7. Verifiche di contenuto (R-43)
- [ ] Nessun testo o icona che spinga a bere, spendere o uscire più spesso
- [ ] Nessuna urgenza artificiale o pressione sociale
- [ ] Opzioni di privacy con lo stesso peso visivo delle altre
- [ ] Per i minorenni nessun elemento legato all'alcol

## Checklist finale

- [ ] Solo token del design system; nuovi token aggiunti anche in Claude Design
- [ ] Tutti gli stati implementati
- [ ] Test unitari dei componenti ed e2e con axe senza violazioni
- [ ] Prova manuale con un lettore di schermo annotata
- [ ] Schermate di confronto allegate alla PR
- [ ] `safety-review` superata (sezioni B, C, G)
