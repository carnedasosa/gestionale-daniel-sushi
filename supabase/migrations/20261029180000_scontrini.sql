-- Scontrino (documento commerciale) dal registratore telematico.
-- Il gestionale manda all'RT il numero di reparto fiscale di ogni riga: l'aliquota IVA è programmata nell'RT.
alter table public.categorie add column reparto_fiscale int not null default 1 check (reparto_fiscale between 1 and 99);

alter table public.impostazioni_cassa
  add column reparto_fiscale_coperto int not null default 1 check (reparto_fiscale_coperto between 1 and 99),
  add column reparto_fiscale_consegna int not null default 1 check (reparto_fiscale_consegna between 1 and 99),
  add column indice_carta int not null default 1 check (indice_carta between 1 and 99),
  add column scontrino_automatico boolean not null default false;

-- Stato dello scontrino di ogni pagamento. «incerto»: il registratore non ha risposto, lo scontrino potrebbe essere
-- uscito; non si rimanda da solo, lo decide la cassa guardando l'RT. «prova»: uscito dal ponte in modalità prova.
alter table public.pagamenti
  add column scontrino text not null default 'non_richiesto' check (scontrino in ('non_richiesto','in_coda','emesso','errore','incerto','prova')),
  add column scontrino_numero text check (scontrino_numero is null or length(scontrino_numero) <= 20),
  add column scontrino_data text check (scontrino_data is null or length(scontrino_data) <= 20),
  add column scontrino_z text check (scontrino_z is null or length(scontrino_z) <= 20),
  add column scontrino_errore text check (scontrino_errore is null or length(scontrino_errore) <= 300),
  add column scontrino_il timestamptz;
