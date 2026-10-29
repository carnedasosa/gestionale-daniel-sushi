-- Pagamenti: incassi registrati dalla cassa per un tavolo (sessione) o per un ordine da casa.
-- modo: 'tutto' (il residuo), 'romana' (una quota del residuo diviso per le persone rimaste),
-- 'piatti' (porzioni e coperti scelti, in dettaglio), 'importo' (una cifra libera).
-- Un pagamento sbagliato non si cancella: si segna annullato (annullato_il, annullato_da).
create table public.pagamenti (
  id uuid primary key default gen_random_uuid(),
  sessione_id uuid references public.sessioni_tavolo(id) on delete restrict,
  ordine_id uuid references public.ordini(id) on delete restrict,
  importo_cent int not null check (importo_cent between 1 and 10000000),
  metodo text not null check (metodo in ('contanti','carta')),
  modo text not null check (modo in ('tutto','romana','piatti','importo')),
  descrizione text not null check (length(descrizione) between 1 and 80),
  dettaglio jsonb,
  utente_id uuid not null,
  creato_il timestamptz not null default clock_timestamp(),
  annullato_il timestamptz,
  annullato_da uuid,
  check (num_nonnulls(sessione_id, ordine_id) = 1),
  check ((modo = 'piatti') = (dettaglio is not null)),
  check ((annullato_il is null) = (annullato_da is null))
);
create index pagamenti_sessione on public.pagamenti(sessione_id) where sessione_id is not null;
create index pagamenti_ordine on public.pagamenti(ordine_id) where ordine_id is not null;

alter table public.pagamenti enable row level security;
revoke all on public.pagamenti from anon, authenticated;
