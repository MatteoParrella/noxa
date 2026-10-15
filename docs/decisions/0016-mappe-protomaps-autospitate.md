# ADR-0016: Mappe gratuite con Protomaps auto-ospitato

- **Stato**: Accettato (sostituisce ADR-0004)
- **Data**: 2026-10-12
- **Decisione aperta chiusa**: D-09

## Contesto
Servono mappe vettoriali di qualità per Milano e Brianza, con tema scuro coerente con l'app,
a costo nullo o quasi anche con molti utenti. MapTiler costa da 25 $/mese (uso commerciale)
fino a oltre 1.000 $/mese con 50.000 utenti attivi: troppo per il modello del prodotto. Le
tile pubbliche di openstreetmap.org non possono essere usate da un'app in produzione.

## Decisione
- **Dati e stile**: basemap di [Protomaps](https://protomaps.com) costruita da OpenStreetMap,
  scaricabile gratuitamente e senza chiavi API, con lo stile ufficiale `dark` (tema
  predefinito dell'app) e `light` (tema chiaro) del pacchetto `@protomaps/basemaps`. I colori
  dello stile vengono sovrascritti con i design token di Noxa (DESIGN.md §2), così la mappa
  ha la stessa identità visiva dell'app.
- **File**: un unico file `milano-brianza.pmtiles` estratto dalla build mondiale giornaliera
  di Protomaps con il riquadro delle province MI e MB:
  ```bash
  pmtiles extract https://build.protomaps.com/<AAAAMMGG>.pmtiles milano-brianza.pmtiles \
    --bbox=8.65,45.15,9.60,45.80
  ```
  Aggiornamento trimestrale con un job della CI.
- **Hosting**: bucket pubblico `mappe` di Supabase Storage (richieste HTTP Range, CDN di
  Supabase). Nello stesso bucket stanno anche **font (glyphs) e icone (sprites)** di
  Protomaps (`basemaps-assets`), così nessuna richiesta della mappa va a server di terzi.
- **Client**: MapLibre GL JS con il protocollo `pmtiles://` (libreria `pmtiles`). Le tile già
  viste restano nella cache del service worker, quindi chi riapre la mappa non le riscarica
  (font e icone dall'iterazione 1, tile con l'offline dell'iterazione 8).
- **Attribuzione**: "© OpenStreetMap contributors" e "Protomaps" sempre visibili.
- **Soglia di crescita**: se il traffico delle mappe supera il traffico incluso nel piano
  Supabase (oggi circa 250 GB/mese, circa 10.000 utenti attivi al mese), il file si sposta su
  Cloudflare R2, che non fa pagare il traffico in uscita e ha 10 GB di archiviazione gratuiti.
  Lo spostamento richiede prima di aggiornare D-07 (Cloudflare è un fornitore extra-UE e
  riceve gli indirizzi IP di chi scarica la mappa) e di cambiare solo
  `NEXT_PUBLIC_MAPPA_PMTILES_URL`.
- **Riserva d'emergenza**: se il bucket non è raggiungibile, l'app passa all'elenco degli
  eventi (che contiene tutte le informazioni della mappa, DESIGN.md §4). Il servizio
  gratuito OpenFreeMap **non** si usa in produzione: si regge su donazioni e non offre
  garanzie di continuità.

## Alternative considerate
- **MapTiler**: stili curati e aggiornamenti automatici, ma il costo cresce con gli utenti
  (25–1.000+ $/mese).
- **OpenFreeMap pubblico**: gratuito e senza limiti dichiarati, ma senza garanzie di servizio
  e con richieste degli utenti verso un server di terzi.
- **Server di tile proprio (es. Martin, TileServer GL)**: un servizio in più da gestire, che
  per un file statico non serve.

## Conseguenze
- Costo delle mappe: 0 € fino al traffico incluso nel piano Supabase; poche decine di euro
  al mese oltre, oppure 0 € con R2.
- Lo stile di Protomaps è meno rifinito dei servizi commerciali: la personalizzazione con i
  design token fa parte del lavoro della Fase 0 (circa 1–2 giorni, insieme allo script di
  estrazione).
- La posizione e le ricerche sulla mappa degli utenti non passano da fornitori esterni.
