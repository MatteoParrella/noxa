---
name: db-migration
description: Come creare una migrazione Supabase (tabelle, colonne, enum, funzioni, trigger, policy RLS, storage, pg_cron) con le relative policy e i test pgTAP. Da usare per ogni modifica allo schema del database o alle regole di accesso.
---

# Migrazione del database con RLS e test

## Prerequisiti

- Fase 0 completata: `supabase/` inizializzata, schema `private` con le funzioni di
  DATA_MODEL.md §4, seed con gli utenti di test, `supabase/tests/000_supporto.test.sql`.
- Database locale avviato: `supabase start`.
- Hai letto la sezione della tabella in `docs/DATA_MODEL.md` e le regole citate in
  `docs/SAFETY_PRIVACY.md`. Se la tabella non è documentata, **prima** aggiorna
  `DATA_MODEL.md` (colonne, vincoli, policy per S/I/U/D, test) e solo dopo scrivi l'SQL.

## Procedura

### 1. Crea il file
```bash
supabase migration new <verbo>_<oggetto>        # es. crea_tabella_gruppi, aggiungi_colonna_phash
```
Il file viene creato in `supabase/migrations/<timestamp>_<nome>.sql`. Una migrazione =
una modifica coerente. Non modificare mai una migrazione già unita in `main`: scrivine una
nuova.

### 2. Scrivi l'SQL nell'ordine seguente

```sql
-- Migrazione: <descrizione>
-- Documentazione: docs/DATA_MODEL.md §<sezione>; regole: R-xx, R-yy

-- 2.1 Tipi (solo aggiunte; i valori di enum non si rimuovono)
create type public.stato_membro as enum ('invitato', 'attivo');

-- 2.2 Tabella con vincoli espliciti
create table public.membri_gruppo (
  gruppo_id   uuid not null references public.gruppi(id) on delete cascade,
  utente_id   uuid not null references public.profili(id) on delete cascade,
  ruolo       public.ruolo_gruppo not null default 'membro',
  stato       public.stato_membro not null default 'invitato',
  invitato_da uuid references public.profili(id) on delete set null,
  creato_il   timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  primary key (gruppo_id, utente_id)
);
comment on table public.membri_gruppo is 'Membri dei gruppi. Invariante delle fasce: R-15.';

-- 2.3 Indici per le colonne usate nelle policy e nelle join
create index membri_gruppo_utente_idx on public.membri_gruppo (utente_id);

-- 2.4 RLS: SEMPRE, subito dopo la tabella
alter table public.membri_gruppo enable row level security;

-- 2.5 Permessi di colonna se servono (prima revoca, poi concedi solo il necessario)
revoke update on public.membri_gruppo from authenticated;
grant update (stato, ruolo) on public.membri_gruppo to authenticated;

-- 2.6 Policy: una per operazione e per ruolo, nome descrittivo, commento con la regola
-- R-15
create policy "membri_gruppo: i membri vedono i membri"
  on public.membri_gruppo for select to authenticated
  using ((select private.e_membro(gruppo_id)));

-- R-15
create policy "membri_gruppo: un membro attivo invita un amico compatibile"
  on public.membri_gruppo for insert to authenticated
  with check (
    (select private.e_membro_attivo(gruppo_id))
    and invitato_da = (select auth.uid())
    and stato = 'invitato' and ruolo = 'membro'
    and (select private.sono_amici((select auth.uid()), utente_id))
    and (select private.puo_entrare_nel_gruppo(gruppo_id, utente_id))
  );

-- 2.7 Trigger (aggiornato_il e regole non esprimibili nelle policy)
create trigger membri_gruppo_aggiornato_il
  before update on public.membri_gruppo
  for each row execute function private.imposta_aggiornato_il();
```

Regole obbligatorie:

- **`alter table … enable row level security`** per ogni nuova tabella in `public`.
- Le funzioni nelle policy si chiamano dentro `(select …)`, così Postgres le valuta una volta
  per query invece che per riga.
- Funzioni `security definer`: nello schema `private`, con `set search_path = ''`, nomi
  completamente qualificati (`public.amicizie`, `auth.uid()`), `stable` se non scrivono.
  Esempio:
  ```sql
  create or replace function private.sono_amici(a uuid, b uuid)
  returns boolean language sql stable security definer set search_path = '' as $$
    select exists (
      select 1 from public.amicizie f
      where f.stato = 'accettata'
        and least(f.richiedente_id, f.destinatario_id) = least(a, b)
        and greatest(f.richiedente_id, f.destinatario_id) = greatest(a, b)
    ) and not private.c_e_blocco(a, b);
  $$;
  revoke all on function private.sono_amici(uuid, uuid) from public;
  grant execute on function private.sono_amici(uuid, uuid) to authenticated, noxa_worker;
  ```
- **Ricorsione**: se la policy della tabella A interroga la tabella B e la policy di B
  interroga A, Postgres fallisce con "infinite recursion detected in policy". In questi casi
  usa una funzione `security definer` in `private` (es. `private.e_titolare_checkin`) invece
  della sottoquery diretta.
- RPC in `public`: documentate in DATA_MODEL.md, `security invoker` quando possibile; se
  `security definer`, con filtri espliciti sull'utente e test dedicati.
- Errori personalizzati nei trigger: `raise exception using errcode = 'NX0nn', message = '…'`;
  aggiungi il codice in `apps/web/src/lib/errori.ts` nella stessa PR.
- Il ruolo `anon` non riceve policy (R-07). Il ruolo `noxa_worker` riceve `GRANT` e policy
  `to noxa_worker` solo sulle tabelle elencate in DATA_MODEL.md.
- Storage: le policy dei bucket vanno su `storage.objects` filtrando per `bucket_id` e con
  `(storage.foldername(name))[1]` per la cartella dell'utente.
- `pg_cron`: `select cron.schedule('<nome>', '<cron>', $$select private.<funzione>()$$);`
  nella migrazione, con un nome univoco.
- Nuovi dati personali: aggiungi la regola di conservazione in
  `private.applica_conservazione()` e i dati a `esporta_miei_dati` ed `elimina-account`.

### 3. Scrivi i test pgTAP

File `supabase/tests/<nn>_<tabella>.test.sql` (numerazione per ordine di dipendenza, da 010
in poi). I file `000_supporto.test.sql` (funzioni di supporto, eseguito per primo e senza
`rollback`, così le funzioni restano disponibili agli altri file) e
`001_rls_abilitata.test.sql` esistono già dalla Fase 0.

Funzioni di supporto disponibili:

| Funzione | Effetto |
|---|---|
| `tests.autentica_come(nome text)` | `set local role authenticated` e imposta `request.jwt.claims` con `sub` dell'utente del seed, `role = authenticated` e `aal` (`aal2` per `moderatore`, `aal1` per gli altri) |
| `tests.id(nome text)` | uuid dell'utente del seed |
| `tests.gruppo(nome text)` | uuid di un gruppo del seed (`gruppo_minori`, `gruppo_adulti`, `gruppo_misto`) |
| `tests.esci()` | torna al ruolo `postgres` |


```sql
begin;
select plan(6);

-- Funzioni tests.autentica_come, tests.id, tests.gruppo: definite in supabase/tests/000_supporto.test.sql
select tests.autentica_come('adulto_21');
select is_empty(
  $$ select 1 from public.membri_gruppo where utente_id = tests.id('minore_16') $$,
  'R-15: un adulto non vede i membri minorenni di gruppi a cui non appartiene'
);

select tests.autentica_come('adulto_18');
select throws_ok(
  $$ insert into public.membri_gruppo (gruppo_id, utente_id, invitato_da)
     values (tests.gruppo('gruppo_misto'), tests.id('minore_15'), tests.id('adulto_18')) $$,
  '42501', null,
  'R-15: un adulto non può invitare un minorenne che non è suo amico'
);

select tests.autentica_come('minore_16');
select lives_ok(
  $$ insert into public.membri_gruppo (gruppo_id, utente_id, invitato_da)
     values (tests.gruppo('gruppo_minori'), tests.id('minore_17'), tests.id('minore_16')) $$,
  'Un minorenne invita un amico minorenne'
);
-- … un caso positivo e uno negativo per ogni policy e per ogni fascia pertinente

select * from finish();
rollback;
```

Copertura minima per ogni tabella:

| Operazione | Casi |
|---|---|
| S | titolare; amico confermato; stessa fascia non amico; altra fascia non amico; bloccato; moderatore con e senza MFA (se pertinente) |
| I/U/D | caso consentito; ogni condizione della `with check` violata una alla volta |
| Regole d'età | utenti di 14, 15, 16, 17, 18, 20, 21 anni dove la policy dipende dall'età |
| Trigger | caso consentito e caso rifiutato con il codice di errore atteso |

### 4. Verifica

```bash
supabase db reset                 # applica tutte le migrazioni da zero + seed
supabase test db                  # tutti i test, compreso 001_rls_abilitata
supabase db lint                  # avvisi su funzioni e policy
supabase gen types typescript --local > apps/web/src/lib/database.types.ts
pnpm --filter web typecheck       # il codice compila con i nuovi tipi
```

Controlla anche il piano delle query principali coinvolte:
`explain analyze` impersonando un utente (`set local role authenticated;
set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';`). Nessuna
scansione sequenziale su tabelle che cresceranno oltre le 10.000 righe.

### 5. Documenta

- `docs/DATA_MODEL.md`: colonne, policy e test coincidono con l'SQL.
- `docs/SAFETY_PRIVACY.md`: colonna "Applicazione" aggiornata se cambia l'implementazione di
  una regola; tabella di conservazione aggiornata se ci sono nuovi dati.
- Esegui la skill `safety-review`.

## Checklist finale

- [ ] RLS abilitata e policy per ogni operazione consentita
- [ ] Funzioni privilegiate in `private`, `search_path` vuoto, `execute` concesso solo a chi serve
- [ ] Test pgTAP positivi e negativi, `supabase test db` verde
- [ ] Tipi TypeScript rigenerati e typecheck verde
- [ ] DATA_MODEL.md e SAFETY_PRIVACY.md aggiornati
- [ ] Nessuna migrazione già unita è stata modificata
