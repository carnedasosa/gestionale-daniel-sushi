-- Origine dell'ordine: dal telefono del cliente (QR o sito), dalla cassa (telefonata o WhatsApp)
-- o dal cameriere per un tavolo. Gli ordini presi dalla cassa nascono già accettati e non hanno
-- né email né consenso privacy: li detta il cliente a voce.
alter table public.ordini add column origine text not null default 'cliente'
  check (origine in ('cliente','cassa','cameriere'));
alter table public.ordini drop constraint ordini_tavolo_check;
alter table public.ordini drop constraint ordini_casa_check;
alter table public.ordini add constraint ordini_tavolo_check check (
  tipo <> 'tavolo' or (sessione_id is not null and origine in ('cliente','cameriere')
    and num_nonnulls(token,fascia,cliente_nome,cliente_telefono,cliente_email,zona_id,zona_nome,consegna_cent,
      indirizzo,note_consegna,pagamento,contanti_da_cent,privacy_il,motivo_rifiuto,rete,anonimizzato_il) = 0)
);
alter table public.ordini add constraint ordini_casa_check check (
  tipo = 'tavolo' or (
    sessione_id is null and origine in ('cliente','cassa') and (origine <> 'cassa' or stato <> 'in_attesa')
    and token is not null and token ~ '^[A-Za-z0-9_-]{32}$' and fascia is not null
    and (origine <> 'cliente' or privacy_il is not null)
    and consegna_cent is not null and consegna_cent between 0 and 100000 and pagamento is not null and pagamento in ('contanti','carta')
    and (contanti_da_cent is null or (pagamento = 'contanti' and contanti_da_cent between 0 and 50000))
    and (anonimizzato_il is not null or (cliente_nome is not null and cliente_telefono is not null and (origine <> 'cliente' or cliente_email is not null)))
    and ((tipo = 'asporto' and consegna_cent = 0 and zona_nome is null and indirizzo is null and note_consegna is null)
      or (tipo = 'domicilio' and zona_nome is not null and (anonimizzato_il is not null or indirizzo is not null)))
  )
);
