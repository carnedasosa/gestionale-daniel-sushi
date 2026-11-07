-- Limite ai tentativi di login (src/domain/limiti-accesso.ts). Migrazione additiva: va applicata prima del deploy che la legge,
-- altrimenti il login risponde «Accesso non riuscito» (chi è già dentro resta dentro). Dell'email si tiene solo l'impronta
-- SHA-256; la rete è quella di ipDaHeaders. Il cron notturno cancella le righe più vecchie di 30 giorni.
create table public.tentativi_accesso (
  id bigint generated always as identity primary key,
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  rete text,
  creato_il timestamptz not null default now()
);
create index tentativi_accesso_email_tempo on public.tentativi_accesso(email_hash,creato_il);
create index tentativi_accesso_rete_tempo on public.tentativi_accesso(rete,creato_il) where rete is not null;
alter table public.tentativi_accesso enable row level security;
revoke all on public.tentativi_accesso from anon, authenticated;
revoke all on sequence public.tentativi_accesso_id_seq from anon, authenticated;
