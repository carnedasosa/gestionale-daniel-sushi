-- Pre-conto: quando è stato stampato l'ultimo per il tavolo (il conto avvisa se dopo sono arrivati altri ordini).
alter table public.sessioni_tavolo add column preconto_il timestamptz;
