-- Chiave di invio degli incassi: la genera il telefono della cassa per ogni richiesta, così un doppio tocco o un nuovo
-- tentativo dopo un errore di rete non registrano due volte lo stesso incasso (come ordini.chiave_invio).
-- I pagamenti già registrati restano senza chiave.
alter table public.pagamenti add column chiave_invio uuid;
create unique index pagamenti_chiave_invio_unica on public.pagamenti(chiave_invio) where chiave_invio is not null;
