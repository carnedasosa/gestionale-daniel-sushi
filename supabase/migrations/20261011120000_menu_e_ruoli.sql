-- Tappa 1: ruoli, menù e configurazione della poke.
-- Il browser non legge mai queste tabelle: RLS attiva e nessuna policy; il server usa il ruolo postgres.

create table public.profili (
  user_id uuid primary key,
  ruolo text not null check (ruolo in ('staff', 'admin')),
  creato_il timestamptz not null default now()
);

create table public.categorie (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  nome text not null,
  pezzi text,
  posizione int not null
);

create table public.piatti (
  id uuid primary key default gen_random_uuid(),
  categoria_id text not null references public.categorie (id) on update cascade on delete restrict,
  numero int unique check (numero > 0),
  nome text not null check (length(trim(nome)) > 0),
  descrizione text,
  prezzo_cent int not null check (prezzo_cent >= 0),
  piccante boolean not null default false,
  vegetariano boolean not null default false,
  della_casa boolean not null default false,
  allergeni text[] not null default '{}' check (allergeni <@ array[
    'glutine', 'crostacei', 'uova', 'pesce', 'arachidi', 'soia', 'latte',
    'frutta_a_guscio', 'sedano', 'senape', 'sesamo', 'solfiti', 'lupini', 'molluschi'
  ]::text[]),
  allergeni_confermati boolean not null default false,
  disponibile boolean not null default true,
  posizione int not null,
  aggiornato_il timestamptz not null default now()
);

create index piatti_categoria_posizione_idx on public.piatti (categoria_id, posizione);

create table public.poke_config (
  id int primary key default 1 check (id = 1),
  titolo text not null,
  gruppi jsonb not null,
  prezzo_base_cent int check (prezzo_base_cent >= 0),
  prezzo_extra_cent int check (prezzo_extra_cent >= 0)
);

alter table public.profili enable row level security;
alter table public.categorie enable row level security;
alter table public.piatti enable row level security;
alter table public.poke_config enable row level security;

revoke all on public.profili, public.categorie, public.piatti, public.poke_config from anon, authenticated;
