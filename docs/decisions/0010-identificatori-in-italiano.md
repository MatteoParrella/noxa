# ADR-0010: Identificatori e documentazione in italiano

- **Stato**: Accettato
- **Data**: 2026-10-12

## Contesto
Il team e il dominio sono italiani; il product owner ha chiesto tutto in italiano.

## Decisione
- Documentazione, commenti, messaggi di commit, nomi di tabelle, colonne, funzioni,
  variabili, componenti e file in italiano.
- Formato: `snake_case` per SQL e Python, `camelCase` per variabili e funzioni TypeScript,
  `PascalCase` per tipi e componenti; niente accenti né apostrofi negli identificatori
  (`eta_minima`, `citta`, `perche`).
- Restano in inglese i nomi imposti da framework e librerie (`useEffect`, `auth.users`,
  `page.tsx`, `layout.tsx`, `created_at` nelle tabelle di sistema) e i termini tecnici senza
  un equivalente diffuso (`hook`, `token`, `job`, `payload`, `fixture`).

## Alternative considerate
- **Codice in inglese e documentazione in italiano**: più comune, ma richiesto diversamente
  dal product owner; il mescolamento con il dominio italiano avrebbe creato traduzioni
  incoerenti (`ageMin` vs `eta_minima`).

## Conseguenze
- Collaboratori non italiani avranno una curva di apprendimento più ripida.
- Serve coerenza: il glossario implicito è il DATA_MODEL.md.
