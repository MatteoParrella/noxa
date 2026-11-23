# Momenti di riscontro

Tavole del brief del rinfresco §4, preparate da Claude il 2026-11-23 (iterazione 12) e
catturate dall'implementazione (`components/ui/Riscontro.tsx`, `styles/movimento.css`).

| Momento | Quando | Movimento (≤ 900 ms) | Testo |
|---|---|---|---|
| Amicizia confermata | Si accetta una richiesta | I due avatar arrivano dai lati e si affiancano | «Ora siete amici» · «Tu e Marco potete organizzare le serate insieme.» |
| Gruppo creato | Si crea un gruppo | Gli avatar entrano in fila, 90 ms l'uno dall'altro | «Il gruppo è pronto» · «Abbiamo mandato l'invito.» |
| Ci siete tutti | Tutti i membri hanno risposto sì; una volta per serata e dispositivo | Gli avatar compaiono insieme con un piccolo rimbalzo | «Ci siete tutti» · «Tutto il gruppo ha detto sì.» |

- Si chiude da solo dopo 2,6 s, con un tocco ovunque o con Esc; non prende il focus ed è un
  messaggio di stato per i lettori di schermo.
- Con il movimento ridotto resta solo la dissolvenza; niente coriandoli né punteggi.
- Se qualcuno manca o ha detto no, «Ci siete tutti» non compare per nessuno.

Tavole: `02-gruppo-pronto-*.png`, `03-ci-siete-tutti-*.png` nei due temi. La tavola
dell'amicizia confermata usa lo stesso componente con due avatar.
