-- Tappa 2: URL non indovinabili, tentativi per sessione/IP e invio idempotente.
alter table public.tavoli add column chiave text;
-- 12 simboli uniformi su 36 (~62 bit). Il frammento UUID di 12 cifre hex
-- avrebbe solo 48 bit. Il primo byte di gen_random_uuid non contiene bit fissi.
do $$
declare tavolo record; nuova text; b integer;
begin
  for tavolo in select id from public.tavoli where chiave is null loop
    loop
      nuova := '';
      while length(nuova) < 12 loop
        b := get_byte(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), 0);
        if b < 252 then
          nuova := nuova || substr('abcdefghijklmnopqrstuvwxyz0123456789', (b % 36) + 1, 1);
        end if;
      end loop;
      exit when not exists (select 1 from public.tavoli where chiave = nuova);
    end loop;
    update public.tavoli set chiave = nuova where id = tavolo.id;
  end loop;
end $$;
alter table public.tavoli alter column chiave set not null;
alter table public.tavoli add constraint tavoli_chiave_formato check (chiave ~ '^[a-z0-9]{12}$');
create unique index tavoli_chiave_unica on public.tavoli (chiave);

alter table public.tentativi_codice add column sessione_id uuid references public.sessioni_tavolo(id) on delete cascade;
alter table public.tentativi_codice add column ip text;
create index tentativi_sessione_tempo on public.tentativi_codice(sessione_id,creato_il);

alter table public.ordini add column chiave_invio uuid;
create unique index ordini_chiave_invio_unica on public.ordini(chiave_invio) where chiave_invio is not null;
