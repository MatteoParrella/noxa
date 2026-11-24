-- Migrazione: elenco pubblico delle serate per il sito senza account (D-18, ADR-0036).
-- Documentazione: docs/DATA_MODEL.md §5.3 (RPC cerca_eventi_pubblici); regole: R-07, R-20,
-- R-21, R-23.
--
-- Il ruolo anon continua a non leggere nessuna tabella: l'unico accesso è questa funzione, che
-- restituisce poche colonne e nessun dato degli utenti. Le serate con riferimenti all'alcol
-- restano nell'elenco senza titolo e senza generi (R-23: chi guarda può essere minorenne), con
-- l'età minima almeno 18. Ogni clic sul sito porta all'iscrizione: il dettaglio resta agli
-- iscritti e segue la RLS di sempre.

create or replace function public.cerca_eventi_pubblici(
  dal date default null,
  al date default null
)
returns table (
  id uuid,
  riservato boolean,
  titolo text,
  inizio timestamptz,
  fine timestamptz,
  data_serata date,
  eta_minima smallint,
  eta_minima_dichiarata boolean,
  stato public.stato_evento,
  generi_evento text[],
  locale_nome text,
  locale_comune text,
  copertina_colori jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  oggi date := ((now() at time zone 'Europe/Rome') - interval '6 hours')::date;
  v_dal date := coalesce(dal, oggi);
  v_al date := coalesce(al, dal, oggi);
begin
  -- Solo le prossime settimane: l'elenco pubblico non è un archivio da scaricare.
  if v_al < v_dal or v_al - v_dal > 31 or v_dal < oggi - 1 or v_al > oggi + 92 then
    raise exception using errcode = '22023', message = 'Intervallo di date non valido.';
  end if;

  return query
  select e.id,
         e.riferimenti_alcol,
         -- R-23: il titolo può contenere il riferimento all'alcol.
         case when e.riferimenti_alcol then null else e.titolo end,
         e.inizio, e.fine, e.data_serata,
         case when e.riferimenti_alcol then greatest(e.eta_minima, 18::smallint)
              else e.eta_minima end,
         e.eta_minima_dichiarata,
         e.stato,
         case when e.riferimenti_alcol then '{}'::text[]
              else coalesce((select array_agg(g.genere_codice order by g.genere_codice)
                             from public.eventi_generi g where g.evento_id = e.id), '{}') end,
         l.nome, l.comune,
         case when e.riferimenti_alcol then null else e.copertina_colori end
  from public.eventi e
  join public.locali l on l.id = e.locale_id
  -- Le stesse condizioni della policy di eventi e di locali per un adulto (R-20, R-21).
  where e.stato in ('pubblicato', 'annullato')
    and l.attivo
    and e.data_serata between v_dal and v_al
    and coalesce(e.fine, e.inizio + interval '6 hours') > now()
  order by e.inizio, e.id
  limit 300;
end;
$$;

comment on function public.cerca_eventi_pubblici(date, date) is
  'Elenco ridotto delle serate per il sito senza account (ADR-0036): nessun dato degli utenti; '
  'serate con riferimenti all''alcol senza titolo né generi (R-23).';

-- Solo per chi non ha un account: gli iscritti usano cerca_eventi con la propria età (R-20).
revoke all on function public.cerca_eventi_pubblici(date, date) from public, authenticated;
grant execute on function public.cerca_eventi_pubblici(date, date) to anon;

-- I nomi dei generi servono alle schede pubbliche: il ruolo anon non legge le tabelle.
create or replace function public.generi_pubblici()
returns table (codice text, nome text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.codice, g.nome from public.generi_musicali g order by g.nome;
$$;

comment on function public.generi_pubblici() is
  'Nomi dei generi musicali per l''elenco pubblico (ADR-0036).';

revoke all on function public.generi_pubblici() from public, authenticated;
grant execute on function public.generi_pubblici() to anon;
