-- Tappa 3: ordini da casa (asporto e domicilio), zone, orari, chiusure, coda delle email.
-- Solo aggiunte: gli ordini dei tavoli già presenti restano validi.
create table public.zone_consegna (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 60),
  costo_cent int not null check (costo_cent between 0 and 100000),
  minimo_cent int not null check (minimo_cent between 0 and 1000000),
  attiva boolean not null default true,
  posizione int not null default 0
);
create table public.orari_casa (
  id uuid primary key default gen_random_uuid(),
  servizio text not null check (servizio in ('asporto','domicilio')),
  giorno int not null check (giorno between 1 and 7),
  dalle time not null,
  alle time not null,
  check (dalle < alle)
);
create index orari_casa_giorno on public.orari_casa(servizio,giorno);
create table public.chiusure_casa (
  data date primary key,
  motivo text check (motivo is null or length(motivo) <= 100)
);
create table public.impostazioni_casa (
  id int primary key default 1 check (id = 1),
  capacita_fascia int not null default 4 check (capacita_fascia between 1 and 50),
  capacita_consegne int not null default 2 check (capacita_consegne between 0 and 50),
  anticipo_minuti int not null default 30 check (anticipo_minuti between 0 and 240),
  telefono text check (telefono is null or telefono ~ '^[0-9]{6,13}$'),
  aperti_il date,
  check (capacita_consegne <= capacita_fascia)
);
insert into public.impostazioni_casa (id) values (1);

alter table public.ordini drop constraint ordini_tipo_check;
alter table public.ordini drop constraint ordini_stato_check;
alter table public.ordini drop constraint ordini_check;
alter table public.ordini
  add column token text,
  add column fascia timestamptz,
  add column cliente_nome text check (cliente_nome is null or length(cliente_nome) between 1 and 60),
  add column cliente_telefono text check (cliente_telefono is null or cliente_telefono ~ '^[0-9]{6,13}$'),
  add column cliente_email text check (cliente_email is null or length(cliente_email) between 3 and 254),
  add column zona_id uuid references public.zone_consegna(id) on delete set null,
  add column zona_nome text check (zona_nome is null or length(zona_nome) between 1 and 60),
  add column consegna_cent int,
  add column indirizzo text check (indirizzo is null or length(indirizzo) between 5 and 200),
  add column note_consegna text check (note_consegna is null or length(note_consegna) <= 200),
  add column pagamento text,
  add column contanti_da_cent int,
  add column privacy_il timestamptz,
  add column motivo_rifiuto text check (motivo_rifiuto is null or length(motivo_rifiuto) between 1 and 200),
  add column rete text,
  add column anonimizzato_il timestamptz;
alter table public.ordini add constraint ordini_tipo_check check (tipo in ('tavolo','asporto','domicilio'));
alter table public.ordini add constraint ordini_stato_check check (
  (tipo = 'tavolo' and stato in ('inviato','in_preparazione','servito','annullato'))
  or (tipo = 'asporto' and stato in ('in_attesa','accettato','rifiutato','in_preparazione','pronto','completato','annullato'))
  or (tipo = 'domicilio' and stato in ('in_attesa','accettato','rifiutato','in_preparazione','pronto','in_consegna','completato','annullato'))
);
alter table public.ordini add constraint ordini_tavolo_check check (
  tipo <> 'tavolo' or (sessione_id is not null and token is null and fascia is null and consegna_cent is null and pagamento is null and cliente_nome is null)
);
alter table public.ordini add constraint ordini_casa_check check (
  tipo = 'tavolo' or (
    sessione_id is null and token ~ '^[A-Za-z0-9_-]{32}$' and fascia is not null and privacy_il is not null
    and consegna_cent between 0 and 100000 and pagamento in ('contanti','carta')
    and (contanti_da_cent is null or (pagamento = 'contanti' and contanti_da_cent between 0 and 50000))
    and (anonimizzato_il is not null or (cliente_nome is not null and cliente_telefono is not null and cliente_email is not null))
    and ((tipo = 'asporto' and consegna_cent = 0 and zona_nome is null and indirizzo is null and note_consegna is null)
      or (tipo = 'domicilio' and zona_nome is not null and (anonimizzato_il is not null or indirizzo is not null)))
  )
);
create unique index ordini_token_unico on public.ordini(token) where token is not null;
create index ordini_casa_fascia on public.ordini(fascia) where tipo <> 'tavolo';
create index ordini_casa_in_attesa_telefono on public.ordini(cliente_telefono) where stato = 'in_attesa';
create index ordini_casa_rete on public.ordini(rete,creato_il) where rete is not null;
create index ordini_casa_da_anonimizzare on public.ordini(creato_il) where tipo <> 'tavolo' and anonimizzato_il is null;

create table public.email_ordini (
  id uuid primary key default gen_random_uuid(),
  ordine_id uuid not null references public.ordini(id) on delete cascade,
  tipo text not null check (tipo in ('ricevuto','accettato','rifiutato','annullato')),
  creata_il timestamptz not null default now(),
  inviata_il timestamptz,
  in_invio_dal timestamptz,
  tentativi int not null default 0 check (tentativi >= 0),
  ultimo_errore text check (ultimo_errore is null or length(ultimo_errore) <= 500),
  unique (ordine_id,tipo)
);
create index email_ordini_da_inviare on public.email_ordini(creata_il) where inviata_il is null;

alter table public.poke_config add column allergeni_voci jsonb not null default '{}'::jsonb check (jsonb_typeof(allergeni_voci) = 'object');
alter table public.poke_config add column allergeni_confermati boolean not null default false;

alter table public.zone_consegna enable row level security;
alter table public.orari_casa enable row level security;
alter table public.chiusure_casa enable row level security;
alter table public.impostazioni_casa enable row level security;
alter table public.email_ordini enable row level security;
revoke all on public.zone_consegna, public.orari_casa, public.chiusure_casa, public.impostazioni_casa, public.email_ordini from anon, authenticated;
