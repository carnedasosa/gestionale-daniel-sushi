-- Controlli di coerenza degli ordini: totali, stato rispetto alle comande, comande rispetto alle righe, chiavi d'invio.
--
-- Uso (sola lettura, sul database di DATABASE_URL):
--   npx tsx --env-file=.env.local scripts/interroga-sql.ts scripts/sql/coerenza-ordini.sql
--
-- Ogni interrogazione è un controllo e restituisce ZERO RIGHE SE TUTTO È COERENTE.
-- Una riga restituita è un ordine (o una comanda) incoerente, con i valori trovati e quelli attesi.
-- Il database non ha vincoli per queste regole: le garantisce il codice (ricalcolaOrdine e annullaRiga in
-- src/tavoli/ordini-repo.ts, creaComande, aggiornaStatoOrdine, cascataComande e segnaComandeAnnullate in
-- src/comande/comande-repo.ts, statoOrdineDaComande in src/domain/comande.ts). Questi controlli scoprono
-- gli ordini lasciati incoerenti da un percorso che tocca ordini, righe o comande senza passare da lì.
--
-- Cosa NON controllano:
--   - ordini da casa di sole bevande: non hanno comande (la sala da casa non ha comanda), il loro stato lo
--     porta avanti solo la cassa e nessuna regola lo lega alle righe
--   - la storia dei passaggi: si guarda solo lo stato attuale, non se ci si è arrivati per la via giusta
--   - gli orari delle comande (iniziata_il, pronta_il, portata_il) e il «portato al tavolo»
--   - i prezzi delle righe rispetto al listino attuale (sono copiati al momento dell'ordine, apposta)
--   - il reparto delle righe rispetto a quello attuale della categoria (anche lui copiato all'ordine)
--   - registro_annullamenti, email_ordini e la chiusura dei tavoli (un tavolo si può chiudere con ordini in cucina)
--
-- Il file si spezza sui punti e virgola senza capire stringhe e commenti: non usarne dentro i commenti.
-- Il punto e virgola qui sotto chiude l'intestazione, che lo script salta perché fatta solo di commenti.
;

-- [a] Totale: ordini con totale_cent diverso da righe attive + consegna (senza righe attive il totale atteso è 0)
-- Regola di ricalcolaOrdine e della creazione: somma di prezzo_unit_cent * quantita delle righe con annullata=false,
-- più consegna_cent (null per i tavoli, 0 per l'asporto, il costo della zona per il domicilio).
-- Un ordine annullato per intero tiene le righe attive e quindi il suo totale: anche lui deve tornare.
select o.id, o.numero, o.tipo, o.stato,
  o.totale_cent as totale_trovato,
  t.atteso as totale_atteso,
  coalesce(r.righe_attive, 0) as righe_attive,
  coalesce(r.righe_cent, 0) as righe_cent,
  o.consegna_cent
from ordini o
left join (
  select ordine_id, count(*)::int as righe_attive, sum(prezzo_unit_cent::bigint * quantita)::bigint as righe_cent
  from righe_ordine where not annullata group by ordine_id
) r on r.ordine_id = o.id
cross join lateral (
  select (case when coalesce(r.righe_attive, 0) = 0 then 0 else r.righe_cent + coalesce(o.consegna_cent, 0) end)::bigint as atteso
) t
where o.totale_cent <> t.atteso
order by o.numero;

-- [b] Stato: ordini con stato incoerente con le comande attive (regola statoOrdineDaComande e passaggi della cassa)
-- Contano solo le comande non annullate, e solo gli ordini che ne hanno almeno una.
--   in cucina (tavolo inviato|in_preparazione, casa accettato|in_preparazione): lo stato deve essere quello
--     ricavato dalle comande: tutte da_preparare → inviato/accettato, tutte pronte → servito/pronto, miste → in_preparazione
--   in_attesa (casa, non ancora accettato): le comande non possono partire, tutte da_preparare
--   usciti dalla cucina (servito, pronto, in_consegna, completato): tutte pronte (la cassa le porta dietro a cascata)
--   annullato e rifiutato: nessuna comanda attiva (annullamenti e rifiuti le annullano a cascata)
-- Non controlla gli ordini senza comande attive (per esempio da casa con sole bevande): per loro la regola non vale.
with conteggi as (
  select o.id, o.numero, o.tipo, o.stato,
    count(*) filter (where c.stato <> 'annullata')::int as attive,
    count(*) filter (where c.stato = 'da_preparare')::int as da_preparare,
    count(*) filter (where c.stato = 'in_preparazione')::int as in_preparazione,
    count(*) filter (where c.stato = 'pronta')::int as pronte
  from ordini o join comande c on c.ordine_id = o.id
  group by o.id, o.numero, o.tipo, o.stato
), ricavati as (
  select k.*,
    case when da_preparare = attive then case when tipo = 'tavolo' then 'inviato' else 'accettato' end
         when pronte = attive then case when tipo = 'tavolo' then 'servito' else 'pronto' end
         else 'in_preparazione' end as stato_da_comande
  from conteggi k where attive > 0
), verifiche as (
  select r.*,
    case
      when stato in ('inviato', 'in_preparazione', 'accettato') and stato <> stato_da_comande then stato_da_comande
      when stato = 'in_attesa' and da_preparare <> attive then 'in_attesa con comande tutte da_preparare'
      when stato in ('servito', 'pronto', 'in_consegna', 'completato') and pronte <> attive then stato || ' con comande tutte pronte'
      when stato in ('annullato', 'rifiutato') then stato || ' senza comande attive'
    end as atteso
  from ricavati r
)
select id, numero, tipo, stato as stato_trovato, atteso as stato_atteso,
  attive as comande_attive, da_preparare, in_preparazione, pronte
from verifiche
where atteso is not null
order by numero;

-- [c1] Comande attive di un reparto che nell'ordine non ha più righe attive (andavano annullate)
-- Il reparto di una riga è righe_ordine.reparto, copiato dalla categoria al momento dell'ordine: creaComande e
-- segnaComandeAnnullate usano la stessa colonna.
select o.id, o.numero, o.tipo, o.stato, c.reparto, c.stato as stato_comanda, c.id as comanda_id
from comande c join ordini o on o.id = c.ordine_id
where c.stato <> 'annullata'
  and not exists (select 1 from righe_ordine r where r.ordine_id = c.ordine_id and r.reparto = c.reparto and not r.annullata)
order by o.numero, c.reparto;

-- [c2] Reparti con righe attive ma senza comanda attiva, in ordini non annullati né rifiutati
-- creaComande fa una comanda per ogni reparto delle righe (da casa niente sala) e una comanda si annulla solo quando
-- il suo reparto resta senza righe attive. Un ordine annullato per intero tiene le righe attive e annulla le comande:
-- per questo annullati e rifiutati non si guardano.
select o.id, o.numero, o.tipo, o.stato, r.reparto, count(*)::int as righe_attive,
  coalesce(c.stato, 'nessuna comanda') as stato_comanda
from ordini o
join righe_ordine r on r.ordine_id = o.id and not r.annullata
left join comande c on c.ordine_id = o.id and c.reparto = r.reparto
where o.stato not in ('annullato', 'rifiutato')
  and (o.tipo = 'tavolo' or r.reparto <> 'sala')
  and (c.id is null or c.stato = 'annullata')
group by o.id, o.numero, o.tipo, o.stato, r.reparto, c.stato
order by o.numero, r.reparto;

-- [c3] Comande «sala» in ordini da casa (da casa le bevande le mette nel sacchetto la cassa, senza comanda)
select o.id, o.numero, o.tipo, o.stato, c.reparto, c.stato as stato_comanda, c.id as comanda_id
from comande c join ordini o on o.id = c.ordine_id
where o.tipo <> 'tavolo' and c.reparto = 'sala'
order by o.numero;

-- [d1] Chiavi d'invio usate da più ordini (rete di sicurezza: l'indice unico ordini_chiave_invio_unica lo impedisce)
select id, numero, tipo, stato, chiave_invio, ordini_con_la_chiave
from (
  select o.id, o.numero, o.tipo, o.stato, o.chiave_invio,
    count(*) over (partition by o.chiave_invio)::int as ordini_con_la_chiave
  from ordini o where o.chiave_invio is not null
) x
where ordini_con_la_chiave > 1
order by chiave_invio, numero;

-- [d2] Più comande per lo stesso reparto dello stesso ordine (rete di sicurezza: il vincolo unique (ordine_id, reparto) lo impedisce)
select o.id, o.numero, o.tipo, o.stato, x.reparto, x.comande
from (select ordine_id, reparto, count(*)::int as comande from comande group by ordine_id, reparto having count(*) > 1) x
join ordini o on o.id = x.ordine_id
order by o.numero, x.reparto;
