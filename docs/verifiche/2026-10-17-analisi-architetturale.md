# Analisi architetturale del gestionale — 17/10/2026

Analisi statica del codice e dei verbali esistenti, senza eseguire test né l'app. Base: `origin/main` (commit 9c237d2, 16/10/2026), cioè il codice in produzione con comanda del cameriere, reparti nel menù, tabella `comande` per postazione e serata a quattro dispositivi. Verbali di riferimento: [`2026-10-14-serata-simulata.md`](2026-10-14-serata-simulata.md) e [`2026-10-16-serata-quattro-dispositivi.md`](2026-10-16-serata-quattro-dispositivi.md).

| Perimetro | Valore |
|---|---|
| Codice tracciato | 313 file, ~33k righe (branch `ordini-dalla-cassa`); main aggiunge ~2.300 righe |
| Dipendenze runtime | 8 (Next, React, pg, Supabase SSR/JS, qrcode, server-only) |
| Tabelle | 15, con 9 migrazioni |
| Test | 81 file di test, PGlite con migrazioni reali, 3 e2e Playwright, 1 serata simulata |
| Tenancy | singolo locale, nessuna multi-tenancy |

## 1. Mappa dell'architettura

Monolite Next.js 16 in cui tutta la verità vive in Postgres e il browser non parla mai con il database. Non esiste un canale push: ogni schermo rilegge la pagina intera via `router.refresh()`.

```
Telefono al tavolo ─┐                              ┌─ Tablet cassa (tutto)
Sito /ordina ───────┤  Server Actions  ┌────────┐  ├─ Tablet banco (comande banco)
Cassa /nuovo-ordine ┼─ richiediRuolo ─►│Postgres│◄─┼─ Tablet cucina (comande cucina)
Cameriere /staff/.. ┘  transazioni+lock└────────┘  └─ Telefono sala (ordini + «da portare»)
                                  ▲ polling 5 s (staff) / 10 s (cliente), probe GET /stato
```

| Strato | Dove | Giudizio |
|---|---|---|
| Dominio puro | `src/domain/*` (30 moduli, test accanto) | Punto di forza: fasce, soldi in centesimi, stati, limiti, ora di Roma con DST, tutto senza I/O |
| Repository SQL | `src/tavoli`, `src/casa`, `src/comande`, `src/menu` | SQL esplicito, `Db` iniettato, nessun ORM, nessun N+1 (righe lette con `any($1)`) |
| Azioni server | `src/app/**/azioni*.ts` | Disciplina costante: ruolo, validazione, repository, `revalidatePath` |
| Accesso dati | `pg` → transaction pooler Supabase, TLS verify-full con CA incorporata | Scelta corretta e rara da vedere fatta bene |
| UI | design system «Banco», componenti condivisi in `src/ordinare` tra tavolo, casa, cassa e cameriere | Riuso reale: un solo carrello per quattro flussi |

## 2. Modello dei dati e dove vive la consistenza

**Forza strutturale.** Le invarianti commerciali sono difese nel posto giusto, cioè nel database o in una transazione:

- prezzi e totali ricalcolati sul server dentro la transazione d'invio (`prezzaRighe`), con `for share` sui piatti;
- idempotenza d'invio tramite `chiave_invio` con indice unico parziale, controllata prima e dopo il lock e recuperata anche sul conflitto `23505`;
- un solo tavolo aperto e un solo codice fra i tavoli aperti (indici unici parziali);
- stato dell'ordine ricavato dalle comande nella stessa transazione (`statoOrdineDaComande`), quindi conto, email, fasce e pagina cliente non hanno dovuto cambiare quando sono arrivati i reparti;
- vincoli CHECK che impediscono a un ordine da casa di nascere senza token, fascia o pagamento, e a un ordine della cassa di restare `in_attesa`.

**Criticità nascoste.**

1. **`ordini` è una tabella a ereditarietà singola con 30 colonne nullable e due CHECK giganti** riscritti per intero in tre migrazioni su quattro. Funziona perché i test SQL li coprono, ma ogni nuovo tipo o origine richiede di ricopiare un predicato di dieci righe. Il rischio non è il bug oggi, è il costo di ogni evoluzione futura.
2. **Lo stato derivato non ha una rete di sicurezza nel database.** `aggiornaStatoOrdine` e `segnaComandeAnnullate` sono chiamate dal codice; niente trigger, niente vista di controllo. Qualsiasi percorso futuro che tocchi `comande` o `righe_ordine` senza passare da quelle funzioni produce un ordine incoerente che nessun vincolo rifiuta. La serata lo verifica a fine corsa, non durante.
3. **Ordine da casa di sole bevande non genera comande** (`creaComande` esclude `sala` per la casa): resta `accettato` finché la cassa non usa i bottoni a cascata. È una scelta documentata, ma è un caso in cui il flusso automatico si ferma in silenzio.
4. **Un ordine da casa `completato` è ancora modificabile.** `annullaRiga` protegge i tavoli con `contoChiuso`, ma per la casa passa `null` e blocca solo `annullato|rifiutato`. Si può ridurre il totale di un ordine già consegnato e incassato.

## 3. Flussi operativi e latenza percepita

| Flusso | Passi server | Lock presi | Latenza misurata (serata 16/10, DB finto) |
|---|---|---|---|
| Ordine dal QR | cookie di sessione → `creaOrdineTavolo` | sessione (`for update`) → piatti (`for share`) | invio 0,35 s mediana; in cucina p95 ~5 s |
| Checkout da casa | `creaOrdineCasa` | `impostazioni_casa` (globale) → piatti | invio 0,15 s |
| Ordine dalla cassa | stessa funzione con `origine: 'cassa'`, nasce accettato | idem | 0,24 s |
| Comanda del cameriere | `creaOrdineTavolo(…,'cameriere')` senza codice | come il QR | 0,7 s |
| Passo di reparto | `avanzaComanda` con stato visto (`da`) | ordine → comanda | p95 inizio 8 s, dovuto al polling |

I flussi sono efficienti sul lato scrittura: una transazione, dieci round trip verso il pooler, nessuna lettura ripetuta. Il costo sta tutto nella lettura: **ogni refresh della cassa esegue circa 17 query** (`leggiCassa` fa otto letture in parallelo più `riepilogoComande`, e `leggiDisponibilita` da sola ne fa sette in sequenza). Con quattro dispositivi a 5 secondi sono ~50 invocazioni al minuto per tutta la serata, più il probe `/stato` che raddoppia le richieste HTTP. È sostenibile per un locale, ma non è gratis su Vercel e cresce linearmente con i dispositivi.

## 4. Aggiornamento in tempo reale: il collo di bottiglia più probabile

Il polling senza Realtime è una scelta coerente con l'assenza di RLS lato client, e il componente `AggiornamentoAutomatico` è ben fatto: si ferma nelle schede nascoste, verifica la connessione prima, mostra l'ora dell'ultimo aggiornamento e ha un tetto di 30 secondi su un refresh in corso.

Il punto debole è la combinazione con le azioni. In `SchermoStaff` (e nel nuovo `useEsegui`) l'azione e il `router.refresh()` successivo stanno nella **stessa transizione React**, e `inCorso` disabilita **tutti i bottoni dello schermo**. Se il refresh post-azione resta appeso (rete lenta, risposta persa), l'intero KDS è bloccato finché non scatta il tetto dei 30 secondi. Il verbale del 14/10 lo ha visto una volta su cinque e lo ha attribuito al tetto: l'analisi del codice conferma che quella è la causa plausibile. In una serata vera, con il Wi-Fi della cucina che oscilla, è il guasto che si manifesterà per primo.

Due aggravanti:

- il refresh dopo l'azione e il refresh periodico possono sovrapporsi; Next scarta il più vecchio (gli `ERR_ABORTED` visti in serata), ma la transizione pendente resta tale;
- la prop `ora` arriva dal server: quando il DB non risponde lo schermo resta montato con gli ultimi dati, ma i timer «minuti di attesa» si congelano senza che l'operatore lo noti.

## 5. Concorrenza e robustezza sotto stress

**Ciò che regge.** L'ordine dei lock è documentato e rispettato ovunque: sessione → ordine → comande; piatti e `poke_config` sempre per ultimi e in `for share`. Nessun ciclo trovato. Ogni transizione di stato porta lo stato visto dallo schermo (`da`), quindi due tocchi su due tablet non saltano passaggi. Il pool gestisce la caduta di connessione durante una transazione scartando il client invece di rimetterlo nel pool.

**Ciò che può cedere.**

| Rischio | Meccanismo | Effetto sotto stress |
|---|---|---|
| Lock globale sugli ordini da casa senza `lock_timeout` | `select … from impostazioni_casa for update` serializza ogni checkout, anche dalla cassa; `OPZIONI_POOL` non imposta `statement_timeout` né `lock_timeout` | Una transazione bloccata (client che sparisce a metà, query lenta) mette in coda tutti i checkout; `connectionTimeoutMillis` protegge solo l'attesa della connessione, non la query |
| Pool da 5 connessioni contro letture a ventaglio | `leggiCassa` lancia 8 query in parallelo; due dispositivi sulla stessa istanza ne chiedono 16 insieme | Code interne al pool, latenza che sale a gradini; nessun errore ma refresh lenti proprio nei picchi |
| `for share` sui piatti contro «Esaurito» | `impostaDisponibile` è un UPDATE che aspetta tutti gli ordini in volo su quel piatto | Il tablet della sala sembra «non rispondere» quando segna esaurito nel momento peggiore, cioè mentre tutti lo ordinano |
| Esaurito contemporaneo all'invio | voluto: l'ordine intero è rifiutato e il carrello ripulito | Corretto, ma con un carrello da 12 righe il cliente perde il piatto e deve reinviare: costo UX accettato |
| Limite tentativi per rete | 5 errori per IP sul Wi-Fi del locale bloccano tutto il tavolo | Già noto e documentato; in sala succederà quasi ogni sera |

## 6. Sicurezza e dati personali

Impianto solido: RLS attiva con privilegi API revocati, chiave Supabase mai nel browser, ruoli in tabella con `richiediRuolo` come prima istruzione di ogni azione protetta (verificato dai test con `invocationCallOrder`), cookie `httpOnly`, chiave QR a 62 bit, token ordine a 192 bit, cron protetto da confronto a tempo costante, nessun dato dell'ambiente nei log.

Lacune reali:

- **`tentativi_codice` non viene mai svuotata**: conserva IP e identificativo dispositivo per sempre. `sbloccaSessione` cancella solo una sessione; non c'è cron né `delete` per età. È il contrario di quanto fa bene il cron di anonimizzazione a 12 mesi.
- **La rete (`ordini.rete`) resta 12 mesi** come il nome del cliente: per un indirizzo IP è una conservazione lunga rispetto allo scopo (limite di 10 ordini all'ora).
- **Il limite per telefono è aggirabile** cambiando numero: resta solo il limite per rete /64 o IPv4. Un abuso da più reti riempie «Da accettare» con un suono ogni 10 secondi. Niente CAPTCHA, BotID o regola del firewall Vercel.
- **Nessuna osservabilità**: errori solo con `console.error`, email fallite invisibili dopo 5 tentativi, cron che non registra i successi. Il primo guasto in produzione si scoprirà da un cliente al telefono.
- Pagina privacy segnata come «testo provvisorio» mentre si raccolgono dati con consenso.

## 7. Qualità del codice, test e manutenibilità

**Forza.** La piramide di test è rara per un progetto di questa dimensione: dominio puro testato, repository su Postgres vero in memoria con tutte le migrazioni, azioni con mock che verificano l'ordine delle chiamate, e2e sulla build di produzione, serata simulata con controlli di coerenza sul database a fine corsa. CI obbligatoria su main. Spec e verbali aggiornati e coerenti con il codice.

**Smell.**

- **Stile denso**: `ordini-repo.ts` ha 16 righe oltre i 200 caratteri; `annullaVoceConto` valida tutto in una sola espressione. Il codice è corretto ma difficile da rivedere a occhio, e i commenti suppliscono a nomi e spezzature che mancano.
- **Il seed è l'unico modo per creare piatti e categorie**: in `src/` non esiste alcun `insert into piatti`. L'admin modifica e disattiva, non crea. Un piatto nuovo oggi passa da `data/menu-sito.json` e da un'operazione sul DB reale.
- **E2E dipende da Supabase Auth reale** per il login dello staff: la CI fallisce se il servizio o l'utente di prova hanno problemi, anche senza regressioni.
- `revalidatePath` è chiamato ovunque ma quasi tutte le pagine sono già dinamiche per cookie o `connection()`: 26 chiamate che non cambiano il comportamento e che un lettore interpreta come necessarie.

## 8. Distanza da un POS/KDS maturo

Non sono difetti, sono assenze da mettere in conto:

- nessuna reportistica né storico consultabile: incassi per giorno, piatti più venduti, tempi per reparto esistono solo come timestamp nel database;
- stato per comanda e non per riga: un reparto non può segnare pronto «3 piatti su 5»;
- `ordini.numero` è un contatore globale che non si azzera mai: la cucina leggerà «n. 4.812» a fine anno;
- le fasce non attraversano la mezzanotte (noto, limita i turni lunghi del weekend);
- pagamenti, stampante, scontrino fiscale fuori perimetro per decisione esplicita (spec §2 e §10).

## 9. Priorità consigliate

| Priorità | Intervento | Sforzo |
|---|---|---|
| Alta | Separare l'azione dal refresh in `useEsegui`: `inCorso` per card, refresh fuori dalla transizione | basso |
| Alta | `statement_timeout` e `lock_timeout` nelle opzioni del pool, e togliere il lock globale ai checkout della cassa o ridurne la durata | basso |
| Alta | Guardia su ordini da casa `completato` in `annullaRiga` | minimo |
| Media | Pulizia periodica di `tentativi_codice` e azzeramento anticipato di `rete` nel cron esistente | basso |
| Media | Vista o test SQL che verifichi la coerenza ordine/comande/totale, da far girare anche sul DB reale con `scripts/interroga-sql.ts` | basso |
| Media | Alzare il limite per rete lasciando 5 per dispositivo, come già proposto nei verbali | minimo |
| Media | Log strutturati e avviso su email in errore definitivo | medio |
| Bassa | Creazione di piatti e categorie dall'admin; numero d'ordine giornaliero | medio |

Giudizio complessivo: un sistema piccolo per scelta e insolitamente rigoroso nelle garanzie di dominio, con il rischio concentrato non nei dati ma nel comportamento dello schermo sotto rete instabile e nell'assenza di osservabilità una volta in sala.
