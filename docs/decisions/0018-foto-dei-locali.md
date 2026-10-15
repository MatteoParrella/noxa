# ADR-0018: Foto dei locali come immagine degli eventi

- **Stato**: Accettato
- **Data**: 2026-10-15

## Contesto
Nel design system (`design/sistema/`) la scheda di un evento mostra un blocco colorato
con l'accento al posto di un'immagine. Il product owner vuole che ogni evento abbia come
sfondo una foto **del locale** in cui si svolge, così chi scorre l'elenco riconosce subito
il posto. Le regole di raccolta degli eventi vietano però di scaricare o ripubblicare
immagini dai siti, da Instagram e da Google (ADR-0008, EVENT_INGESTION.md §2.4), e l'app è
usata anche da minorenni: una foto mostrata a tutti non può contenere persone riconoscibili
né mettere in evidenza l'alcol (R-23, R-40).

## Decisione
- Ogni locale può avere **una foto principale**, usata come immagine di copertina dei suoi
  eventi: scheda in evidenza e righe dell'elenco Scopri, dettaglio dell'evento, anteprima
  sulla mappa. Sopra la foto il testo resta leggibile grazie a una velatura definita nei
  design token (contrasto ≥ 4,5:1, DESIGN.md §4).
- **Ordine dell'immagine di un evento**: foto del locale; se manca, l'immagine del flyer
  approvato (`flyer-pubblicati`); se manca anche quella, il fondo tipografico del design
  system.
- **Fonti ammesse**, una delle tre, registrata in `locali.immagine_fonte`:
  1. `autorizzazione_locale`: foto fornita dal locale con un'autorizzazione scritta all'uso
     nell'app, di cui si conserva il riferimento (`immagine_riferimento`);
  2. `noxa`: foto scattata da Noxa;
  3. `licenza_libera`: foto con licenza che consente l'uso commerciale (CC0, CC BY,
     CC BY-SA), con attribuzione obbligatoria (`immagine_attribuzione`) mostrata nel
     dettaglio dell'evento.
  Sono **vietate** le foto prese da Google Places, Instagram, siti dei locali o motori di
  ricerca senza autorizzazione.
- **Contenuto** (R-56): esterno, insegna o sala; nessuna persona riconoscibile (si sfoca
  prima del caricamento); nessuna bottiglia, banco bar o marchio di alcolici in evidenza,
  perché la foto è visibile anche ai minorenni.
- La foto è caricata **solo da un moderatore** nell'area di moderazione dei locali (F-40),
  che ne conferma fonte e contenuto; l'app rimuove l'EXIF, converte in WebP con lato
  massimo di 1600 px e la salva nel bucket privato `immagini-locali`, leggibile dagli utenti
  autenticati quando il locale è attivo.
- Ogni foto è segnalabile (R-50) con il nuovo valore `immagine_locale` di
  `tipo_oggetto_segnalabile`.

## Alternative considerate
- **Foto da Google Places**: costo per ogni visualizzazione, richieste a Google dal
  dispositivo dell'utente (tracciamento di terze parti, R-62) e termini che vietano di
  conservare le foto.
- **Foto dai siti o dall'Instagram dei locali**: diritti d'autore e termini d'uso
  (ADR-0008); possibili persone riconoscibili, anche minorenni.
- **Solo il flyer come immagine**: molti eventi non hanno un flyer caricato, e il flyer non
  identifica il posto.

## Conseguenze
- `locali` riceve le colonne della foto, `tipo_oggetto_segnalabile` il valore
  `immagine_locale`, lo storage il bucket `immagini-locali` (DATA_MODEL.md).
- Nuova regola R-56 e riga di conservazione in SAFETY_PRIVACY.md.
- Lavoro operativo: raccogliere foto autorizzate per i locali verificati
  (prerequisito esterno dell'iterazione 5); finché un locale non ha la foto vale l'ordine
  sopra.
- Il componente Scheda evento del design system ha uno spazio immagine con velatura al
  posto del blocco colorato (iterazione 1); colonne e bucket arrivano nell'iterazione 4,
  il caricamento dei moderatori nell'iterazione 5.
