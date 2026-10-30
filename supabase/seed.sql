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
        'consensi', jsonb_build_object('termini', '2026-10', 'privacy', '2026-11')
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
  -- Prossimo venerdì (oggi, se è venerdì): così anche il weekend ha eventi di esempio.
  v date := d + ((5 - extract(isodow from d)::int + 7) % 7);
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
     (v + 1 + time '21:00') at time zone ora, (v + 2 + time '01:00') at time zone ora,
     16, true, false, array['I Fili Scoperti', 'Mare di Brughiera', 'Lanterna'], 800, null,
     'annullato'),
    ('00000000-0000-4000-8000-00000000e007', '00000000-0000-4000-8000-00000000c004',
     'Ventuno Club', null,
     (v + 1 + time '23:30') at time zone ora, (v + 2 + time '05:00') at time zone ora,
     21, true, false, array['Corrado B.'], 2000, null, 'pubblicato'),
    ('00000000-0000-4000-8000-00000000e008', '00000000-0000-4000-8000-00000000c005',
     'Elettronica al Magazzino', null,
     (d + time '20:00') at time zone ora, (d + 1 + time '02:00') at time zone ora,
     18, true, true, array['Otto Fili'], 1000, null, 'pubblicato'),
    ('00000000-0000-4000-8000-00000000e009', '00000000-0000-4000-8000-00000000c004',
     'Anni Zero', null,
     (v + time '22:00') at time zone ora, (v + 1 + time '03:00') at time zone ora,
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
     (v + 2 + time '16:00') at time zone ora, (v + 2 + time '20:00') at time zone ora,
     14, true, false, array['Lanterna'], 500, null, 'pubblicato');

  -- Serate già passate, per il diario (iterazione 8): una 16+, una 18+ con riferimenti
  -- all'alcol (mai visibile ai minorenni, R-23) e una 21+.
  insert into public.eventi
    (id, locale_id, titolo, descrizione, inizio, fine, eta_minima, eta_minima_dichiarata,
     riferimenti_alcol, artisti, prezzo_min_centesimi, url_biglietti, stato)
  values
    ('00000000-0000-4000-8000-00000000e101', '00000000-0000-4000-8000-00000000c001',
     'Indie al Binario · ottobre', 'Tre band della zona sul palco piccolo.',
     (d - 10 + time '22:00') at time zone ora, (d - 9 + time '02:00') at time zone ora,
     16, true, false, array['I Fili Scoperti', 'Lanterna'], 1200, null, 'pubblicato'),
    ('00000000-0000-4000-8000-00000000e102', '00000000-0000-4000-8000-00000000c005',
     'Open Bar al Magazzino', null,
     (d - 12 + time '23:00') at time zone ora, (d - 11 + time '04:00') at time zone ora,
     18, true, true, array['Otto Fili'], 1500, null, 'pubblicato'),
    ('00000000-0000-4000-8000-00000000e103', '00000000-0000-4000-8000-00000000c004',
     'Ventuno Club · ottobre', null,
     (d - 8 + time '23:30') at time zone ora, (d - 7 + time '05:00') at time zone ora,
     21, true, false, array['Corrado B.'], 2000, null, 'pubblicato');
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

-- Area di moderazione (iterazione 5): fonti in tutti gli stati, esecuzioni, un possibile
-- duplicato e candidati da verificare. Nessuna fonte è attiva: in locale pg_cron non accoda
-- letture verso i siti di esempio.
insert into public.fonti
  (id, locale_id, tipo, url, adattatore, frequenza_minuti, pagine_massime, stato_conformita,
   robots_esito, termini_url, termini_letti_il, note_conformita, attiva, ultima_esecuzione_il,
   ultimo_esito, errori_consecutivi, ultimo_errore, disattivata_automaticamente_il)
values
  ('00000000-0000-4000-8000-00000000f101', '00000000-0000-4000-8000-00000000c001', 'sito_locale',
   'https://binario7.example/eventi', 'sito_jsonld', 360, 3, 'consentita', 'consentito',
   'https://binario7.example/termini', current_date - 17,
   'robots.txt: /eventi consentito per * e NoxaBot. Termini senza divieti di raccolta.', false,
   now() - interval '6 hours',
   '{"prova": false, "pagine_lette": 3, "eventi_letti": 12, "eventi_nuovi": 1, "eventi_uniti": 3, "eventi_in_revisione": 1, "eventi_scartati": 0, "codice_errore": null}',
   0, null, null),
  ('00000000-0000-4000-8000-00000000f102', '00000000-0000-4000-8000-00000000c002', 'instagram',
   'officinalambro', 'instagram_business_discovery', 720, 1, 'consentita', 'non_applicabile',
   'https://developers.facebook.com/terms', current_date - 17, 'API ufficiale Business Discovery.',
   false, now() - interval '1 day',
   '{"prova": false, "pagine_lette": 1, "eventi_letti": 0, "eventi_nuovi": 0, "eventi_uniti": 0, "codice_errore": "HTTP_503"}',
   5, 'HTTP_503: il sito ha risposto HTTP 503', now() - interval '1 day'),
  ('00000000-0000-4000-8000-00000000f103', '00000000-0000-4000-8000-00000000c004', 'sito_locale',
   'https://salaventuno.example/calendario', 'sito_jsonld', 360, 3, 'da_verificare', null, null,
   null, null, false, null, null, 0, null, null),
  ('00000000-0000-4000-8000-00000000f104', '00000000-0000-4000-8000-00000000c004',
   'resident_advisor', 'https://eventivunque.example/club/sala-ventuno', null, 360, 3, 'vietata',
   null, null, null, 'Aggregatore senza accordo (D-05).', false, null, null, 0, null, null);

update public.eventi_fonti set fonte_id = '00000000-0000-4000-8000-00000000f101'
where evento_id in ('00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000e004');

insert into public.esecuzioni_fonte
  (fonte_id, prova, iniziata_il, durata_ms, pagine_lette, eventi_letti, eventi_nuovi, eventi_uniti,
   eventi_in_revisione, codice_errore, messaggio_errore)
values
  ('00000000-0000-4000-8000-00000000f101', false, now() - interval '6 hours', 7900, 3, 12, 1, 3, 1, null, null),
  ('00000000-0000-4000-8000-00000000f101', false, now() - interval '12 hours', 8100, 3, 11, 0, 2, 0, null, null),
  ('00000000-0000-4000-8000-00000000f101', false, now() - interval '18 hours', 30000, 1, 0, 0, 0, 0, 'TIMEOUT', 'timeout su binario7.example'),
  ('00000000-0000-4000-8000-00000000f102', false, now() - interval '1 day', 1200, 1, 0, 0, 0, 0, 'HTTP_503', 'il sito ha risposto HTTP 503');

-- Possibile duplicato di "Notte Ferrovia" raccolto da Instagram, con titolo e orario diversi.
insert into public.eventi_grezzi
  (id, fonte_id, payload, hash_contenuto, stato, evento_candidato_id, punteggio_dedup, nota_revisione)
select '00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-00000000f102',
       jsonb_build_object(
         'versione_schema', 1,
         'origine', jsonb_build_object(
           'tipo', 'instagram', 'fonte_id', '00000000-0000-4000-8000-00000000f102',
           'caricamento_flyer_id', null, 'url', 'https://www.instagram.com/p/ESEMPIO01/',
           'id_esterno', 'esempio-01', 'raccolto_il', now()),
         'locale', jsonb_build_object('id', e.locale_id, 'nome', 'Club Binario 7', 'comune', 'Monza',
                                      'indirizzo', null),
         'titolo', 'NOTTE FERROVIA – techno all night',
         'descrizione', null,
         'inizio', e.inizio + interval '30 minutes',
         'fine', e.fine,
         'eta_minima', 18,
         'riferimenti_alcol', true,
         'generi', jsonb_build_array('techno', 'elettronica'),
         'artisti', jsonb_build_array('Nera Vale', 'Corrado B.'),
         'prezzo_min_centesimi', 1500,
         'url_biglietti', null,
         'estrazione', null),
       repeat('9', 64), 'in_revisione_dedup', e.id, 82,
       'Stesso locale, orario a 30 minuti, 2 artisti in comune, titolo simile'
from public.eventi e
where e.id = '00000000-0000-4000-8000-00000000e001';

insert into public.candidati_locali
  (id, origine, osm_id, nome, indirizzo, comune, provincia, posizione, sito_web, possibile_doppione_id)
values
  ('00000000-0000-4000-8000-0000000000b1', 'osm', 'node/9000000001', 'Club Binario Sette',
   'Via dei Cantieri 12', 'Monza', 'MB', 'SRID=4326;POINT(9.2745 45.5846)', null,
   '00000000-0000-4000-8000-00000000c001'),
  ('00000000-0000-4000-8000-0000000000b2', 'osm', 'way/9000000002', 'Corte delle Rose',
   'Via Giardini 4', 'Lissone', 'MB', 'SRID=4326;POINT(9.2430 45.6130)',
   'https://cortedellerose.example', null);
insert into public.candidati_locali (id, origine, google_place_id)
values ('00000000-0000-4000-8000-0000000000b3', 'google', 'ChIJ-esempio-noxa');
