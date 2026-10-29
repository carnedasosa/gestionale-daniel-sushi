-- Foto dei piatti: una per piatto, già rimpicciolita dal browser dell'admin (lato lungo 800 px).
-- Si servono da /foto/[piatto]/[versione] con cache pubblica lunga: la versione cambia a ogni sostituzione.
create table public.foto_piatti (
  piatto_id uuid primary key references public.piatti(id) on delete cascade,
  dati bytea not null check (octet_length(dati) between 100 and 409600),
  tipo text not null check (tipo in ('image/webp','image/jpeg','image/png')),
  larghezza int not null check (larghezza between 16 and 2000),
  altezza int not null check (altezza between 16 and 2000),
  versione text not null check (versione ~ '^[0-9a-f]{16}$'),
  aggiornata_il timestamptz not null default now()
);
alter table public.foto_piatti enable row level security;
revoke all on public.foto_piatti from anon, authenticated;
