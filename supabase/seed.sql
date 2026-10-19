-- Dati solo per lo sviluppo locale: `supabase db reset` applica le migrazioni e poi questo
-- file. Non viene mai eseguito in staging o produzione.

-- Password locale del ruolo del worker, la stessa di WORKER_DB_PASSWORD_LOCALE in
-- .env.example (DATA_MODEL.md §1).
alter role noxa_worker with password 'sviluppo-locale';

-- Utenti di test per età (DATA_MODEL.md §9). La data di nascita è calcolata da oggi, così
-- l'età resta quella del nome a ogni `supabase db reset`: compleanno 40 giorni fa.
-- Ognuno accede in locale con <username>@example.com e la password `password-di-prova`.
-- Il trigger private.gestisci_nuovo_utente crea profilo, dati privati e consensi.
do $$
declare
  utente record;
  oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  for utente in
    select *
    from (values
      ('00000000-0000-4000-8000-000000000014'::uuid, 'minore_14', 'Minore 14', 14),
      ('00000000-0000-4000-8000-000000000015'::uuid, 'minore_15', 'Minore 15', 15),
      ('00000000-0000-4000-8000-000000000016'::uuid, 'minore_16', 'Minore 16', 16),
      ('00000000-0000-4000-8000-000000000017'::uuid, 'minore_17', 'Minore 17', 17),
      ('00000000-0000-4000-8000-000000000018'::uuid, 'adulto_18', 'Adulto 18', 18),
      ('00000000-0000-4000-8000-000000000020'::uuid, 'adulto_20', 'Adulto 20', 20),
      ('00000000-0000-4000-8000-000000000021'::uuid, 'adulto_21', 'Adulto 21', 21),
      ('00000000-0000-4000-8000-000000000090'::uuid, 'moderatore', 'Moderatore', 30),
      ('00000000-0000-4000-8000-000000000091'::uuid, 'moderatore_senza_mfa', 'Moderatore senza MFA', 30)
    ) as u (id, username, nome, eta)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', utente.id, 'authenticated', 'authenticated',
      utente.username || '@example.com',
      extensions.crypt('password-di-prova', extensions.gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object(
        'username', utente.username,
        'nome_visualizzato', utente.nome,
        'data_nascita', (oggi - make_interval(years => utente.eta) - interval '40 days')::date,
        'consensi', jsonb_build_object('termini', '2026-10', 'privacy', '2026-10')
      ),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), utente.id, utente.id::text, 'email',
      jsonb_build_object('sub', utente.id::text, 'email', utente.username || '@example.com',
                         'email_verified', true),
      now(), now(), now()
    );
  end loop;

  -- L'onboarding di sicurezza risulta già visto, così l'app si apre subito sulle aree.
  update public.profili_privati set onboarding_completato_il = now();

  insert into public.ruoli_utente (utente_id, ruolo)
  values ('00000000-0000-4000-8000-000000000090', 'moderatore'),
         ('00000000-0000-4000-8000-000000000091', 'moderatore');
end
$$;

-- Relazioni di esempio (iterazione 3): amici nella stessa fascia, un'amicizia tra fasce
-- diverse nata da un codice invito (R-12) e una richiesta in attesa.
insert into public.amicizie (richiedente_id, destinatario_id, canale, stato, accettata_il)
values
  ('00000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000016', 'ricerca', 'accettata', now()),
  ('00000000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-000000000021', 'ricerca', 'accettata', now()),
  ('00000000-0000-4000-8000-000000000018', '00000000-0000-4000-8000-000000000017', 'codice_invito', 'accettata', now()),
  ('00000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000015', 'ricerca', 'in_attesa', null);

-- Catalogo di esempio (iterazione 4): locali e artisti di fantasia, siti nel dominio riservato
-- .example. Le date partono dalla serata in corso, così l'elenco di Scopri non è mai vuoto
-- dopo un `supabase db reset`. Nessuna foto: le copertine usano il fondo tipografico finché un
-- moderatore non carica una foto autorizzata (ADR-0018).
insert into public.locali
  (id, nome, nome_normalizzato, indirizzo, comune, provincia, posizione, sito_web,
   instagram_username, attivo)
values
  ('00000000-0000-4000-8000-00000000c001', 'Club Binario 7', 'club binario 7',
   'Via dei Cantieri 12', 'Monza', 'MB', 'SRID=4326;POINT(9.2744 45.5845)',
   'https://binario7.example', null, true),
  ('00000000-0000-4000-8000-00000000c002', 'Officina Lambro', 'officina lambro',
   'Via del Lavatoio 3', 'Monza', 'MB', 'SRID=4326;POINT(9.2800 45.5780)',
   null, 'officinalambro', true),
  ('00000000-0000-4000-8000-00000000c003', 'Cascina Torretta', 'cascina torretta',
   'Strada della Torretta 8', 'Vimercate', 'MB', 'SRID=4326;POINT(9.3690 45.6150)',
   'https://cascinatorretta.example', null, true),
  ('00000000-0000-4000-8000-00000000c004', 'Sala Ventuno', 'sala ventuno',
   'Via Ventuno 21', 'Desio', 'MB', 'SRID=4326;POINT(9.2070 45.6180)',
   'https://salaventuno.example', null, true),
  ('00000000-0000-4000-8000-00000000c005', 'Magazzino Nove', 'magazzino nove',
   'Via dei Magazzini 9', 'Milano', 'MI', 'SRID=4326;POINT(9.2050 45.4840)',
   'https://magazzinonove.example', null, true),
  ('00000000-0000-4000-8000-00000000c006', 'Spazio Navile', 'spazio navile',
   'Alzaia Navile 4', 'Milano', 'MI', 'SRID=4326;POINT(9.1700 45.4520)',
   'https://spazionavile.example', null, false);

do $$
declare
  -- Serata in corso: fino alle 06:00 vale ancora quella del giorno prima (DATA_MODEL.md §5.3).
  d date := ((now() at time zone 'Europe/Rome') - interval '6 hours')::date;
  ora constant text := 'Europe/Rome';
begin
  insert into public.eventi
    (id, locale_id, titolo, descrizione, inizio, fine, eta_minima, eta_minima_dichiarata,
     riferimenti_alcol, artisti, prezzo_min_centesimi, url_biglietti, stato)
  values
    ('00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000c001',
     'Notte Ferrovia', 'Techno e house fino all''alba nella sala grande.',
     (d + time '23:00') at time zone ora, (d + 1 + time '05:00') at time zone ora,
     18, true, false, array['Nera Vale', 'Corrado B.', 'Otto Fili'], 1500,
     'https://binario7.example/biglietti/notte-ferrovia', 'pubblicato'),
    ('00000000-0000-4000-8000-00000000e002', '00000000-0000-4000-8000-00000000c002',
     'Open Decks', 'Consolle aperta, iscrizioni sul posto.',
     (d + time '21:30') at time zone ora, (d + 1 + time '00:30') at time zone ora,
     14, true, false, '{}', 0, null, 'pubblicato'),
    ('00000000-0000-4000-8000-00000000e003', '00000000-0000-4000-8000-00000000c002',
     'Bassi Lunghi', null,
     (d + time '22:30') at time zone ora, (d + 1 + time '04:00') at time zone ora,
     18, false, false, array['Selva Mc', 'Duo Brina'], null, null, 'pubblicato'),
    ('00000000-0000-4000-8000-00000000e004', '00000000-0000-4000-8000-00000000c001',
     'Indie al Binario', 'Tre band della zona sul palco piccolo.',
     (d + 1 + time '21:30') at time zone ora, (d + 2 + time '02:00') at time zone ora,
     16, true, false, array['I Fili Scoperti', 'Mare di Brughiera'], 1200,
     'https://binario7.example/biglietti/indie', 'pubblicato'),
    ('00000000-0000-4000-8000-00000000e005', '00000000-0000-4000-8000-00000000c004',
     'Reggaeton Night', null,
     (d + 1 + time '23:00') at time zone ora, (d + 2 + time '04:00') at time zone ora,
     18, true, false, '{}', 1500, null, 'pubblicato'),
    ('00000000-0000-4000-8000-00000000e006', '00000000-0000-4000-8000-00000000c003',
     'Cortile Live', null,
     (d + 2 + time '21:00') at time zone ora, (d + 3 + time '01:00') at time zone ora,
     16, true, false, array['I Fili Scoperti', 'Mare di Brughiera', 'Lanterna'], 800, null,
     'annullato'),
    ('00000000-0000-4000-8000-00000000e007', '00000000-0000-4000-8000-00000000c004',
     'Ventuno Club', null,
     (d + 2 + time '23:30') at time zone ora, (d + 3 + time '05:00') at time zone ora,
     21, true, false, array['Corrado B.'], 2000, null, 'pubblicato'),
    ('00000000-0000-4000-8000-00000000e008', '00000000-0000-4000-8000-00000000c005',
     'Elettronica al Magazzino', null,
     (d + time '20:00') at time zone ora, (d + 1 + time '02:00') at time zone ora,
     18, true, true, array['Otto Fili'], 1000, null, 'pubblicato'),
    ('00000000-0000-4000-8000-00000000e009', '00000000-0000-4000-8000-00000000c004',
     'Anni Zero', null,
     (d + 3 + time '22:00') at time zone ora, (d + 4 + time '03:00') at time zone ora,
     16, true, false, '{}', 1000, null, 'pubblicato'),
    ('00000000-0000-4000-8000-00000000e010', '00000000-0000-4000-8000-00000000c005',
     'Sotto Cassa', null,
     (d + 1 + time '23:00') at time zone ora, (d + 2 + time '04:00') at time zone ora,
     18, true, false, '{}', null, null, 'in_revisione'),
    ('00000000-0000-4000-8000-00000000e011', '00000000-0000-4000-8000-00000000c006',
     'Chiusura Navile', null,
     (d + 1 + time '21:00') at time zone ora, (d + 2 + time '01:00') at time zone ora,
     14, true, false, '{}', 0, null, 'pubblicato'),
    ('00000000-0000-4000-8000-00000000e012', '00000000-0000-4000-8000-00000000c003',
     'Pomeriggio in Cascina', 'Musica dal vivo in cortile, pomeriggio.',
     (d + 3 + time '16:00') at time zone ora, (d + 3 + time '20:00') at time zone ora,
     14, true, false, array['Lanterna'], 500, null, 'pubblicato');
end
$$;

insert into public.eventi_generi (evento_id, genere_codice)
values
  ('00000000-0000-4000-8000-00000000e001', 'techno'),
  ('00000000-0000-4000-8000-00000000e001', 'house'),
  ('00000000-0000-4000-8000-00000000e002', 'house'),
  ('00000000-0000-4000-8000-00000000e003', 'hip_hop'),
  ('00000000-0000-4000-8000-00000000e003', 'reggaeton'),
  ('00000000-0000-4000-8000-00000000e004', 'indie'),
  ('00000000-0000-4000-8000-00000000e004', 'live'),
  ('00000000-0000-4000-8000-00000000e005', 'reggaeton'),
  ('00000000-0000-4000-8000-00000000e005', 'commerciale'),
  ('00000000-0000-4000-8000-00000000e006', 'indie'),
  ('00000000-0000-4000-8000-00000000e006', 'live'),
  ('00000000-0000-4000-8000-00000000e007', 'techno'),
  ('00000000-0000-4000-8000-00000000e008', 'elettronica'),
  ('00000000-0000-4000-8000-00000000e009', 'commerciale'),
  ('00000000-0000-4000-8000-00000000e011', 'house'),
  ('00000000-0000-4000-8000-00000000e012', 'live');

insert into public.eventi_fonti (evento_id, tipo_origine, url_originale)
values
  ('00000000-0000-4000-8000-00000000e001', 'sito_locale', 'https://binario7.example/eventi/notte-ferrovia'),
  ('00000000-0000-4000-8000-00000000e002', 'instagram', 'https://www.instagram.com/officinalambro/'),
  ('00000000-0000-4000-8000-00000000e003', 'instagram', 'https://www.instagram.com/officinalambro/'),
  ('00000000-0000-4000-8000-00000000e004', 'sito_locale', 'https://binario7.example/eventi/indie'),
  ('00000000-0000-4000-8000-00000000e005', 'sito_locale', 'https://salaventuno.example/eventi'),
  ('00000000-0000-4000-8000-00000000e006', 'sito_locale', 'https://cascinatorretta.example/eventi'),
  ('00000000-0000-4000-8000-00000000e007', 'sito_locale', 'https://salaventuno.example/eventi'),
  ('00000000-0000-4000-8000-00000000e008', 'sito_locale', 'https://magazzinonove.example/eventi'),
  ('00000000-0000-4000-8000-00000000e009', 'sito_locale', 'https://salaventuno.example/eventi'),
  ('00000000-0000-4000-8000-00000000e012', 'sito_locale', 'https://cascinatorretta.example/eventi');

-- Partecipazioni di esempio (R-67): visibili o no agli amici, anche verso un evento che
-- l'amico più giovane non può vedere.
insert into public.partecipazioni_evento (utente_id, evento_id, stato, visibile_agli_amici)
values
  ('00000000-0000-4000-8000-000000000016', '00000000-0000-4000-8000-00000000e002', 'partecipo', true),
  ('00000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-00000000e002', 'interessato', false),
  ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-00000000e001', 'partecipo', true),
  ('00000000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-00000000e004', 'interessato', true),
  ('00000000-0000-4000-8000-000000000018', '00000000-0000-4000-8000-00000000e001', 'partecipo', true);
