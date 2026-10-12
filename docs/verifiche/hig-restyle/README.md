# Restyling HIG

Branch `hig-restyle`, creato da `correzioni-tappa-2` con checkout pulito.
Skill applicata: `C:/Users/aless/Downloads/Hig-v1/skills/hig/SKILL.md`.

## Cambiamenti

Font di sistema e scala in rem (corpo 17 px); titoli leggibili e liste raggruppate; controlli almeno 44 px; accento indaco conservato. Tema chiaro/scuro automatico, contrasto aumentato, riduzione movimento e trasparenza, viewport senza blocco zoom e safe area. Moduli e categorie vanno a capo; prezzo sotto il nome su mobile. Dialoghi con chiusura accessibile, Annulla e azione specifica; chiusura tavolo distinta come azione distruttiva. Indicatori di attesa nei moduli. Conferma d'invio senza timeout, chiudibile con Fine o preparando il nuovo ordine.

Nessuna modifica a servizi, query, permessi, schema o dati. Font Google rimossi dal layout in favore dei font disponibili sul dispositivo.

## Verifiche

- Suite completa: 173 test, 39 file, con `npm.cmd test -- --maxWorkers=1`. Il primo tentativo parallelo ha superato i timeout PGlite; nessun timeout nella ripetizione seriale.
- Dopo gli ultimi ritocchi ai componenti: 9 test su 4 file (menu pubblico, card ordinabile, card staff e smoke).
- Lint, TypeScript nella build e build di produzione passati. `git diff --check` passato.
- Browser sul menu reale a 375, 393, 440 e 1280 px: documento entro il viewport, corpo 17 px, categorie alte 44 px. Accesso controllato visivamente su desktop.
- Copia statica locale del menu reale con gli stessi CSS: tema scuro e testo al 200% (34 px) a 375 px, documento largo 360 px (15 px riservati alla scrollbar). Nessun overflow orizzontale.
- Contrasti calcolati sui token: testo 15.25:1; testo secondario chiaro su bianco 6.95:1; primario chiaro 9.47:1; avviso 6.06:1; vegetariano 6.49:1; distruttivo chiaro 6.51:1. Varianti scure controllate: minimo 7.59:1 nelle coppie verificate.

## Limiti

Adattamento web delle HIG: dialog HTML con chiusura esplicita, senza sheet nativo e gesto swipe; font SF disponibile soltanto sui dispositivi Apple, fallback di sistema sugli altri. La navigazione admin resta una barra di link per mantenere le sezioni del gestionale. Tabelle amministrative mantengono lo scorrimento orizzontale quando necessario.

Verifica visuale completa delle aree autenticate, VoiceOver, stampa fisica e telefono iOS ancora da eseguire. Il tema scuro e il testo ingrandito sono stati verificati su copia statica, non tramite cambio delle impostazioni del dispositivo. Questa verifica non certifica una conformità nativa iOS.
