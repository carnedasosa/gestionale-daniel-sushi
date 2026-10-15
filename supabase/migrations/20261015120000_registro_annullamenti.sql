-- Registro degli annullamenti: chi ha tolto cosa dal conto e quando.
-- Una riga per ordine annullato per intero, per riga annullata dalla comanda o per riga tolta da una voce del conto.
-- utente_id senza foreign key: il registro resta anche se l'account dello staff viene eliminato.
-- Gli ordini non si eliminano mai: restrict impedisce di perdere la traccia per errore.
create table public.registro_annullamenti (
  id uuid primary key default gen_random_uuid(),
  creato_il timestamptz not null default clock_timestamp(),
  utente_id uuid not null,
  tipo text not null check (tipo in ('ordine','riga','voce_conto')),
  ordine_id uuid not null references public.ordini(id) on delete restrict,
  riga_id uuid references public.righe_ordine(id) on delete restrict,
  importo_cent integer not null check (importo_cent >= 0),
  check ((tipo = 'ordine') = (riga_id is null))
);
create index registro_annullamenti_ordine on public.registro_annullamenti(ordine_id);
create index registro_annullamenti_tempo on public.registro_annullamenti(creato_il);

alter table public.registro_annullamenti enable row level security;
revoke all on public.registro_annullamenti from anon, authenticated;
