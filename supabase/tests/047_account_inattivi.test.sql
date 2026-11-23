-- Avviso ed eliminazione degli account senza accessi da 24 mesi (SAFETY_PRIVACY.md §10).
begin;
select plan(14);

-- Tre account del seed diventano inattivi da 25 mesi, senza sessioni.
update auth.users set created_at = now() - interval '30 months',
                      last_sign_in_at = now() - interval '25 months'
where id in (tests.id('adulto_20'), tests.id('minore_14'), tests.id('adulto_21'));
delete from auth.sessions
where user_id in (tests.id('adulto_20'), tests.id('minore_14'), tests.id('adulto_21'));

-- adulto_18 non rifà l'accesso da 25 mesi, ma la sua sessione si è rinnovata ieri.
update auth.users set created_at = now() - interval '30 months',
                      last_sign_in_at = now() - interval '25 months'
where id = tests.id('adulto_18');
insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at)
values (gen_random_uuid(), tests.id('adulto_18'), now() - interval '25 months',
        now() - interval '1 day', now() - interval '1 day');

select ok(
  private.ultimo_accesso(tests.id('adulto_18')) > now() - interval '2 days',
  'Il rinnovo della sessione conta come accesso'
);

-- Senza la configurazione dell'email nel Vault nessun avviso parte.
select private.gestisci_account_inattivi();
select is((select count(*)::int from private.avvisi_inattivita), 0,
          'Senza configurazione nel Vault nessun account è avvisato');

select vault.create_secret('chiave-di-prova', 'brevo_api_chiave');
select vault.create_secret('ciao@noxanight.it', 'email_mittente');
select vault.create_secret('https://noxanight.it', 'url_app');

create temporary table richieste_prima as select coalesce(max(id), 0) as n from net.http_request_queue;
select private.gestisci_account_inattivi();
select is(
  (select array_agg(utente_id order by utente_id) from private.avvisi_inattivita),
  (select array_agg(x order by x) from unnest(array[tests.id('adulto_20'), tests.id('minore_14'),
                                                    tests.id('adulto_21')]) x),
  'Gli account senza accessi da 24 mesi sono avvisati; chi rinnova la sessione no'
);
select is(
  (select count(*)::int from net.http_request_queue
   where id > (select n from richieste_prima) and url = 'https://api.brevo.com/v3/smtp/email'),
  3, 'Parte un''email per ogni account avvisato'
);
select is(
  (select jsonb_object_keys(convert_from(body, 'UTF8')::jsonb -> 'to' -> 0)
   from net.http_request_queue where id > (select n from richieste_prima) limit 1),
  'email',
  'L''email contiene solo l''indirizzo del destinatario, nessun altro dato dell''account'
);

-- Esito degli invii: Brevo accetta adulto_20 e adulto_21, rifiuta minore_14.
insert into net._http_response (id, status_code, content, created)
select a.richiesta_id,
       case when a.utente_id = tests.id('minore_14') then 401 else 201 end,
       '{}', now()
from private.avvisi_inattivita a;

select private.gestisci_account_inattivi();
select ok(
  (select confermato from private.avvisi_inattivita where utente_id = tests.id('adulto_20')),
  'Un avviso accettato da Brevo è confermato'
);
select ok(
  not exists (select 1 from private.avvisi_inattivita a
              where a.utente_id = tests.id('minore_14') and a.confermato),
  'Un avviso rifiutato da Brevo non è confermato e si riprova'
);

-- Passano 30 giorni; adulto_21 nel frattempo rientra.
update private.avvisi_inattivita set avvisato_il = now() - interval '31 days'
where utente_id in (tests.id('adulto_20'), tests.id('adulto_21'));
update auth.users set last_sign_in_at = now() - interval '2 days' where id = tests.id('adulto_21');

-- Un avviso non confermato non porta mai all'eliminazione.
insert into private.avvisi_inattivita (utente_id, avvisato_il, richiesta_id, confermato)
values (tests.id('adulto_18'), now() - interval '40 days', null, false)
on conflict (utente_id) do update set avvisato_il = excluded.avvisato_il, confermato = false;

select private.gestisci_account_inattivi();
select ok(not exists (select 1 from auth.users where id = tests.id('adulto_20')),
          'Dopo 30 giorni dall''avviso senza accessi l''account è eliminato');
select ok(not exists (select 1 from public.profili where id = tests.id('adulto_20')),
          'Con l''account si eliminano i suoi dati');
select ok(exists (select 1 from auth.users where id = tests.id('adulto_21')),
          'Chi rientra dopo l''avviso non viene eliminato');
select ok(not exists (select 1 from private.avvisi_inattivita where utente_id = tests.id('adulto_21')),
          'Chi rientra dopo l''avviso non ha più un avviso');
select ok(exists (select 1 from auth.users where id = tests.id('adulto_18')),
          'Un account con un avviso non confermato non viene eliminato');

-- Nessun accesso dal client.
select tests.autentica_come('minore_16');
select throws_ok($$ select private.gestisci_account_inattivi() $$, '42501', null,
                 'Un utente non avvia il job degli account inattivi');
select throws_ok($$ select * from private.avvisi_inattivita $$, '42501', null,
                 'Un utente non legge gli avvisi di inattività');
select tests.esci();

select * from finish();
rollback;
