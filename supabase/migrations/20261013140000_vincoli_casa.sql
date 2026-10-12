-- Tappa 3: vincoli completi degli ordini (spec §6.1).
-- In SQL un check che vale NULL passa: token, consegna e pagamento mancanti
-- erano accettati. Il tavolo ora rifiuta ogni colonna della casa, non solo alcune.
alter table public.ordini drop constraint ordini_tavolo_check;
alter table public.ordini drop constraint ordini_casa_check;
alter table public.ordini add constraint ordini_tavolo_check check (
  tipo <> 'tavolo' or (sessione_id is not null and num_nonnulls(token,fascia,cliente_nome,cliente_telefono,cliente_email,zona_id,zona_nome,consegna_cent,
    indirizzo,note_consegna,pagamento,contanti_da_cent,privacy_il,motivo_rifiuto,rete,anonimizzato_il) = 0)
);
alter table public.ordini add constraint ordini_casa_check check (
  tipo = 'tavolo' or (
    sessione_id is null and token is not null and token ~ '^[A-Za-z0-9_-]{32}$' and fascia is not null and privacy_il is not null
    and consegna_cent is not null and consegna_cent between 0 and 100000 and pagamento is not null and pagamento in ('contanti','carta')
    and (contanti_da_cent is null or (pagamento = 'contanti' and contanti_da_cent between 0 and 50000))
    and (anonimizzato_il is not null or (cliente_nome is not null and cliente_telefono is not null and cliente_email is not null))
    and ((tipo = 'asporto' and consegna_cent = 0 and zona_nome is null and indirizzo is null and note_consegna is null)
      or (tipo = 'domicilio' and zona_nome is not null and (anonimizzato_il is not null or indirizzo is not null)))
  )
);
