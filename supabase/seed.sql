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
