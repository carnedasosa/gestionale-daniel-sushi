-- Reparti: chi prepara cosa. Il banco sushi a vista, la cucina non a vista, la sala (bevande).
-- La sala porta comunque al tavolo tutti i piatti: il reparto dice solo chi li prepara.
-- Il reparto si copia nelle righe al momento dell'ordine: cambiare la categoria vale per gli ordini da adesso.

alter table public.categorie
  add column reparto text not null default 'banco' check (reparto in ('banco','cucina','sala'));

update public.categorie set reparto = 'cucina' where id in ('starter','primi','dessert');
update public.categorie set reparto = 'sala' where id = 'beverage';

alter table public.righe_ordine add column reparto text;

update public.righe_ordine r set reparto = c.reparto
  from public.piatti p join public.categorie c on c.id = p.categoria_id
  where p.id = r.piatto_id;

-- Poke composta (piatto_id null) e piatti cancellati: il reparto delle poke, altrimenti il banco.
update public.righe_ordine
  set reparto = coalesce((select reparto from public.categorie where id = 'poke-bowl'), 'banco')
  where reparto is null;

alter table public.righe_ordine
  alter column reparto set not null,
  add constraint righe_ordine_reparto_check check (reparto in ('banco','cucina','sala'));

create index righe_ordine_reparto on public.righe_ordine(ordine_id, reparto);
