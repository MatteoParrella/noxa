# Icona, schermata di apertura e anteprima dei link

Tavole preparate da Claude il 2026-11-23 nell'iterazione 12: il product owner non usa più Claude
Design (DESIGN.md §1). Le immagini sono generate dal codice con `pnpm --filter web icone`
(`apps/web/scripts/genera-icone.mjs`) partendo da `apps/web/public/icone/icona.svg`.

## Obiettivo
Sostituire l'icona provvisoria dell'iterazione 1 con un simbolo disegnato con il carattere del
marchio, uguale ovunque: PWA, iPhone (schermata Home), Android (icona adattiva e tonda),
schermata di apertura dell'app e anteprima dei link condivisi.

## Decisioni
- **Simbolo**: la «n» di Archivo a peso 800 e larghezza 68 (la stessa `--tipo-larghezza-marchio`
  del marchio nell'app), convertita in tracciato, con il «lampione» ciano in alto a destra
  (`#3EE0CF`, la tinta dell'app nel tema scuro) e un bagliore tenue intorno al punto.
- **Fondo nero** in tutte le versioni, anche nel tema chiaro: è il colore della notte e
  dell'apertura; l'icona adattiva di Android usa `ic_launcher_background` nero.
- **Zona sicura**: il simbolo occupa la metà centrale del quadrato, quindi resta intero nelle
  maschere tonde e a goccia di Android e negli angoli arrotondati di iOS.
- **Anteprima dei link** (1200 × 630): simbolo, scritta «noxa.» con il carattere del marchio e
  la frase del Benvenuto. Nessun evento reale, nessuna persona (R-07, R-42).
- **Apertura**: lo stesso tracciato in `Apertura.tsx`; l'animazione non cambia (ADR-0019).

## Tavole
| File | Contenuto |
|---|---|
| `01-icona.png` | Icona 512 × 512 (PWA e base delle altre) |
| `02-anteprima-link.png` | Anteprima Open Graph dei link |
| `03-icona-android-tonda.png` | Icona tonda di Android |
| `04-apertura-android.png` | Schermata di apertura nativa di Android (verticale) |
| `05-apertura-app.png` | Apertura animata dell'app a metà animazione |

## Da fare nell'iterazione 13
Schermate e testi per la scheda di Google Play (e App Store se si chiude D-13).
