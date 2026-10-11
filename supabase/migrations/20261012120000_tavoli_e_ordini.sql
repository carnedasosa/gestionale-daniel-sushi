-- Tappa 2: accesso al tavolo e copie immutabili delle comande.
create table public.tavoli (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 40),
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,40}$'),
  posizione int not null default 0,
  attivo boolean not null default true
);
create table public.sessioni_tavolo (
  id uuid primary key default gen_random_uuid(),
  tavolo_id uuid not null references public.tavoli(id) on delete restrict,
  codice char(4) not null check (codice ~ '^[0-9]{4}$'),
  aperta_il timestamptz not null default now(),
  chiusa_il timestamptz
);
create unique index sessioni_una_aperta_per_tavolo on public.sessioni_tavolo(tavolo_id) where chiusa_il is null;
create unique index sessioni_codice_unico_tra_aperte on public.sessioni_tavolo(codice) where chiusa_il is null;
create table public.tentativi_codice (
  id bigint generated always as identity primary key,
  tavolo_id uuid not null references public.tavoli(id) on delete cascade,
  dispositivo uuid not null,
  creato_il timestamptz not null default now()
);
create index tentativi_tavolo_tempo on public.tentativi_codice(tavolo_id,creato_il);
create table public.ordini (
  id uuid primary key default gen_random_uuid(),
  numero int generated always as identity unique,
  tipo text not null default 'tavolo' check (tipo in ('tavolo')),
  stato text not null default 'inviato' check (stato in ('inviato','in_preparazione','servito','annullato')),
  sessione_id uuid references public.sessioni_tavolo(id) on delete restrict,
  totale_cent int not null check (totale_cent >= 0),
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  check (tipo <> 'tavolo' or sessione_id is not null)
);
create index ordini_stato_creato on public.ordini(stato,creato_il);
create index ordini_sessione on public.ordini(sessione_id);
create table public.righe_ordine (
  id uuid primary key default gen_random_uuid(),
  ordine_id uuid not null references public.ordini(id) on delete cascade,
  piatto_id uuid references public.piatti(id) on delete set null,
  numero int,
  nome text not null,
  prezzo_unit_cent int not null check (prezzo_unit_cent >= 0),
  quantita int not null check (quantita between 1 and 20),
  nota text check (nota is null or length(nota) <= 200),
  poke jsonb,
  annullata boolean not null default false,
  posizione int not null
);
create index righe_ordine_ordine on public.righe_ordine(ordine_id,posizione);
alter table public.tavoli enable row level security;
alter table public.sessioni_tavolo enable row level security;
alter table public.tentativi_codice enable row level security;
alter table public.ordini enable row level security;
alter table public.righe_ordine enable row level security;
revoke all on public.tavoli, public.sessioni_tavolo, public.tentativi_codice, public.ordini, public.righe_ordine from anon, authenticated;
revoke all on sequence public.tentativi_codice_id_seq, public.ordini_numero_seq from anon, authenticated;
