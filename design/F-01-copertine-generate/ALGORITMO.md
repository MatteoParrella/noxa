# Copertina generata · specifica dell’algoritmo (F-01)

Riferimento per il componente `Copertina` (sarà riscritto in TypeScript, DESIGN.md §1). Il codice in `copertina-riferimento.js` è la fonte di verità di questa specifica; i valori qui sotto sono gli stessi.

Si usa quando un evento non ha né la foto del locale né un flyer approvato. Se la foto non si carica, al suo posto si disegna la copertina generata, mai un vuoto. La copertina sostitutiva dell’ADR-0023 (superficie neutra e orario) resta per i casi in cui la generata non è disponibile.

## 1. Seme

```
seme = normalizza(titolo) + "|" + normalizza(locale)
```

`normalizza`: scomposizione Unicode NFD e rimozione dei segni diacritici, minuscole, rimozione delle date (`12.11`, `12/11/2026`, `12-11`, `12 novembre 2026`), ogni carattere che non è lettera o cifra diventa spazio, spazi compressi.

| Titolo dalla fonte | Seme |
|---|---|
| ONE TWO · The Club | `one two|the club` |
| ONE TWO 25.11 · The Club | `one two|the club` (stesso seme: stessa copertina) |
| Città — Notte #3 · Cascina Torretta | `citta notte 3|cascina torretta` |

Il titolo scritto sulla copertina è quello della fonte senza la data (`titoloManifesto`), così ogni settimana è identico.

## 2. Hash e generatore

- `h = FNV-1a a 32 bit` del seme (UTF-16, come `charCodeAt`).
- Le scelte principali leggono bit diversi di `h`; i dettagli del motivo (posizioni, opacità) vengono da `mulberry32(h)`. Stesso seme → stessa copertina su ogni piattaforma.

| Scelta | Formula | Valori ammessi |
|---|---|---|
| Motivo | `h % 8` | lampioni, finestre, onde, altoparlante, tram, scia, costellazione, neon |
| Angolo | `ANGOLI[(h >>> 3) % 5]` | −18°, −9°, 0°, 9°, 18° |
| Densità | `(h >>> 6) % 3` | 0, 1, 2 (aggiunge elementi, mai oltre il massimo del motivo) |
| Bagliore, centro | `BAGLIORI[(h >>> 8) % 6]` | (18, 22), (50, 14), (82, 22), (26, 46), (74, 46), (50, 34) in %; sempre nella metà alta, lontano dal testo |
| Bagliore, raggio | `42 + ((h >>> 11) % 4) × 6` | 42, 48, 54, 60 % |

Il gruppo del motivo è ruotato attorno al centro e ingrandito (`rotate(a 200 125) scale(1.18) translate(-30 -19)`), così gli angoli del riquadro restano sempre coperti.

## 3. Motivi

Riquadro di disegno 400 × 250 (16:10), `preserveAspectRatio="xMidYMid slice"` per miniatura e testata. Colori solo da variabili (`--cg-1` tratto chiaro, `--cg-2` tratto scuro); nessun colore fisso nei motivi.

| Motivo | Cosa disegna | Elementi | Nodi SVG max |
|---|---|---|---|
| lampioni | coni di luce dall’alto con la testa del lampione | 3–5 coni + 3–5 cerchi | 12 |
| finestre | griglia di finestre, circa un terzo accese | 6–8 × 4 rettangoli | 34 |
| onde | onde sonore orizzontali, ampiezza decrescente | 5–7 tracciati | 9 |
| altoparlante | cerchi concentrici con il centro pieno | 6–10 cerchi | 12 |
| tram | fili del tram con la loro curva e i pali | 3–5 fili + 4 pali | 11 |
| scia | scie di luci in lunga esposizione | 6–10 tracciati | 12 |
| costellazione | punti e una sola linea che ne unisce alcuni | 10–16 cerchi + 1 tracciato | 19 |
| neon | 2–4 tubi astratti (arco, «C», zigzag, mezzo cerchio), ognuno con alone | 4–8 tracciati | 10 |

Il conteggio comprende `svg` e `g`. **Massimo assoluto: 34 nodi** (finestre a densità 2), sotto l’obiettivo di 40. Il conteggio è verificato su 20.000 semi. Nessuna persona, silhouette, bottiglia o bicchiere; nessun testo dentro i motivi.

## 4. Genere → famiglia di colore

Conta il **primo** genere dell’evento, normalizzato come il seme. Valori: fondo · 1 · 2 · bagliore. Ultima colonna: contrasto del testo (`--copertina-testo`) sul fondo, scuro / chiaro.

| Genere | Famiglia | Scuro | Chiaro | Testo / fondo |
|---|---|---|---|---|
| techno | `techno` | `#0E1619` · `#7ED6CC` · `#2F6A70` · `#1F5A5E` | `#E3F2F0` · `#0E5C58` · `#7CC2BA` · `#BFE6E1` | 16.2 / 15.4 |
| house | `house` | `#1A0F1C` · `#E58AD0` · `#6E2F66` · `#5A2453` | `#F6E6F2` · `#8A2A76` · `#D79ACB` · `#EFC8E7` | 16.5 / 14.8 |
| hip hop, rap, trap | `hiphop` | `#19140A` · `#F2C94C` · `#7A6020` · `#5E4A14` | `#F7EFD6` · `#6E5308` · `#D6B04A` · `#F0DC9C` | 16.3 / 15.5 |
| reggaeton | `reggaeton` | `#1C0F0C` · `#FF8A66` · `#7A3424` · `#6A2C1E` | `#FBE7E0` · `#9A3A20` · `#E59A82` · `#F5C8B9` | 16.6 / 14.9 |
| commerciale | `commerciale` | `#10132A` · `#9CB1FF` · `#3A4890` · `#2E3A7A` | `#E7EBFB` · `#2F3F9A` · `#9AA8E8` · `#CBD3F6` | 16.2 / 15.0 |
| latino | `latino` | `#121A0C` · `#B8E06A` · `#4F6F24` · `#3E5A1C` | `#EDF4DD` · `#43611A` · `#A6C870` · `#D4E7AE` | 15.8 / 15.7 |
| drum and bass, drum & bass, dnb | `dnb` | `#150F22` · `#B79CFF` · `#50388F` · `#3F2C74` | `#EEE7FB` · `#57379E` · `#B39CE6` · `#D8CBF5` | 16.6 / 14.8 |
| elettronica | `elettronica` | `#0B1424` · `#6EC3FF` · `#22517E` · `#1C4570` | `#E2EEF9` · `#155A93` · `#8EC0EA` · `#C3DDF3` | 16.3 / 15.1 |
| indie | `indie` | `#0F1913` · `#8FD9AE` · `#2F6447` · `#24503A` | `#E4F2EA` · `#22603F` · `#93CFAD` · `#C4E6D2` | 15.9 / 15.4 |
| live | `live` | `#1E0D14` · `#FF7FA0` · `#7A2840` · `#66213A` | `#FAE6EC` · `#96274A` · `#E596AD` · `#F4C6D3` | 16.6 / 14.9 |
| qualunque altro genere | `altro` | `#151515` · `#CFC8BE` · `#5A554F` · `#48443F` | `#EFECE7` · `#4A4540` · `#B5AEA5` · `#DCD7CF` | 16.2 / 15.1 |
| nessun genere | `accento` | `#12151A` · `#F28C28` · `#6B3E14` · `#5A3410` | `#F6EDE3` · `#B5560A` · `#EDB27A` · `#F6D3AE` | 16.2 / 15.4 |

Token: `--copertina-{famiglia}-fondo`, `-1`, `-2`, `-bagliore`; `--copertina-testo` (`#F4F1EB` scuro, `#15181E` chiaro). Sono dichiarati in `noxa-copertine.css` su `.nx, .nx-scuro` e su `.nx-chiaro`. La classe `.cg-{famiglia}` li collega alle variabili locali `--cg-*`.

## 5. Testo e contrasto

- Il testo sta sempre su una **velatura** del fondo della famiglia, opaca al 90–92 % dove c’è testo (`.cg-velo`, in miniatura anche in alto con `.cg-velo.alto`). Contrasto misurato nel caso peggiore (velatura al 90 % sopra il colore più chiaro del motivo): **≥ 12,7:1** in tutte le famiglie e in entrambi i temi, quindi ben sopra 4,5:1 per l’orario e 3:1 per il titolo.
- Corpo del titolo secondo la lunghezza del titolo senza data: fino a 8 caratteri `xl` (1 riga), fino a 14 `l` (2 righe), fino a 24 `m` (3 righe), oltre `s` (3 righe). Oltre l’ultima riga si tronca con «…» (`line-clamp`). A 360 px il corpo scende di una misura.
- Miniatura: orario e **titolo corto**, cioè al massimo 14 caratteri tagliati a parola intera, senza punteggiatura finale, più «…».
- La copertina è `aria-hidden="true"`: titolo, locale, orario e genere restano scritti nella scheda. Il colore non porta informazioni proprie.

## 6. Movimento

Solo l’ingresso delle schede (`ax-nitido`, dallo sfocato al nitido, 320 ms) con la classe `.entra`. Nessuna animazione infinita. Con `prefers-reduced-motion: reduce` non c’è nessun movimento.

## 7. Forme

| Forma | Proporzioni | Contenuto |
|---|---|---|
| Evidenza | 16:10, larghezza della scheda | orario (mono) + titolo da manifesto |
| Miniatura | quadrata, 84 px in elenco, 64 px nella mappa | orario + titolo corto |
| Dettaglio | testata alta 260 px | etichetta (giorno · comune), orario, titolo da manifesto |
