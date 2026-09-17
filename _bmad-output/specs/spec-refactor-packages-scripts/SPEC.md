---
id: SPEC-refactor-packages-scripts
companions:
  - ./extraction-contract.md
  - ./commands.md
  - ./migration.md
  - ../../forge/refactor-packages-scripts/simulazione-card.md
  - ../spec-page-builder/penpot-pipeline.md
sources:
  - ../../forge/refactor-packages-scripts/forged-idea.md
---

> **Canonical contract.** Questo SPEC e i file in `companions:` sono il contratto completo e validato per cosa costruire, testare e verificare. `penpot-pipeline.md` descrive la pipeline v1: resta valido per Stadio 0 (library) e Stadio 1 (token) e per il principio guida; dove confligge con questo SPEC (tre artefatti, emitter shadcn, parti e ruoli nel contratto del page builder) prevale questo SPEC.

# Pipeline Penpot → codice v2

## Why

Un dolore da risolvere. Un caso reale, la ProductCard (immagine, prezzo, descrizione, tag, link, badge sconto solo in alcune varianti), si ferma in cinque punti del modello v1: nessun ruolo `image`, nessuna parte opzionale per variante, nessuna parte ripetibile, field solo come testo di una parte, nessuna composizione. Nessuno dei cinque sta in `packages/scripts`: stanno nel vocabolario del contratto. Riscrivere gli script per leggibilità lascerebbe la card bloccata sulle stesse cinque righe. La v2 cambia il modello (due contratti, un'istantanea generata, un registro unico) e gli script ne discendono, ridotti a sei comandi con un guscio e un tipo di errore. Riguarda lo sviluppatore che scrive contratti e skill, e il designer non tecnico che disegna in Penpot e deve poter aggiungere una variante senza che la pipeline si fermi. Il momento è ora: nessuna pagina salvata usa ancora i contratti, quindi cambiarne il fingerprint costa zero.

## Capabilities

- **CAP-1 — Contratto del page builder ridotto**
  - **intent:** il contratto in `@app/contracts` descrive solo ciò che l'editor e le pagine salvate usano: nome, versione, assi `option`, field (testo, attributo, url, array), slot.
  - **success:** `parts`, `partRoles` e gli assi `state`/`behavior` escono dal fingerprint e dal formato canonico; `SCHEMA_VERSION` sale una volta. Fino a CAP-11 restano accettati come estensione deprecata fuori dal fingerprint, letta solo dalla v1, con un test che ne fissa la cancellazione; i quattro contratti esistenti passano al formato ridotto quando rinascono (CAP-11), non prima.

- **CAP-2 — Contratto di estrazione**
  - **intent:** per ogni componente, un contratto in `packages/scripts` importa il contratto del page builder e dichiara come leggerlo da Penpot e come renderlo: parti con ruolo, parte opzionale per valore d'asse, parte ripetibile, albero, layer, elemento HTML, field come contenuto o attributo, primitivo headless per parte, dominio, a11y. Vocabolario in [extraction-contract.md](./extraction-contract.md).
  - **success:** un contratto di estrazione che contraddice il contratto del page builder (field inesistente, tipo sbagliato, `when` su asse non `option`, albero senza radice o con cicli, parte senza ruolo) fallisce a module load nominando parte e campo, prima di qualsiasi comando.

- **CAP-3 — Registro proprietà unico**
  - **intent:** l'unico posto dove si insegna una proprietà Penpot resta il registro; impara layout (direzione, allineamento, gap, wrap) e posizione da Penpot, così nessuna dichiarazione porta classi Tailwind a mano.
  - **success:** il Badge v2 esce con le classi di layout (`flex`, `items-center`, `gap-*`) derivate dal layer Penpot e non da un campo `structural`; il ruolo `image` ammette solo raggio, opacità e layout e nessun `fill`; una proprietà nuova entra con una riga di registro più un test rosso/verde.

- **CAP-4 — `extract`: una sola istantanea validata**
  - **intent:** leggere un componente da Penpot, validarlo contro i due contratti e scrivere una sola istantanea `data/components/<nome>.json`; `--check` confronta senza scrivere.
  - **success:** per la card, `extract` produce un file con 6 celle e provenienza; con il layer `Badge` presente nella cella `promo=none` fallisce con categoria `contract`, nomina componente, cella e parte, propone gli adattamenti in ordine (designer, poi contratto di estrazione) e non scrive nulla; fixture, ricetta e design come file separati non esistono più.

- **CAP-5 — `render`: dal contratto di estrazione ai quattro file**
  - **intent:** generare `<Comp>.tsx`, `.test.tsx`, `.stories.tsx` e barrel da istantanea, contratto di estrazione e registro, senza basi shadcn: `when` diventa render condizionale, `repeat` una `map`, `attribute` un attributo, gli assi `state` prefissi di stato, il primitivo headless l'elemento della parte.
  - **success:** `render --check --all` rigenera a diff zero tutto ciò che è committato in v2; un file senza marker `@generated` non viene mai sovrascritto; la cartella `data/bases/` non esiste più.

- **CAP-6 — `library`: container Penpot dal contratto di estrazione**
  - **intent:** `bootstrap` e `add` creano in Penpot il VariantContainer con plugin data, assi (inclusi `state`), celle e layer con i nomi delle parti, leggendo il contratto di estrazione invece di judgment e binding.
  - **success:** `library add ProductCard` su una library senza la card crea il container con 6 board e i layer attesi; rilanciato, non modifica né cancella nulla e segnala le differenze.

- **CAP-7 — `propose`: Penpot davanti al contratto**
  - **intent:** quando Penpot contiene un valore d'asse, una parte o un ruolo che i contratti non hanno, un solo comando stampa il diff proposto sui due contratti; lo sviluppatore lo applica a mano.
  - **success:** `propose` sostituisce `adopt:variant`, `bump:contract` e `role:part`; non scrive mai né su Penpot né sui contratti; il diff nomina file e riga.

- **CAP-8 — Un guscio, un errore**
  - **intent:** tutti i comandi condividono parser, guardia di invocazione diretta, uscita e una sola classe `ScriptError` con categoria.
  - **success:** sei comandi (`theme`, `library`, `extract`, `render`, `gates`, `propose`); exit `1` input, `2` penpot, `3` contract, `4` gate; nessuna scrittura di `process.exitCode` fuori dal guscio; un test per categoria.

- **CAP-9 — Gate in CI sulla v2**
  - **intent:** la CI rigenera dal repo e verifica: `render --check --all`, suite ui, axe.
  - **success:** nessun comando live gira in CI; un componente divergente rende rossa la CI nominandolo; gli altri componenti vengono comunque verificati.

- **CAP-10 — ProductCard end-to-end**
  - **intent:** la card della [simulazione](../../forge/refactor-packages-scripts/simulazione-card.md) è il primo componente della v2 e la prova che il modello regge.
  - **success:** due contratti scritti, container creato con `library add`, disegnata in Penpot, `extract` e `render` verdi, test e axe verdi, story in Storybook giudicata visivamente da Alessandro; nessuna riga di codice a mano in `packages/ui`.

- **CAP-11 — Rimozione della v1 e rigenerazione dei quattro componenti**
  - **intent:** dopo la card, la v1 viene cancellata (codice, file per componente, otto comandi, quattro componenti generati) e Badge, Input, Alert e AccordionItem vengono rigenerati da Penpot con la v2; le skill `pds-*` vengono riscritte sui sei comandi. Piano in [migration.md](./migration.md).
  - **success:** i quattro componenti esistono di nuovo in `packages/ui` solo come output di `render` v2, con test e axe verdi e diff zero in CI; `judgments/`, `bindings/`, `designs/`, `bases/`, `recipes/` e il codice v1 non esistono più; le skill `pds-*` non citano alcun comando v1; l'AccordionItem usa Base UI.

## Constraints

- La dipendenza va in un verso solo: il contratto di estrazione importa quello del page builder, mai il contrario. Il fingerprint copre solo il page builder.
- Nel contratto del page builder sta solo ciò che cambia una pagina salvata o un campo dell'editor. Tutto il resto è estrazione.
- Token obbligatorio su ogni stile. Unica eccezione: il ruolo `image`, il cui contenuto arriva dal field.
- L'istantanea la scrive solo `extract`. `extract` e `render` non girano mai in CI né in build. Solo `library` scrive su Penpot. Ogni scrittura è tmp + rename.
- L'esito lo decide lo script con l'exit code, mai la skill. Il principio della libertà del designer resta: si chiede di toccare Penpot solo per scelte di design vere.
- La ProductCard è il primo componente della v2. La v1 e i quattro componenti generati restano intatti finché la card non passa CAP-10; poi si cancellano, non si migrano.
- v1 e v2 vivono nella stessa cartella `packages/scripts` (`src/v2` finché la v1 esiste); `main` non si rompe mai.
- Il contratto del page builder tollera i campi v1 (`parts`, `partRoles`, assi `state`/`behavior`) come estensione deprecata fuori dal fingerprint fino a CAP-11: è ciò che tiene insieme "`SCHEMA_VERSION` sale una volta" e "la v1 resta intatta" (correct-course 2026-09-17).
- Diff zero in CI è obbligatorio dal primo commit v2 di ogni componente, card inclusa. Nessun criterio di regressione visivo: i quattro componenti rinascono, non migrano.
- Il primitivo headless è Base UI. L'AccordionItem è la verifica pratica.
- Gli assi `state` si disegnano in Penpot come celle, come fa oggi l'Input; una cella mancante è errore `contract` come per gli assi `option`.
- Il testo del badge per variante (`Offerta`/`Sconto`) è un field `badgeLabel` del page builder, modificabile dall'editor, non testo statico del contratto di estrazione.
- AD-11 e `penpot-pipeline.md` sono stati rivisti alla v2 dal correct-course del 2026-09-17 (`planning-artifacts/sprint-change-proposal-2026-09-17.md`): Epic 2 a 18 story, Storybook anticipato alla 2.11, v2 nelle Story 2.12–2.17, libreria alla 2.18. Lo Stadio 2 v1 di `penpot-pipeline.md` resta in servizio fino a CAP-11; dove confligge con questo SPEC prevale questo SPEC.

## Non-goals

- Tenere Radix: esce con la v1.
- Migrare i componenti v1: si cancellano e si rigenerano.
- Un job schedulato che rileva la deriva di Penpot senza `extract`: non risolto dalla v2.
- Toccare Stadio 1 (token, `generate:theme`): resta com'è, cambia solo nome di comando.
- Integrazione con Puck e sezioni: Epic 3.
- Correzione automatica di Penpot o dei contratti: `propose` stampa, non scrive.
- Rendere leggibili le pipe v1: scartato, non riduce il rischio sui casi nuovi.

## Success signal

Il designer disegna la ProductCard in Penpot con la variante sconto; lo sviluppatore lancia `extract ProductCard` e `render ProductCard`; la card compare in `packages/ui` con test e axe verdi, la CI la rigenera a diff zero, e nessuno ha scritto una riga di codice a mano. Poi la v1 viene cancellata e Badge, Input, Alert e AccordionItem rinascono dalla stessa strada, senza che nessuno noti la differenza in Storybook.

## Assumptions

- Il contratto di estrazione vive in `packages/scripts/src/contracts/<nome>.extract.ts`, non in un package nuovo.
- `repeat` legge il primo layer come modello e pretende che gli altri siano identici; la skill lo dice al designer.
- I comandi restano invocati come `pnpm --filter @penpot-ds/scripts <cmd>`; `verify:library` diventa `extract --check`.

## Open Questions

- Nessuna aperta al 2026-09-16. Le quattro iniziali (headless, posizione, convivenza, assi `state`) sono chiuse nel memlog.
