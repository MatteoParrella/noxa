# ADR-0035: Interfaccia in stile iOS con materiali traslucidi

- **Stato**: Accettato
- **Data**: 2026-11-19

## Contesto
Il product owner vuole che Noxa sembri un'app nativa Apple (stile iOS 26 e Liquid Glass) su
telefono, tablet e PWA, senza cambiare funzioni, route, API o dati. L'audit fatto con le
Human Interface Guidelines ha trovato problemi trasversali nell'interfaccia di allora:

- testo che non segue la dimensione scelta nelle impostazioni (Dynamic Type) nell'app iOS;
  due testi a 10 px, sotto il minimo di 11 pt;
- vetro sfocato su schede, campi e segmenti, cioè sul contenuto, mentre nelle HIG il
  materiale traslucido appartiene solo allo strato dei controlli che galleggiano sopra;
- nessuna risposta a «Riduci trasparenza» e «Aumenta contrasto»;
- ingressi da 700 a 900 ms e titoli che salgono parola per parola a ogni cambio di area
  (ADR-0019): movimento lungo su interazioni frequenti;
- fogli con una maniglia solo decorativa, che non si trascinano;
- titoli editoriali da 48 px che scorrono via senza una barra che li riprenda.

Il product owner ha autorizzato a lavorare direttamente nel codice, senza passare da Claude
Design (deroga a DESIGN.md §1 per questo rifacimento).

## Decisione
- **Colori semantici sul modello di iOS** in `tokens.css`: etichette (primaria, secondaria,
  terziaria), sfondi (pagina raggruppata, secondario, terziario, cella), riempimenti,
  separatori e una sola tinta. I nomi storici (`--colore-superficie-*`, `--colore-testo-*`,
  `--colore-accento*`) restano come alias dei nuovi ruoli, così ogni schermata li eredita.
  Tutti i testi su colore pieno sono almeno a 4,5:1 in entrambi i temi; i valori e i
  rapporti sono scritti accanto ai token.
- **Tinta: ciano neon**, `#3EE0CF` in scuro (12,8:1 sul nero) e `#005A52` in chiaro (7,3:1
  su `#F2F2F7` e almeno 4,6:1 sui riempimenti grigi dei pulsanti tinti), al posto dell'arancio «lampione al sodio» di ADR-0011: richiama le insegne
  e i laser dei club, si distingue dal blu di sistema usato per il focus e non è uno dei
  modelli più diffusi (magenta o verde acido sul nero). Le copertine della famiglia
  «accento» seguono la stessa tinta.
- **Tema scuro predefinito**, nero puro come fondo di pagina e celle `#1C1C1E`. Il tema
  chiaro (fondo `#F2F2F7`, celle bianche) si sceglie con l'interruttore del profilo e resta
  salvato sul dispositivo. Le HIG sconsigliano una scelta del tema dentro l'app; il product
  owner la tiene perché Noxa si usa di sera e lo scuro deve valere anche con il sistema in
  chiaro.
- **Tipografia di sistema**: `-apple-system` (SF Pro) con Inter incluso nell'app come
  ripiego e Roboto su Android. La scala segue gli stili di Dynamic Type (Large Title 34,
  Title 1–3, Headline, Body 17, Callout, Subheadline, Footnote, Caption 1–2) in `rem` su una
  base di 17 px. Su iPhone e iPad la base è `-apple-system-body`, quindi segue la dimensione
  del testo di sistema. Archivo resta solo per i momenti di marca: copertine, marchio,
  Wrapped. IBM Plex Mono esce: i numeri usano le cifre tabulari del carattere di sistema.
- **Griglia da 8 pt** (4 come mezzo passo), margine di schermo di 16 pt, raggi ampi (6, 12,
  20, 26, 34 pt e capsula).
- **Materiali traslucidi solo nello strato funzionale**: barra delle schede, barra del
  titolo, fogli, menu, avvisi, notifiche brevi, barre delle azioni e pulsanti sopra le foto.
  Schede, celle e campi sono pieni. Il colore del marchio resta nel contenuto (fondo
  d'atmosfera, copertine) e il vetro lo raccoglie scorrendo. Senza `backdrop-filter`, con
  `prefers-reduced-transparency` o con `prefers-contrast: more` il vetro diventa pieno; con
  il contrasto aumentato i bordi salgono a 3:1. Sostituisce la trasparenza diffusa
  dell'aggiornamento di ADR-0033.
- **Componenti iOS**: barra delle schede a capsula galleggiante, con l'icona attiva piena e
  una capsula che scivola a molla; titolo grande che, scorrendo, lascia il posto a una barra
  di vetro con il titolo piccolo; liste raggruppate (`.gruppo`, `.gruppo-celle`, `.cella`);
  fogli con angoli da 34 pt che si chiudono trascinando la maniglia; segmented control;
  interruttore 51 × 31; pulsanti a capsula pieni, tinti e semplici; campo di ricerca;
  scheletri con un riflesso; stati vuoti centrati; avvisi al centro.
- **Movimento breve e a molla**: 150–450 ms, curve `linear()` smorzate. Niente titoli che
  salgono parola per parola né sfocature d'ingresso. Con `prefers-reduced-motion` restano
  dissolvenze brevi. La schermata di apertura (una volta per sessione) e i momenti di
  Ricorda possono restare più lunghi. Sostituisce le durate di ADR-0019.
- **Icone**: restano Lucide, lineari a 1,75 come gli SF Symbols; la scheda attiva usa la
  versione piena tinta. Nessun logo, nome o asset Apple.
- Layout di tablet e desktop di ADR-0022 e ADR-0033 invariati nella struttura: cambiano
  solo colori, materiali e controlli. La moderazione riceve solo i token.

## Alternative considerate
- **Libreria di componenti in stile iOS** (Konsta UI, Framework7): porta i propri
  componenti e le proprie classi, da rifare sopra quelli accessibili che esistono già.
  Scartata.
- **Seguire il tema del sistema senza interruttore**, come chiedono le HIG: scartata dal
  product owner, che vuole lo scuro sempre come predefinito.
- **Tenere Archivo per tutto il testo**: dà carattere, ma non segue Dynamic Type su iOS e
  allontana i controlli da quelli del sistema. Resta per la marca.
- **Altri accenti**: l'arancio al sodio (anche nella versione ambra `#FFB340`) è stato
  scartato dal product owner; magenta neon e viola elettrico hanno contrasti buoni, ma il
  magenta sul nero è un modello molto diffuso e il viola non ha un legame con il prodotto.

## Conseguenze
- Tutte le schermate cambiano aspetto senza toccare logica, route o dati; il lavoro
  procede area per area con un commit ciascuna.
- ADR-0011 (Claude Design come fonte dei token) resta per il flusso ordinario. Per questo
  rifacimento la fonte è il codice, e il progetto di Claude Design va riallineato.
- ADR-0019 e la trasparenza diffusa di ADR-0033 sono sostituiti nelle parti descritte sopra.
- `prefers-reduced-transparency` non è ancora supportato da Safari: su iOS il ripiego
  opaco scatta con «Aumenta contrasto», non con «Riduci trasparenza».
- Documenti aggiornati: DESIGN.md, CLAUDE.md, skill `implement-design`, indice degli ADR.
