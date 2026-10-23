-- Segnalazione del nome dei gruppi e dei testi delle serate di gruppo, decisione motivata,
-- notifica a chi li ha scritti e reclamo (DATA_MODEL.md §5.4, §5.10; SAFETY_PRIVACY.md §11).
-- Regole: R-16, R-50, R-52, R-53, R-55, R-69. Amici del seed: 15-16, 20-21, 18-17.
begin;
select plan(21);

create function tests.s(tipo text, segnalante text) returns uuid language sql stable as $$
  select x.id from public.segnalazioni x
  where x.tipo_oggetto::text = $1 and x.segnalante_id = tests.id($2)
  order by x.creata_il desc limit 1;
$$;
grant execute on function tests.s(text, text) to authenticated;

-- «Calcetto» (adulto_18 admin, minore_17) con una serata libera di adulto_18; «Grandi»
-- (adulto_20, adulto_21) senza minorenni.
select tests.autentica_come('adulto_18');
select public.crea_gruppo('Calcetto', array[tests.id('minore_17')]);
insert into public.serate_gruppo (gruppo_id, titolo, data_serata, luogo_ritrovo, note, creata_da)
values (tests.gruppo('Calcetto'), 'Partita e poi pizza', current_date + 1, 'Campo comunale',
        'Testo da controllare', tests.id('adulto_18'));
select tests.autentica_come('minore_17');
update public.membri_gruppo set stato = 'attivo'
where gruppo_id = tests.gruppo('Calcetto') and utente_id = tests.id('minore_17');
select tests.autentica_come('adulto_20');
select public.crea_gruppo('Grandi', array[tests.id('adulto_21')]);

-- ---------------------------------------------------------------------------------------------
-- Chi può segnalare (R-50)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_17');
select lives_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
     values (tests.id('minore_17'), 'gruppo', tests.gruppo('Calcetto'), 'contenuto_inappropriato') $$,
  'R-50: un membro segnala il nome del gruppo'
);
select lives_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo, dettagli)
     values (tests.id('minore_17'), 'serata_gruppo', tests.serata('Partita e poi pizza'), 'molestie', 'Le note') $$,
  'R-50: un membro segnala titolo o note della serata'
);
select tests.autentica_come('adulto_18');
select lives_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
     values (tests.id('adulto_18'), 'gruppo', tests.gruppo('Calcetto'), 'spam') $$,
  'R-50: anche l''admin segnala il nome del proprio gruppo'
);
select tests.autentica_come('adulto_21');
select lives_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
     values (tests.id('adulto_21'), 'gruppo', tests.gruppo('Grandi'), 'spam') $$,
  'R-50: anche chi è solo invitato segnala il nome del gruppo'
);
select throws_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
     values (tests.id('adulto_21'), 'gruppo', tests.gruppo('Calcetto'), 'spam') $$,
  '42501', null, 'Chi non è nel gruppo non lo segnala'
);
select throws_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
     values (tests.id('adulto_21'), 'serata_gruppo', tests.serata('Partita e poi pizza'), 'spam') $$,
  '42501', null, 'Chi non vede la serata non la segnala'
);
select tests.esci();
select results_eq(
  $$ select tipo_oggetto::text, priorita from public.segnalazioni
     where segnalante_id in (tests.id('minore_17'), tests.id('adulto_18'), tests.id('adulto_21'))
     order by tipo_oggetto, priorita $$,
  $$ values ('gruppo', 2::smallint), ('gruppo', 2::smallint), ('gruppo', 3::smallint),
            ('serata_gruppo', 2::smallint) $$,
  'R-53: priorità 2 per gruppi e serate con minorenni, 3 per quelli di soli adulti'
);

-- ---------------------------------------------------------------------------------------------
-- Dettaglio e decisione (R-69, DSA art. 17)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('moderatore');
select results_eq(
  $$ select oggetto ->> 'nome', oggetto ->> 'autore', (oggetto ->> 'membri')::integer
     from public.dettaglio_segnalazione(tests.s('gruppo', 'minore_17')) $$,
  $$ values ('Calcetto', '@adulto_18', 2) $$,
  'R-69: il moderatore vede il nome segnalato, chi l''ha scritto e il numero dei membri'
);
select results_eq(
  $$ select oggetto ->> 'note', oggetto ->> 'gruppo_nome'
     from public.dettaglio_segnalazione(tests.s('serata_gruppo', 'minore_17')) $$,
  $$ values ('Testo da controllare', 'Calcetto') $$,
  'Il moderatore vede i testi segnalati della serata'
);
select throws_ok(
  $$ select public.decidi_segnalazione(tests.s('gruppo', 'minore_17'), 'rimuovi_contenuto', 'Nome offensivo', 'foto') $$,
  '22023', null, 'Di un gruppo si rimuove solo il nome'
);
select throws_ok(
  $$ select public.decidi_segnalazione(tests.s('gruppo', 'minore_17'), 'sospendi_account', 'No') $$,
  '22023', null, 'Una segnalazione di gruppo non sospende direttamente un account'
);
select lives_ok(
  $$ select public.decidi_segnalazione(tests.s('gruppo', 'minore_17'), 'rimuovi_contenuto', 'Nome offensivo', 'nome') $$,
  'Il moderatore rimuove il nome del gruppo'
);
select tests.esci();
select results_eq(
  $$ select nome, nome_scritto_da from public.gruppi where id = (select oggetto_id from public.segnalazioni
                                                                    where id = tests.s('gruppo', 'minore_17')) $$,
  $$ values ('Gruppo', tests.id('adulto_18')) $$,
  'Il nome diventa generico; l''autore resta registrato per la decisione e il reclamo'
);
select tests.autentica_come('adulto_18');
select isnt_empty(
  $$ select 1 from public.notifiche where tipo = 'esito_moderazione'
       and dati @> '{"esito": "contenuto_rimosso", "tipo_oggetto": "gruppo", "contenuto": "nome"}' $$,
  'R-52: chi ha scritto il nome riceve la decisione motivata'
);
select tests.esci();
select ok(
  private.reclamabile((select a.id from public.azioni_moderazione a
                       where a.segnalazione_id = tests.s('gruppo', 'minore_17') and a.azione = 'rimuovi_contenuto'),
                      tests.id('adulto_18')),
  'DSA art. 20: chi ha scritto il nome può presentare reclamo'
);
select tests.autentica_come('minore_17');
select isnt_empty(
  $$ select 1 from public.mie_segnalazioni() where tipo_oggetto = 'gruppo' and stato = 'chiusa'
       and decisione like 'Nome offensivo%' $$,
  'Chi ha segnalato vede la decisione'
);

-- La serata viene annullata prima della decisione: i testi si rimuovono lo stesso.
select tests.autentica_come('adulto_18');
update public.serate_gruppo set stato = 'annullata' where id = tests.serata('Partita e poi pizza');
select tests.autentica_come('moderatore');
select throws_ok(
  $$ select public.decidi_segnalazione(tests.s('serata_gruppo', 'minore_17'), 'rimuovi_contenuto', 'Testo', 'nome') $$,
  '22023', null, 'Di una serata si rimuovono titolo, luogo o note'
);
select lives_ok(
  $$ select public.decidi_segnalazione(tests.s('serata_gruppo', 'minore_17'), 'rimuovi_contenuto', 'Note offensive', 'note') $$,
  'Il moderatore rimuove le note anche da una serata annullata'
);
select tests.esci();
select results_eq(
  $$ select titolo, luogo_ritrovo, note, testi_scritti_da from public.serate_gruppo
     where id = tests.serata('Partita e poi pizza') $$,
  $$ values ('Partita e poi pizza', 'Campo comunale', null::text, tests.id('adulto_18')) $$,
  'Restano gli altri testi e l''autore'
);
select isnt_empty(
  $$ select 1 from public.notifiche where utente_id = tests.id('adulto_18') and tipo = 'esito_moderazione'
       and dati @> '{"esito": "contenuto_rimosso", "tipo_oggetto": "serata_gruppo", "contenuto": "note"}' $$,
  'R-52: chi ha scritto le note riceve la decisione'
);
select is_empty(
  $$ select 1 from public.notifiche where tipo = 'aggiornamento_serata' and utente_id = tests.id('minore_17')
       and dati @> jsonb_build_object('serata_id', tests.serata('Partita e poi pizza'), 'cambio', 'modificata') $$,
  'La rimozione dei testi da parte di un moderatore non manda notifiche ai membri'
);

select * from finish();
rollback;
