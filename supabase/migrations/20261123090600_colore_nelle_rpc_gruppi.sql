-- Migrazione: il colore dei gruppi nelle RPC (iterazione 12).
-- Documentazione: docs/DATA_MODEL.md §5.4 e §5.10. Le RPC restano security invoker: il colore
-- segue le stesse policy di `gruppi` (R-11, R-13).

drop function public.crea_gruppo(text, uuid[]);
drop function public.miei_gruppi();
drop function public.dettaglio_gruppo(uuid);

-- Chi crea il gruppo ne sceglie il colore (check `gruppi_colore`).
create or replace function public.crea_gruppo(
  nome text,
  invitati uuid[] default '{}',
  colore text default 'ciano'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  nuovo uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Serve un account.';
  end if;
  insert into public.gruppi (id, nome, creato_da, colore)
  values (nuovo, btrim(crea_gruppo.nome), auth.uid(), coalesce(crea_gruppo.colore, 'ciano'));
  perform public.invita_nel_gruppo(nuovo, invitati);
  return nuovo;
end;
$$;

-- I miei gruppi e i miei inviti, con il colore.
create or replace function public.miei_gruppi()
returns table (
  id uuid,
  nome text,
  colore text,
  mio_ruolo public.ruolo_gruppo,
  mio_stato public.stato_membro,
  membri integer,
  primi jsonb,
  invitato_da jsonb,
  prossima jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select g.id, g.nome, g.colore, io.ruolo, io.stato, private.conta_membri(g.id),
         coalesce((
           select jsonb_agg(private.persona_json(p) order by m.creato_il, p.id)
           from (select * from public.membri_gruppo m2
                 where m2.gruppo_id = g.id and m2.stato = 'attivo'
                 order by m2.creato_il limit 4) m
           join public.profili p on p.id = m.utente_id
         ), '[]'::jsonb),
         (select private.persona_json(p) from public.profili p where p.id = io.invitato_da),
         (select jsonb_build_object('id', s.id, 'data_serata', s.data_serata,
                                    'titolo', coalesce(s.titolo, e.titolo))
          from public.serate_gruppo s
          left join public.eventi e on e.id = s.evento_id
          where s.gruppo_id = g.id and s.stato <> 'annullata'
            and s.data_serata >= ((now() at time zone 'Europe/Rome') - interval '6 hours')::date
          order by s.data_serata, s.ora_ritrovo nulls last, s.id
          limit 1)
  from public.membri_gruppo io
  join public.gruppi g on g.id = io.gruppo_id
  where io.utente_id = auth.uid()
  order by io.stato = 'attivo', g.nome, g.id;
$$;

-- Dettaglio di un gruppo per un membro attivo, con il colore.
create or replace function public.dettaglio_gruppo(gruppo uuid)
returns table (
  id uuid,
  nome text,
  colore text,
  mio_ruolo public.ruolo_gruppo,
  creato_da jsonb,
  membri_totale integer,
  membri jsonb,
  altri integer,
  serate jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with oggi as (
    select ((now() at time zone 'Europe/Rome') - interval '6 hours')::date as giorno
  )
  select g.id, g.nome, g.colore, io.ruolo,
         (select private.persona_json(p) from public.profili p where p.id = g.creato_da),
         (select count(*)::integer from public.membri_gruppo m where m.gruppo_id = g.id),
         coalesce((
           select jsonb_agg(private.persona_json(p)
                            || jsonb_build_object('ruolo', m.ruolo, 'stato', m.stato)
                            order by m.utente_id <> auth.uid(), m.ruolo, m.stato desc,
                                     p.nome_visualizzato, p.id)
           from public.membri_gruppo m
           join public.profili p on p.id = m.utente_id
           where m.gruppo_id = g.id
         ), '[]'::jsonb),
         (select count(*)::integer from public.membri_gruppo m
          where m.gruppo_id = g.id
            and not exists (select 1 from public.profili p where p.id = m.utente_id)),
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', s.id, 'titolo', coalesce(s.titolo, e.titolo), 'data_serata', s.data_serata,
                    'ora_ritrovo', s.ora_ritrovo, 'stato', s.stato, 'locale_nome', l.nome,
                    'locale_comune', l.comune, 'passata', s.data_serata < (select giorno from oggi),
                    'si', (select count(*) from public.partecipazioni_serata x
                           where x.serata_id = s.id and x.risposta = 'si'),
                    'forse', (select count(*) from public.partecipazioni_serata x
                              where x.serata_id = s.id and x.risposta = 'forse'),
                    'mia_risposta', (select x.risposta from public.partecipazioni_serata x
                                     where x.serata_id = s.id and x.utente_id = auth.uid()))
                  order by s.data_serata, s.ora_ritrovo nulls last, s.id)
           from public.serate_gruppo s
           left join public.eventi e on e.id = s.evento_id
           left join public.locali l on l.id = e.locale_id
           where s.gruppo_id = g.id
         ), '[]'::jsonb)
  from public.gruppi g
  join public.membri_gruppo io on io.gruppo_id = g.id and io.utente_id = auth.uid() and io.stato = 'attivo'
  where g.id = dettaglio_gruppo.gruppo;
$$;

revoke all on function public.crea_gruppo(text, uuid[], text) from public, anon;
revoke all on function public.miei_gruppi() from public, anon;
revoke all on function public.dettaglio_gruppo(uuid) from public, anon;
grant execute on function public.crea_gruppo(text, uuid[], text) to authenticated;
grant execute on function public.miei_gruppi() to authenticated;
grant execute on function public.dettaglio_gruppo(uuid) to authenticated;
