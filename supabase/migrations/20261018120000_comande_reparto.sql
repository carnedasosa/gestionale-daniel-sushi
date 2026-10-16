-- Comande per reparto: una per ogni reparto presente nell'ordine (banco, cucina, sala = bevande).
-- Ogni reparto segna pronta la propria parte; ordini.stato resta lo stato macro e il codice lo
-- ricava dalle comande nella stessa transazione (tutte da preparare → inviato/accettato,
-- qualcuna avanzata → in_preparazione, tutte pronte → servito/pronto).
-- portata_il: quando la sala ha portato al tavolo la parte pronta (non entra nello stato dell'ordine).
-- Gli ordini da casa non hanno comanda «sala»: le bevande le mette nel sacchetto la cassa.
create table public.comande (
  id uuid primary key default gen_random_uuid(),
  ordine_id uuid not null references public.ordini(id) on delete cascade,
  reparto text not null check (reparto in ('banco','cucina','sala')),
  stato text not null default 'da_preparare' check (stato in ('da_preparare','in_preparazione','pronta','annullata')),
  creata_il timestamptz not null default clock_timestamp(),
  iniziata_il timestamptz,
  pronta_il timestamptz,
  portata_il timestamptz,
  unique (ordine_id, reparto)
);
create index comande_reparto_stato on public.comande(reparto, stato);

-- Ordini già presenti: lo stato di ogni comanda segue quello dell'ordine.
-- Le parti già pronte risultano anche portate: la striscia «Da portare al tavolo» parte vuota.
insert into public.comande (ordine_id, reparto, stato, creata_il, iniziata_il, pronta_il, portata_il)
select o.id, g.reparto, s.stato, o.creato_il,
  case when s.stato in ('in_preparazione','pronta') then o.aggiornato_il end,
  case when s.stato = 'pronta' then o.aggiornato_il end,
  case when s.stato = 'pronta' then o.aggiornato_il end
from public.ordini o
join (select ordine_id, reparto, bool_and(annullata) as tutte_annullate from public.righe_ordine group by ordine_id, reparto) g on g.ordine_id = o.id
cross join lateral (select case
  when g.tutte_annullate or o.stato in ('annullato','rifiutato') then 'annullata'
  when o.stato = 'in_preparazione' then 'in_preparazione'
  when o.stato in ('servito','pronto','in_consegna','completato') then 'pronta'
  else 'da_preparare' end as stato) s
where o.tipo = 'tavolo' or g.reparto <> 'sala';

alter table public.comande enable row level security;
revoke all on public.comande from anon, authenticated;
