# ADR-0040: Pagine pubbliche statiche per la ricerca e per i link condivisi

- **Stato**: Proposto (D-24)
- **Data**: 2026-11-24

## Contesto
L'elenco pubblico delle serate (ADR-0036) è generato nel browser: i motori di ricerca non lo
leggono e un link condiviso mostra solo marchio e descrizione. Le ricerche come «eventi
stasera Milano» o «serate 16+ Monza» sono il canale di acquisizione gratuito più mirato, e
l'anteprima di un link su WhatsApp è il primo contatto con chi non conosce Noxa. ADR-0036
lasciava questo punto a un'altra decisione e il product owner vuole tenere i dettagli per gli
iscritti.

## Decisione
- Pagine **statiche** generate durante la pubblicazione e ricostruite una volta al giorno,
  con la sveglia da `pg_cron` (ADR-0003, come ADR-0031): una per serata dei prossimi 31
  giorni, una per locale, una per genere, più «Stasera» e «Questo weekend».
- Contengono **solo i dati dell'elenco pubblico** (ADR-0036): titolo, locale, comune, data,
  ora, età minima, generi, copertina generata. Nessuna descrizione, prezzo, biglietti, amici,
  conteggi o dati degli utenti; ogni azione porta all'iscrizione, come oggi.
- Ogni pagina di serata ha i dati strutturati schema.org `Event` (nome, data, luogo, stato) e
  l'anteprima del link con un'immagine generata in fase di build.
- **Serate con riferimenti all'alcol**: «Serata 18+» senza titolo né generi, come nell'elenco,
  escluse dalla mappa del sito e dall'indice (`noindex`), senza dati strutturati.
- Fonte dei dati: la RPC `cerca_eventi_pubblici` con la chiave pubblica, senza nuovi permessi
  per il ruolo `anon`. `robots.txt` apre solo le pagine pubbliche.

## Alternative considerate
- **Dettaglio pubblico completo**: già scartato dal product owner (ADR-0036).
- **Pagine generate a ogni richiesta** (Pages Functions): sempre aggiornate, ma con un
  componente server in più; da rivalutare se un giorno non basta.

## Conseguenze
- R-07 precisata in SAFETY_PRIVACY.md (pagine statiche con gli stessi dati); ARCHITECTURE.md
  (build e sveglia), PRD.md (F-01) e workflow di pubblicazione aggiornati; iterazione 15.
