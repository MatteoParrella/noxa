# ADR-0017: Un'unica fascia per i minorenni dai 14 ai 17 anni

- **Stato**: Accettato
- **Data**: 2026-10-12
- **Decisione aperta chiusa**: D-02

## Contesto
R-10 limita la ricerca degli utenti alla propria fascia. Mancava una scelta su un punto: se i minorenni
di età diverse (per esempio 14 e 17 anni) potessero trovarsi con la ricerca per username,
oppure solo con il codice invito di persona.

## Decisione
Tutti gli utenti dai 14 ai 17 anni formano **un'unica fascia** (`private.stessa_fascia`): un
quattordicenne può cercare per username un diciassettenne e inviargli una richiesta di
amicizia, che deve essere accettata esplicitamente (R-11). Restano validi tutti gli altri
limiti: ricerca per prefisso di almeno 3 caratteri, al massimo 20 risultati, nessun elenco
di profili (R-10), limiti anti-abuso (R-14), blocco e segnalazione (R-17, R-50).

## Alternative considerate
- **Ricerca limitata a ±2 anni di differenza**: più restrittiva, ma separerebbe compagni di
  scuola e amici reali di età diverse, che nei gruppi del mondo reale sono comuni; a quel
  punto il codice QR diventerebbe il canale normale e la protezione perderebbe significato.
- **Nessuna ricerca, solo codice invito**: la più prudente, ma rende lento l'avvio della rete
  di amici e quindi del prodotto.

## Conseguenze
- Nessuna modifica allo schema: è il comportamento già descritto in DATA_MODEL.md e
  SAFETY_PRIVACY.md.
- Il rischio residuo (un adulto che si dichiara minorenne, R-03) resta mitigato da
  amicizia reciproca, assenza di chat libera, profili non elencabili, segnalazioni e tempi di
  moderazione di R-53. La regola va rivalutata con i dati delle segnalazioni dopo la Fase 1.
