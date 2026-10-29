-- Carta dei vini: categorie di tipo «vini» e campi del vino sui piatti (tutti facoltativi).
-- Un vino venduto anche al calice sono due voci (bottiglia e calice), ognuna col suo prezzo:
-- carrello, conto e scontrino restano quelli di sempre.
alter table public.categorie add column tipo text not null default 'piatti' check (tipo in ('piatti','vini'));

alter table public.piatti
  add column vino_tipologia text check (vino_tipologia in ('bollicine','bianco','rosato','rosso','dolce')),
  add column vino_cantina text check (vino_cantina is null or length(vino_cantina) between 1 and 80),
  add column vino_denominazione text check (vino_denominazione is null or length(vino_denominazione) between 1 and 120),
  add column vino_annata int check (vino_annata between 1900 and 2100),
  add column vino_formato text check (vino_formato in ('bottiglia','mezza','calice')),
  add constraint piatti_vino_completo check ((vino_tipologia is null) = (vino_formato is null)
    and (vino_tipologia is not null or num_nonnulls(vino_cantina,vino_denominazione,vino_annata) = 0));

-- In fondo al menù, dopo le bevande; le bevande della carta le prepara la sala.
insert into public.categorie (id,nome,pezzi,posizione,reparto,tipo) values ('vini','Carta dei vini',null,1000,'sala','vini')
  on conflict (id) do nothing;
