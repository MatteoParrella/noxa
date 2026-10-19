-- partecipazioni_evento (DATA_MODEL.md §5.4). Regole: R-17, R-20, R-23, R-67, R-69.
-- Seed: minore_16 partecipa a e002 (visibile), minore_15 è interessato a e002 (solo per sé),
-- adulto_21 e adulto_18 partecipano a e001 (18+), adulto_20 è interessato a e004. Amici:
-- 15-16, 20-21, 18-17 (tra fasce, con codice); 14→15 in attesa.
begin;
select plan(30);

create function tests.e(n text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-00000000e' || n)::uuid;
$$;

create function tests.nome_di(id uuid) returns text language sql stable security definer
set search_path = '' as $$ select p.username::text from public.profili p where p.id = nome_di.id $$;
grant execute on function tests.nome_di(uuid) to authenticated;
-- Il nome si legge come postgres, così il confronto non dipende dalla RLS di profili.
create function tests.partecipazioni_viste() returns text[] language sql as $$
  select coalesce(array_agg(tests.nome_di(pe.utente_id) || ':' || right(pe.evento_id::text, 3)
                            order by tests.nome_di(pe.utente_id), pe.evento_id), '{}')
  from public.partecipazioni_evento pe;
$$;

-- ---------------------------------------------------------------------------------------------
-- Lettura (R-67): sé stessi e gli amici confermati, se visibile e se l'evento si vede
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
select is(tests.partecipazioni_viste(), '{}'::text[],
          'R-67: chi ha 14 anni, con una richiesta solo in attesa, non vede partecipazioni altrui');
select tests.autentica_come('minore_15');
select is(tests.partecipazioni_viste(), array['minore_15:002', 'minore_16:002'],
          'R-67: chi ha 15 anni vede la propria e quella visibile dell''amico');
select tests.autentica_come('minore_16');
select is(tests.partecipazioni_viste(), array['minore_16:002'],
          'R-67: una partecipazione "solo per te" non si vede, neanche dagli amici');
select tests.autentica_come('minore_17');
select is(tests.partecipazioni_viste(), '{}'::text[],
          'R-20, R-67: chi ha 17 anni non vede l''amico adulto a un evento 18+');
select tests.autentica_come('adulto_18');
select is(tests.partecipazioni_viste(), array['adulto_18:001'],
          'R-67: chi ha 18 anni non vede le partecipazioni di adulti che non sono amici');
select tests.autentica_come('adulto_20');
select is(tests.partecipazioni_viste(), array['adulto_20:004', 'adulto_21:001'],
          'R-67: chi ha 20 anni vede l''amico che partecipa a un evento 18+');
select tests.autentica_come('adulto_21');
select is(tests.partecipazioni_viste(), array['adulto_20:004', 'adulto_21:001'],
          'R-67: chi ha 21 anni vede l''amico interessato');
select tests.autentica_come('moderatore');
select is(tests.partecipazioni_viste(), '{}'::text[],
          'R-69: i moderatori non vedono le partecipazioni');

-- ---------------------------------------------------------------------------------------------
-- Inserimento: solo per sé e solo a eventi visibili e pubblicati
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_16');
select lives_ok(
  $$ insert into public.partecipazioni_evento (utente_id, evento_id, stato)
     values (tests.id('minore_16'), tests.e('004'), 'partecipo') $$,
  'F-05: chi ha 16 anni partecipa a un evento 16+'
);
select is((select visibile_agli_amici from public.partecipazioni_evento
           where utente_id = tests.id('minore_16') and evento_id = tests.e('004')), true,
          'R-67: la visibilità predefinita viene dalle impostazioni di privacy');
select throws_ok(
  $$ insert into public.partecipazioni_evento (utente_id, evento_id, stato)
     values (tests.id('minore_16'), tests.e('001'), 'interessato') $$,
  '42501', null,
  'R-20: chi ha 16 anni non si segna a un evento 18+'
);
select throws_ok(
  $$ insert into public.partecipazioni_evento (utente_id, evento_id, stato)
     values (tests.id('minore_16'), tests.e('006'), 'interessato') $$,
  '42501', null,
  'Non ci si segna a un evento annullato'
);
select throws_ok(
  $$ insert into public.partecipazioni_evento (utente_id, evento_id, stato)
     values (tests.id('minore_15'), tests.e('009'), 'partecipo') $$,
  '42501', null,
  'Non si segna una partecipazione a nome di altri'
);
select tests.autentica_come('minore_14');
select throws_ok(
  $$ insert into public.partecipazioni_evento (utente_id, evento_id, stato)
     values (tests.id('minore_14'), tests.e('004'), 'interessato') $$,
  '42501', null,
  'R-20: chi ha 14 anni non si segna a un evento 16+'
);
select tests.autentica_come('minore_17');
select throws_ok(
  $$ insert into public.partecipazioni_evento (utente_id, evento_id, stato)
     values (tests.id('minore_17'), tests.e('008'), 'interessato') $$,
  '42501', null,
  'R-23: chi ha 17 anni non si segna a un evento con riferimenti all''alcol'
);
select tests.autentica_come('adulto_18');
select lives_ok(
  $$ insert into public.partecipazioni_evento (utente_id, evento_id, stato)
     values (tests.id('adulto_18'), tests.e('008'), 'interessato') $$,
  'Chi ha 18 anni si segna a un evento con riferimenti all''alcol'
);
select tests.autentica_come('adulto_20');
select throws_ok(
  $$ insert into public.partecipazioni_evento (utente_id, evento_id, stato)
     values (tests.id('adulto_20'), tests.e('007'), 'partecipo') $$,
  '42501', null,
  'R-20: chi ha 20 anni non si segna a un evento 21+'
);
select tests.autentica_come('adulto_21');
select throws_ok(
  $$ insert into public.partecipazioni_evento (utente_id, evento_id, stato)
     values (tests.id('adulto_21'), tests.e('010'), 'partecipo') $$,
  '42501', null,
  'Non ci si segna a un evento in revisione'
);
select lives_ok(
  $$ update public.profili_privati set partecipazioni_visibili = false
     where utente_id = tests.id('adulto_21') $$,
  'Si cambia l''impostazione generale delle partecipazioni'
);
select lives_ok(
  $$ insert into public.partecipazioni_evento (utente_id, evento_id, stato)
     values (tests.id('adulto_21'), tests.e('007'), 'interessato') $$,
  'Chi ha 21 anni si segna a un evento 21+'
);
select is((select visibile_agli_amici from public.partecipazioni_evento
           where utente_id = tests.id('adulto_21') and evento_id = tests.e('007')), false,
          'R-67: con le partecipazioni private per default la nuova scelta è solo per sé');

-- ---------------------------------------------------------------------------------------------
-- Modifica e cancellazione: solo le proprie
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_16');
select lives_ok(
  $$ update public.partecipazioni_evento set visibile_agli_amici = false
     where utente_id = tests.id('minore_16') and evento_id = tests.e('002') $$,
  'F-05: si rende privata una partecipazione'
);
select tests.autentica_come('minore_15');
select is(tests.partecipazioni_viste(), array['minore_15:002'],
          'R-67: la partecipazione resa privata sparisce per l''amico');
select is_empty(
  $$ update public.partecipazioni_evento set stato = 'partecipo'
     where utente_id = tests.id('minore_16') returning 1 $$,
  'Non si cambia la partecipazione di un altro'
);
select throws_ok(
  $$ update public.partecipazioni_evento set utente_id = tests.id('minore_15')
     where utente_id = tests.id('minore_15') $$,
  '42501', null,
  'Il titolare di una partecipazione non si cambia'
);
select lives_ok(
  $$ update public.partecipazioni_evento set stato = 'partecipo'
     where utente_id = tests.id('minore_15') and evento_id = tests.e('002') $$,
  'F-05: da "mi interessa" a "partecipo" in un tocco'
);
select is_empty(
  $$ delete from public.partecipazioni_evento where utente_id = tests.id('minore_16') returning 1 $$,
  'Non si cancella la partecipazione di un altro'
);
select isnt_empty(
  $$ delete from public.partecipazioni_evento
     where utente_id = tests.id('minore_15') and evento_id = tests.e('002') returning 1 $$,
  'F-05: si toglie la propria scelta in un tocco'
);

-- ---------------------------------------------------------------------------------------------
-- Blocco (R-17): nasconde le partecipazioni in entrambe le direzioni
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('adulto_21');
select lives_ok(
  $$ insert into public.blocchi (bloccante_id, bloccato_id)
     values (tests.id('adulto_21'), tests.id('adulto_20')) $$,
  'Chi ha 21 anni blocca l''amico'
);
select tests.autentica_come('adulto_20');
select is(tests.partecipazioni_viste(), array['adulto_20:004'],
          'R-17: chi è bloccato non vede più la partecipazione di chi l''ha bloccato');

select * from finish();
rollback;
