-- Aggiornamenti dal vivo di gruppi e serate (DATA_MODEL.md §7): avvisi senza dati su canali
-- Broadcast privati, ascoltabili solo da chi vede la serata o dal titolare del canale dei
-- gruppi. Regole: R-13, R-17, R-24. Tutte le età del seed.
begin;
select plan(29);

-- «Ascolto»: adulto_18 (admin) e minore_17, amici con il codice nel seed; serata libera.
select tests.autentica_come('adulto_18');
select public.crea_gruppo('Ascolto', array[tests.id('minore_17')]);
select tests.autentica_come('minore_17');
update public.membri_gruppo set stato = 'attivo'
where gruppo_id = tests.gruppo('Ascolto') and utente_id = tests.id('minore_17');
select tests.autentica_come('adulto_18');
insert into public.serate_gruppo (gruppo_id, titolo, data_serata, creata_da)
values (tests.gruppo('Ascolto'), 'Ascolto dal vivo',
        ((now() at time zone 'Europe/Rome') + interval '1 day')::date, tests.id('adulto_18'));
select tests.autentica_come('minore_17');
insert into public.partecipazioni_serata (serata_id, utente_id, risposta)
values (tests.serata('Ascolto dal vivo'), tests.id('minore_17'), 'si');
select tests.esci();

create function tests.argomento_serata() returns text language sql stable as $$
  select 'serata:' || tests.serata('Ascolto dal vivo')::text;
$$;
grant execute on function tests.argomento_serata() to authenticated;

-- Chi può ascoltare la serata: solo i suoi membri attivi.
select tests.autentica_come('adulto_18');
select ok(private.puo_ascoltare(tests.argomento_serata()), 'adulto_18 (admin) ascolta la serata');
select tests.autentica_come('minore_17');
select ok(private.puo_ascoltare(tests.argomento_serata()), 'minore_17 (membro) ascolta la serata');
select tests.autentica_come('minore_14');
select ok(not private.puo_ascoltare(tests.argomento_serata()), 'minore_14 non ascolta una serata altrui');
select tests.autentica_come('minore_15');
select ok(not private.puo_ascoltare(tests.argomento_serata()), 'minore_15 non ascolta una serata altrui');
select tests.autentica_come('minore_16');
select ok(not private.puo_ascoltare(tests.argomento_serata()), 'minore_16 non ascolta una serata altrui');
select tests.autentica_come('adulto_20');
select ok(not private.puo_ascoltare(tests.argomento_serata()), 'adulto_20 non ascolta una serata altrui');
select tests.autentica_come('adulto_21');
select ok(not private.puo_ascoltare(tests.argomento_serata()), 'adulto_21 non ascolta una serata altrui');
select tests.autentica_come('moderatore');
select ok(not private.puo_ascoltare(tests.argomento_serata()), 'Il moderatore non ascolta le serate (R-69)');

-- Canale dei gruppi: solo il proprio.
select tests.autentica_come('minore_14');
select ok(private.puo_ascoltare('gruppi:' || tests.id('minore_14')), 'minore_14 ascolta il proprio canale');
select ok(not private.puo_ascoltare('gruppi:' || tests.id('minore_17')), 'minore_14 non ascolta il canale di minore_17');
select tests.autentica_come('minore_15');
select ok(private.puo_ascoltare('gruppi:' || tests.id('minore_15')), 'minore_15 ascolta il proprio canale');
select ok(not private.puo_ascoltare('gruppi:' || tests.id('minore_16')), 'minore_15 non ascolta il canale di minore_16');
select tests.autentica_come('minore_16');
select ok(private.puo_ascoltare('gruppi:' || tests.id('minore_16')), 'minore_16 ascolta il proprio canale');
select ok(not private.puo_ascoltare('gruppi:' || tests.id('adulto_18')), 'minore_16 non ascolta il canale di adulto_18');
select tests.autentica_come('minore_17');
select ok(private.puo_ascoltare('gruppi:' || tests.id('minore_17')), 'minore_17 ascolta il proprio canale');
select tests.autentica_come('adulto_18');
select ok(private.puo_ascoltare('gruppi:' || tests.id('adulto_18')), 'adulto_18 ascolta il proprio canale');
select ok(not private.puo_ascoltare('gruppi:' || tests.id('minore_17')), 'adulto_18 non ascolta il canale di minore_17');
select tests.autentica_come('adulto_20');
select ok(not private.puo_ascoltare('gruppi:' || tests.id('minore_16')), 'adulto_20 non ascolta il canale di un minorenne');
select tests.autentica_come('adulto_21');
select ok(private.puo_ascoltare('gruppi:' || tests.id('adulto_21')), 'adulto_21 ascolta il proprio canale');
select tests.autentica_come('moderatore');
select ok(not private.puo_ascoltare('gruppi:' || tests.id('minore_17')), 'Il moderatore non ascolta i canali dei gruppi');

-- Argomenti non validi: nessun errore, nessun accesso.
select tests.autentica_come('adulto_18');
select ok(not private.puo_ascoltare('serata:non-un-uuid'), 'Un argomento non valido non dà accesso');
select ok(not private.puo_ascoltare('notifiche:' || tests.id('adulto_18')), 'Un altro canale non dà accesso');
select tests.esci();

-- Gli avvisi non contengono dati: realtime.send aggiunge solo un id casuale del messaggio.
select ok(
  exists (select 1 from realtime.messages m
          where m.topic = tests.argomento_serata() and m.private and m.payload - 'id' = '{}'::jsonb),
  'Una risposta invia un avviso vuoto sul canale privato della serata'
);
select ok(
  exists (select 1 from realtime.messages m
          where m.topic = 'gruppi:' || tests.id('minore_17') and m.private and m.payload - 'id' = '{}'::jsonb),
  'Un invito invia un avviso vuoto sul canale privato dell''invitato'
);

-- La policy di realtime.messages, come la usa Realtime all'ingresso nel canale.
select tests.autentica_come('minore_17');
select set_config('realtime.topic', tests.argomento_serata(), true);
select ok(
  exists (select 1 from realtime.messages m where m.topic = tests.argomento_serata()),
  'Un membro riceve gli avvisi della serata'
);
select tests.autentica_come('adulto_20');
select set_config('realtime.topic', tests.argomento_serata(), true);
select is_empty(
  $$ select 1 from realtime.messages m where m.topic = tests.argomento_serata() $$,
  'Chi non è nel gruppo non riceve gli avvisi della serata'
);
select tests.autentica_come('minore_16');
select set_config('realtime.topic', 'gruppi:' || tests.id('minore_17'), true);
select is_empty(
  $$ select 1 from realtime.messages m where m.topic = 'gruppi:' || tests.id('minore_17') $$,
  'Nessuno riceve gli avvisi dei gruppi di un altro'
);

-- Chi esce dal gruppo non ascolta più la serata.
select tests.autentica_come('minore_17');
delete from public.membri_gruppo
where gruppo_id = tests.gruppo('Ascolto') and utente_id = tests.id('minore_17');
select ok(not private.puo_ascoltare(tests.argomento_serata()), 'Chi esce dal gruppo non ascolta più la serata');
select tests.esci();

select is_empty(
  $$ select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and tablename in ('membri_gruppo', 'partecipazioni_serata', 'serate_gruppo') $$,
  'Nessuna tabella dei gruppi in Postgres Changes (la RLS non vale per i DELETE)'
);

select * from finish();
rollback;
