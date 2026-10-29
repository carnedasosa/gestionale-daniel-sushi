-- Coperti del tavolo e impostazioni della cassa.
-- Il prezzo del coperto si fissa sulla sessione quando si imposta il numero: cambiarlo in admin non tocca i tavoli aperti.
-- Con coperto_cent = 0 i coperti si contano ma non si addebitano (default).
create table public.impostazioni_cassa (
  id int primary key default 1 check (id = 1),
  coperto_cent int not null default 0 check (coperto_cent between 0 and 2000)
);
insert into public.impostazioni_cassa (id) values (1);

alter table public.sessioni_tavolo
  add column coperti int check (coperti between 1 and 99),
  add column coperto_cent int check (coperto_cent between 0 and 2000),
  add constraint sessioni_coperti_prezzo check ((coperti is null) = (coperto_cent is null));

alter table public.impostazioni_cassa enable row level security;
revoke all on public.impostazioni_cassa from anon, authenticated;
