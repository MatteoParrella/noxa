# ADR-0039: Invito al gruppo con link

- **Stato**: Proposto (D-23)
- **Data**: 2026-11-24

## Contesto
Il momento in cui un gruppo di amici decide di uscire è quello in cui Noxa può entrare nella
loro vita: chi organizza la serata vuole tirare dentro gli altri. Oggi si invita in un gruppo
solo un amico confermato già iscritto (F-13). App come Partiful sono cresciute proprio con
l'invito alla serata mandato a chi non le ha ancora.

Il rischio è che un link che circola faccia entrare sconosciuti in un gruppo, magari di
minorenni, o un adulto in un gruppo misto (R-15).

## Decisione
- Un admin genera un **link al gruppo** valido 48 ore e con un numero massimo di usi (fino a
  10, mai oltre il limite di 30 membri).
- **Anteprima senza account**: solo «Ti hanno invitato in un gruppo su Noxa», il colore del
  gruppo e il numero di membri. Nessun nome, username, avatar né serata, perché il nome del
  gruppo e delle persone sono dati che chi apre il link non ha titolo per vedere (R-07, R-13).
- Dopo l'accesso chi apre il link invia una **richiesta di ingresso**. Un admin la **approva
  esplicitamente** vedendo nome e username di chi la chiede (R-11). L'approvazione passa da
  `private.puo_entrare_nel_gruppo`: tra fasce diverse serve già un'amicizia confermata con ogni
  membro (R-15), quindi un adulto non entra in un gruppo di minorenni attraverso il link.
- Chi entra vede le serate del gruppo con le regole di sempre (R-24).
- Limiti anti-abuso come R-14; link revocabili; richieste scadute cancellate.

## Alternative considerate
- **Ingresso diretto senza approvazione**: troppo rischioso con link che circolano.
- **Anteprima con nome del gruppo e serata**: più invitante, ma mostra dati a chiunque abbia il
  link, anche a un adulto sconosciuto.
- **Invito solo agli amici, come oggi**: nessun passaparola.

## Conseguenze
- R-15 e R-07 aggiornate in SAFETY_PRIVACY.md; nuove tabelle con RLS (link e richieste) e test
  pgTAP per tutte le età, compresi un adulto con il link di un gruppo di minorenni e un gruppo
  misto; F-13 nel PRD; iterazione 14.
