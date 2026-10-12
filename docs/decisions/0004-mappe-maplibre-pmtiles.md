# ADR-0004: Mappe con MapLibre e PMTiles

- **Stato**: Accettato
- **Data**: 2026-10-12

## Contesto
Servono mappe vettoriali per l'area Milano e Brianza. La policy dei server di tile pubblici
di OpenStreetMap vieta l'uso intensivo da parte di applicazioni.

## Decisione
- MapLibre GL JS nel client.
- Tile vettoriali generate dai dati OpenStreetMap per l'area (estratto Protomaps) in un unico
  file PMTiles, servito dal bucket pubblico `mappe` di Supabase Storage tramite richieste
  HTTP Range; rigenerazione trimestrale.
- Attribuzione "© OpenStreetMap contributors" sempre visibile.

## Alternative considerate
- **tile.openstreetmap.org**: vietato dalla policy di utilizzo per un'app di produzione.
- **MapTiler o Mapbox**: costi crescenti con gli utenti e dati di utilizzo inviati a terzi;
  resta l'alternativa se servono stili o aggiornamenti più frequenti (D-09).

## Conseguenze
- Costo quasi nullo e nessun dato degli utenti inviato a fornitori di mappe.
- La generazione del file è un'attività di deploy documentata nel README.
