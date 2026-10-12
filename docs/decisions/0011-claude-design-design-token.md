# ADR-0011: Claude Design come fonte del design e token in Tailwind

- **Stato**: Accettato
- **Data**: 2026-10-12

## Contesto
Il product owner progetta l'interfaccia con Claude Design. Serve un passaggio ripetibile e
coerente dal design al codice.

## Decisione
- Claude Design è lo strumento di progettazione e contiene il design system di Noxa.
- I materiali esportati per ogni schermata vanno in `design/F-xx-nome/` come riferimento.
- La fonte di verità nel codice per i token è `apps/web/src/styles/tokens.css`, collegata a
  Tailwind; i componenti usano solo token.
- L'implementazione segue la skill `implement-design`, che include accessibilità e
  `safety-review`.

## Alternative considerate
- **Figma**: richiederebbe un secondo strumento e un altro flusso di passaggio.
- **Copiare direttamente il codice esportato**: veloce ma incoerente con componenti,
  convenzioni, accessibilità e test del progetto.

## Conseguenze
- Ogni modifica visiva parte dal design e arriva ai token nella stessa PR.
