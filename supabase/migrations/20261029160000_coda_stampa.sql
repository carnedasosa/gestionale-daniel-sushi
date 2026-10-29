-- Coda di stampa: tutto ciò che va su carta (comande dei reparti, annulli, pre-conto, scontrini) è una riga qui,
-- scritta nella stessa transazione dell'evento. Il ponte di stampa nel locale la svuota verso le stampanti.
-- Stati: in_coda → in_stampa (preso dal ponte) → stampata | errore; un lavoro fiscale rimasto senza esito diventa
-- «incerta» e non riparte da solo (un secondo invio potrebbe battere un secondo scontrino); annullata = non serve più.
alter table public.impostazioni_cassa
  add column stampa_banco boolean not null default false,
  add column stampa_cucina boolean not null default false,
  add column stampa_sala boolean not null default false;

create table public.stampe (
  id uuid primary key default gen_random_uuid(),
  stampante text not null check (stampante in ('cassa','banco','cucina','fiscale')),
  tipo text not null check (tipo in ('comanda','annullo','preconto','scontrino','prova')),
  documento jsonb not null,
  ordine_id uuid references public.ordini(id) on delete cascade,
  comanda_id uuid references public.comande(id) on delete cascade,
  sessione_id uuid references public.sessioni_tavolo(id) on delete cascade,
  pagamento_id uuid references public.pagamenti(id) on delete restrict,
  stato text not null default 'in_coda' check (stato in ('in_coda','in_stampa','stampata','errore','incerta','annullata')),
  tentativi int not null default 0 check (tentativi >= 0),
  creata_il timestamptz not null default clock_timestamp(),
  presa_il timestamptz,
  finita_il timestamptz,
  errore text check (errore is null or length(errore) <= 300),
  check ((tipo = 'scontrino') = (stampante = 'fiscale')),
  check (tipo <> 'comanda' or comanda_id is not null),
  check (tipo <> 'scontrino' or pagamento_id is not null)
);
create index stampe_da_fare on public.stampe(creata_il) where stato in ('in_coda','in_stampa');
create index stampe_comanda on public.stampe(comanda_id) where comanda_id is not null;
create index stampe_ordine on public.stampe(ordine_id) where ordine_id is not null;

-- Segnale di vita del ponte (tabella a sé: lo aggiorna ogni 10 s e non deve bloccare le impostazioni).
create table public.ponte_stampa (
  id int primary key default 1 check (id = 1),
  visto_il timestamptz
);
insert into public.ponte_stampa (id) values (1);

-- Quando il reparto ha avuto la comanda su carta.
alter table public.comande add column stampata_il timestamptz;

alter table public.stampe enable row level security;
alter table public.ponte_stampa enable row level security;
revoke all on public.stampe, public.ponte_stampa from anon, authenticated;
