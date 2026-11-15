-- Migrazione: servizi per tornare a casa senza un passaggio (F-23, ADR-0034)
-- Documentazione: docs/DATA_MODEL.md §5.5; regole: R-04, R-07, R-32, R-43, R-61, R-62
--
-- Elenco curato di mezzi pubblici notturni, radiotaxi e app di trasporto, con la fonte
-- ufficiale e la data dell'ultima verifica di ogni voce. Non contiene dati personali. Le righe
-- si cambiano solo con una migrazione: l'app le legge e basta. Ogni utente vede le voci la cui
-- età minima è compatibile con la sua età, calcolata nel database (R-04): le app di trasporto
-- che richiedono 18 anni non compaiono ai minorenni.

create type public.tipo_servizio_trasporto as enum ('mezzi_pubblici', 'taxi', 'app_trasporto');

create table public.servizi_trasporto (
  id            uuid primary key default gen_random_uuid(),
  tipo          public.tipo_servizio_trasporto not null,
  nome          text not null,
  zona          text not null,
  telefono      text,
  url           text,
  nota          text,
  eta_minima    smallint not null default 14,
  ordine        smallint not null default 100,
  fonte_url     text not null,
  verificato_il date not null,
  attivo        boolean not null default true,
  creato_il     timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  constraint servizi_trasporto_nome check (char_length(nome) between 2 and 60),
  constraint servizi_trasporto_zona check (zona in ('milano', 'brianza', 'tutte')),
  constraint servizi_trasporto_telefono check (telefono is null or telefono ~ '^\+39[0-9]{6,11}$'),
  constraint servizi_trasporto_url check (url is null or url ~ '^https://'),
  constraint servizi_trasporto_fonte check (fonte_url ~ '^https://'),
  constraint servizi_trasporto_nota check (nota is null or char_length(nota) <= 140),
  constraint servizi_trasporto_eta check (eta_minima between 14 and 18),
  constraint servizi_trasporto_contatto check (telefono is not null or url is not null),
  -- Un'app di trasporto si apre con un link; un taxi si chiama.
  constraint servizi_trasporto_forma check (
    (tipo = 'taxi' and telefono is not null)
    or (tipo <> 'taxi' and url is not null and telefono is null)
  ),
  constraint servizi_trasporto_unico unique (nome, zona)
);
comment on table public.servizi_trasporto is
  'Mezzi notturni, radiotaxi e app di trasporto per tornare senza un passaggio (F-23). Solo lettura per l''app; età minima applicata dalla policy (R-04).';

create index servizi_trasporto_ordine_idx on public.servizi_trasporto (ordine);

alter table public.servizi_trasporto enable row level security;
revoke all on public.servizi_trasporto from anon, authenticated;
grant select on public.servizi_trasporto to authenticated;

-- R-04, R-07: solo utenti con account, e solo le voci adatte alla loro età.
create policy "servizi_trasporto: ognuno vede le voci adatte alla sua età"
  on public.servizi_trasporto for select to authenticated
  using (
    attivo
    and (select private.eta_di((select auth.uid()))) >= eta_minima
  );

create trigger servizi_trasporto_aggiornato_il
  before update on public.servizi_trasporto
  for each row execute function private.imposta_aggiornato_il();

-- Voci iniziali, verificate il 2026-11-15 sulle fonti indicate. Ordine fisso e neutro: prima i
-- mezzi pubblici, poi i taxi, poi le app (R-61: nessun accordo commerciale).
insert into public.servizi_trasporto
  (tipo, nome, zona, telefono, url, nota, eta_minima, ordine, fonte_url, verificato_il)
values
  ('mezzi_pubblici', 'Rete notturna ATM', 'milano', null,
   'https://www.atm.it/EN/ALTRISERVIZI/TRASPORTO/Pages/rete_notturna.aspx',
   'Bus notturni di Milano, anche al posto della metropolitana.', 14, 10,
   'https://www.atm.it/EN/ALTRISERVIZI/TRASPORTO/Pages/rete_notturna.aspx', date '2026-11-15'),
  ('taxi', 'Radiotaxi 02 4040', 'milano', '+39024040', null,
   'Taxi a Milano, a ogni ora.', 14, 20,
   'https://milanolinate-airport.com/en/from-to/by-taxi', date '2026-11-15'),
  ('taxi', 'Radiotaxi 02 8585', 'milano', '+39028585', null,
   'Taxi a Milano, a ogni ora.', 14, 30,
   'https://milanolinate-airport.com/en/from-to/by-taxi', date '2026-11-15'),
  ('taxi', 'Radiotaxi Monza', 'brianza', '+3903936379', null,
   'Di notte, se i taxi di Monza sono occupati, la chiamata passa a un radiotaxi di Milano.',
   14, 40, 'https://turismo.monza.it/en/how-move-25122', date '2026-11-15'),
  ('app_trasporto', 'Uber', 'tutte', null,
   'https://m.uber.com/ul/?action=setPickup&pickup=my_location',
   'Si apre Uber: la partenza è dove sei, la destinazione la scrivi tu lì.', 18, 50,
   'https://www.uber.com/legal/terms/it', date '2026-11-15');
