# Applicazione Cupertino

Riferimento fornito dall'utente: [Cupertino v1](https://claude.ai/artifact/KnWaph6vBnjs2FNkfNsPoD), consultato il 12 ottobre 2026. Letti Overview, tokens.json e components/bundle.css nel browser; non è stato necessario accedere a Claude.

## Implementazione

- `src/styles/ds/cupertino.css` contiene i token effettivamente adottati dal riferimento: superfici base/elevated, label/fill/separator, colori accessibili, accent, materiali, spaziatura, raggi e dimensioni.
- Gli alias del gestionale in `tokens.css` rimandano a questi token. Il blu Cupertino #1e6ef4 sostituisce l'accento precedente; il testo tintato scuro usa #5cb8ff.
- Corpo 17 px e scala iOS in rem, font di sistema Text/Display, collegamento progressivo a Dynamic Type su Safari. Target 44 px su mobile e desktop.
- Card e liste opache con raggio nominale 26 px, nessuna ombra a riposo; angoli continui tramite superellipse(1.4) dove supportati. Separazione delle righe con hairline da 0.5 px.
- Pulsanti a capsula, campi con fill neutro, dialoghi elevated con raggio 38 px e scrim semantico. Le celle negli sheet hanno il livello elevated corretto.
- Barra admin con material-bar; carrello flottante con glass, blur/saturazione e bordo luminoso del riferimento. Fallback opachi senza backdrop-filter, con trasparenza ridotta e contrasto aumentato.
- Focus visibile, safe area e preferenze di movimento ridotto mantenuti. Nessuna modifica a servizi, autorizzazioni o dati.

## Verifiche di questo aggiornamento

- `npm.cmd run lint`: passa.
- `npm.cmd run build`: passa, inclusa verifica TypeScript e generazione delle 13 route.
- Test mirati menu cliente, componenti tavolo, schermo staff e smoke: 9 test su 4 file passano. La suite completa da 173 test era stata eseguita nel precedente restyling HIG; non è stata ripetuta per questo aggiornamento CSS.
- Menù reale in build di produzione a 375, 393, 440 e 1280 px: nessun overflow orizzontale, categorie alte almeno 44 px, corpo 17 px. Modulo accesso verificato visivamente.
- Fixture statica con gli stessi CSS per card staff, compositore poke e barra carrello: tema scuro forzato e testo 200% a 375 px, nessun overflow, corpo 34 px. Verificata elevazione dello sheet e composizione del glass. Questa prova non equivale a navigazione autenticata o modifica delle impostazioni del sistema operativo.

## Adattamenti e limiti

Usato il modello iOS per questa app web, mantenendo i target touch anche su desktop; non è simulata una finestra macOS. Le categorie del menu rimangono link a sezioni, senza il limite di cinque segmenti di un segmented control. I dialoghi HTML mantengono chiusura esplicita e tastiera, senza detent o swipe nativi. I font Apple sono richiesti dal sistema, senza distribuirne file.

Controlli completi sulle pagine autenticate, VoiceOver e Safari/iPhone fisico restano da eseguire.

Prove visive: `menu-393.png`, `accesso-393.png`, `componenti-dark-200-375.png` (fixture statica).
