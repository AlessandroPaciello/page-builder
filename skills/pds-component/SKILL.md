---
name: pds-component
description: Crea o sincronizza un componente del design system Penpot→codice. Use when the user says "crea componente", "nuovo componente", "sincronizza componente", "riallinea il componente con Penpot", or wants the full lifecycle of a component (contratto, design, container Penpot, giudizio, binding, base, estrazione, render, barrel, gate).
---

# pds-component

Guida il ciclo di vita di un componente del design system con due voci:

- **[PC] Crea componente**: il componente non esiste né nel registry di `@app/contracts` né in Penpot. Si va dal contratto a `gates:render` verde.
- **[PS] Sincronizza componente**: il componente esiste. La voce legge il suo stato dagli script e segue il percorso che il **`kind`** di ogni problema indica.

L'esito lo decidono gli script di `packages/scripts`: exit code e `kind` nel report JSON. Il testo dei messaggi serve a chi legge, non a scegliere il percorso. Questa skill fa domande, lancia i comandi e si ferma sulle decisioni umane.

## Resolution rules

- `{project-root}` → la working directory del progetto.
- `{skill-name}` → il basename della directory di questa skill.
- `{scripts}` → `pnpm --filter @penpot-ds/scripts`, lanciato dalla root del progetto. I percorsi relativi dei comandi (`--snapshot`, `--json`) partono da `packages/scripts`, quindi per `--json` usa sempre un percorso assoluto.
- `<tmp>` → una directory temporanea con percorso assoluto, creata una volta per sessione con `mktemp -d`.
- `<Comp>` → nome PascalCase del componente (es. `Alert`). `<kebab>` → nome del contratto (es. `alert`, `accordion-item`).

## On Activation

1. Load config from `{project-root}/_bmad/config.yaml` (and `.user.yaml` if present). Use sensible defaults for anything missing rather than requiring configuration.
2. Chiedi quale voce serve, **[PC]** o **[PS]**, e per quale componente. Se il contratto `<kebab>` esiste già in `packages/contracts/src/registry.ts`, [PC] non si applica: proponi [PS].
3. Prerequisiti dei comandi live (`*:library`, `extract:component`, `adopt:variant`, `bump:contract`, `sync:design`, gate drift): Node 22 (`nvm use 22.23.1`), il token Penpot caricato da `.env`, il file Penpot della library aperto e il plugin MCP connesso. Chiedi conferma prima del primo comando live.

## [PC] Crea componente

Tutti i percorsi `src/…` e `data/…` sono relativi a `packages/scripts`.

### Domande (una alla volta, prima di scrivere qualsiasi file)

1. **Assi**: nome, tipo (`option`, `state`, `behavior`), valori e default di ognuno. I nomi sono in minuscolo e rispettano `/^[a-z][a-z0-9-]*$/`.
2. **Parti**: le parti a profondità 1 oltre a `root`, ognuna con il suo **ruolo** (`surface`, `text`, `icon`, `divider`: che cosa la parte è), e i field content con i loro default. Nessun field può chiamarsi come un attributo HTML globale (`title`, `id`, `hidden`, `lang`, …), perché il contratto lo rifiuta: proponi un nome alternativo (es. `heading` al posto di `title`).
3. **Dominio**: uno fra i domini del catalogo (Data Display, Inputs, Feedback, Layout, Navigation, Overlays), nella forma kebab usata da `ui/src/domains` (es. `feedback`).
4. **A11y**: `role` e `aria-*` statici (es. `role="alert"` per un messaggio bloccante, `role="status"` per un'informazione). Se il role cambia con un asse `option`, è una mappa `{ "axis": "<asse>", "values": { "<valore>": "<role>", … } }` che copre tutti i valori dell'asse (es. Alert: `status` per info/success, `alert` per warning/error). Arrivano nel `.tsx` e il gate a11y verifica che ci siano, variante per variante.
5. **Aspetto delle celle**: per ogni cella del prodotto cartesiano e per ogni parte, le proprietà `proprietà → token` con i token che esistono già nel catalogo. Non inventare valori: se un valore non ha un token, è una domanda per il designer, e nel design non entra nessun literal.
6. **Base shadcn**: il componente da `npx shadcn add <comp>`, se esiste. Se non c'è una base headless e il componente ha logica propria, è un componente custom e la pipeline non lo genera: fermati e riportalo.

### Passi (ognuno ha il suo comando o file e il suo esito)

1. **Contratto**: `packages/contracts/src/components/<kebab>.ts` sul modello di un contratto esistente (es. `badge.ts`), con i ruoli delle parti in `partRoles` (domanda 2) e la registrazione in `packages/contracts/src/registry.ts`. Un contratto nuovo cambia il fingerprint: alza `SCHEMA_VERSION` (N→N+1) e lancia `pnpm --filter @app/contracts test`. Il test fallisce e stampa l'hash del payload corrente ("hash attuale: …"): quell'hash entra in `contracts.fingerprint.json` come voce **nuova** `"N+1"`, in coda. Le voci esistenti non si riscrivono mai. Rilancia il test, che deve essere verde.
2. **Design**: `data/designs/<kebab>.design.json` con le celle e i token delle risposte alla domanda 5. Le parti del design portano solo il layout di partenza (`parent`, `text`, `size`, `dir`, `align`): il tipo di shape viene dal ruolo nel contratto, niente `kind`. Il test di copertura design↔registry deve essere verde.
3. **Container in Penpot**: lancia la skill `pds-additive`. `add:library` crea il container col plugin data e `verify:library` deve essere verde. Contrasto: la regola 10 misura il componente sui token live di Penpot, cella per cella (testo e icone contro la superficie che li contiene, grazie al ruolo delle parti). Una voce rossa con `kind: contrast` va al designer.
4. **Snapshot committato**: chiedi conferma, perché il comando sovrascrive un file committato. Poi `{scripts} verify:library --write-snapshot data/library.snapshot.json` (lettura live) e mostra il `git diff` dello snapshot. Senza questo passo il test CI sullo snapshot committato resta rosso.
5. **Giudizio**: `data/recipes/judgments/<kebab>.json`, con il dominio e l'a11y delle domande 3 e 4.
6. **Base**: `npx shadcn add <comp>` e copia dei sorgenti in `data/bases/<base>/`, sul modello delle basi esistenti.
7. **Binding**: `data/bindings/<kebab>.binding.json`, cioè la base, le parti del contratto verso le parti della base, i valori d'asse verso l'API e, se un layer ha un nome diverso dalla parte, gli alias (`parts.<parte>.aliases`).
8. **Estrazione**: `{scripts} extract:component -- <Comp>` scrive fixture e ricetta e fallisce senza scrivere se qualcosa non torna.
9. **Render**: `{scripts} render:component -- <Comp>` scrive `.tsx`, test, story e barrel del dominio, marcati `@generated`.
10. **Barrel**: aggiungi l'export in `packages/ui/src/domains/index.ts`, l'unico file scritto a mano.
11. **Gate**: `{scripts} gates:render --json <tmp>/gates.json`. [PC] è finita solo con exit 0 e la voce `<Comp>` in stato `ok`. Se un passo fallisce, riporta l'errore dello script e torna al passo che lo causa (design, giudizio, binding). Non si corregge mai un file generato.

## [PS] Sincronizza componente

### Lettura dello stato

1. `{scripts} verify:library --json <tmp>/verify.json` (lettura live; senza Penpot usa `--snapshot data/library.snapshot.json`).
2. `{scripts} gates:render --json <tmp>/gates.json`.
3. Leggi le voci di `<Comp>` nei due JSON: `status` e, per ogni problema, `kind`. Una riga `global` rossa (coppie di contrasto del catalogo, suite a11y) blocca: riportala come bloccante, perché porta l'exit a 1.
4. Esito: "allineato" solo se `<Comp>` è `ok` in entrambi, **e** entrambi i JSON hanno `exitCode` 0, **e** la lettura è stata live (niente `--snapshot`, nessuna nota `Gate drift SKIPPED` in `notes`). Se la lettura non era live, chiudi con "non verificato live" e il motivo, mai con "allineato".

### Percorso per `kind` (si parte dalla prima riga che corrisponde)

| `kind` | Percorso |
|---|---|
| `contract-version` | Regola A: `{scripts} bump:contract -- <Comp>` in dry-run, mostra `atteso` e `trovato`, poi `--yes` solo con la conferma dello sviluppatore. Dopo, rileggi lo stato. |
| `variant-not-adoptable` | Valore in più su un asse `state`/`behavior`: `adopt:variant` non lo adotta. Fermati e porta la domanda al designer. |
| `variant-not-adopted` | **Decisione umana**: il valore entra nell'editor? Se sì, lancia `{scripts} adopt:variant -- <Comp> --dry-run`, mostra il diff dei file e poi `--yes`, quindi estrazione, render e gate (vedi `drift`). Se no, il componente resta in attesa e la variante va tolta in Penpot dal designer. |
| `missing-cell-blocked` | Riporta il blocco così come lo nomina il messaggio e fermati: se il blocco è un plugin data non corrente, lo stesso componente ha anche `contract-version`, che la riga sopra tratta per prima. |
| `missing-cell-undesigned` | La cella non c'è né in Penpot né nel design. Porta la domanda al designer: la combinazione va disegnata? Non inventare la cella. La risposta torna nel design come in [PC] passo 2. |
| `missing-cell` | Lancia la skill `pds-additive`: `add:library` crea la cella (`addCell`). Poi rileggi lo stato. |
| `cell-not-in-contract` | Blocco e domanda al designer: la cella è fuori dal prodotto cartesiano del contratto. Non si inventa nulla. |
| `blocked-property` | Indica come si sblocca, cioè una riga del registro in `src/shared/style-properties.ts` con stato `supported`, la mappatura dell'emitter e un test rosso/verde nella stessa PR, e chiedi la decisione. Nessuna modifica automatica. |
| `property-outside-role` | Un token sta su una proprietà che il ruolo della parte non ammette. Riporta il messaggio (componente, cella, parte, ruolo, proprietà, token) e proponi i tre adattamenti **in quest'ordine**, senza correggere nulla: 1) il designer sposta il token in Penpot su una proprietà ammessa (poi rileggi lo stato); 2) se il design è voluto, lo sviluppatore insegna la proprietà al ruolo: una riga di `ROLE_PROPERTIES` in `src/shared/style-properties.ts`, la mappatura dell'emitter e un test rosso/verde nella stessa PR; 3) se la parte è d'altro tipo, `{scripts} role:part -- <Comp> <parte> <ruolo>` mostra il diff (contratto, `SCHEMA_VERSION`, fingerprint) e poi `--yes` solo con la conferma dello sviluppatore. **Decisione umana**: fermati finché non sceglie. |
| `drift` | `{scripts} extract:component -- <Comp>`, poi `{scripts} render:component -- <Comp>`, poi mostra `git diff` di fixture, ricetta e file generati e lancia `{scripts} gates:render --json <tmp>/gates.json`, che deve dare exit 0. Il design committato (`data/designs/<kebab>.design.json`) non si aggiorna con questo percorso: se poi `verify:library` segnala `design-drift`, segui quella riga. |
| `design-drift` | Il design committato diverge da Penpot. `{scripts} sync:design -- <Comp>` stampa il diff (celle del design ↔ Penpot live), poi `--yes` con la conferma dello sviluppatore riscrive `data/designs/<kebab>.design.json` (solo le celle, tmp + rename). Non scrive mai su Penpot. Poi rileggi lo stato. |
| `contrast` | Una coppia testo/icona × superficie è sotto soglia sui token live di Penpot (voce rossa). Riporta cella, parti, token e rapporto: la correzione è del designer in Penpot (token del testo o della superficie). Non si corregge nulla qui. Fermati. |
| `snapshot-stale` | Chiedi conferma: il comando sovrascrive un file committato. Poi `{scripts} verify:library --write-snapshot data/library.snapshot.json` (lettura live), mostra il `git diff` dello snapshot e rileggi lo stato. |
| `gate-failed` | Riporta il gate e il messaggio. La correzione sta nella ricetta, nel binding, nel giudizio o nel design, mai nel file generato. Fermati. |
| `pending` | In attesa di altro: riportalo senza correggere nulla. |
| `other` o un `kind` sconosciuto | Riportalo così com'è e fermati. |

Dopo ogni percorso che scrive, rileggi lo stato (passi 1–4) finché `<Comp>` non è `ok` o non resta solo un percorso che si ferma su una decisione. Se dopo il suo percorso si ripresenta lo stesso `kind`, fermati e riportalo: il percorso non l'ha risolto.

## Guardrail

- Questa skill non chiama mai `execute_code` per scrivere su Penpot: le scritture passano solo da `add:library` (tramite `pds-additive`) e da `bump:contract`.
- I contratti e i design si scrivono solo in [PC], dalle risposte dello sviluppatore, oppure con `adopt:variant`, `role:part` (ruolo di una parte) e `sync:design` (celle del design da Penpot), mai con codice improvvisato. Nessuna cella inventata, nessuna proprietà fuori ruolo corretta in automatico.
- Nessuna correzione di un componente in attesa: la decisione è umana.
- I file `@generated` non si modificano mai a mano: si cambiano ricetta, binding o fixture e si rigenera.
- Pass/fail e percorso li danno gli script (exit code e `kind`), mai questo prompt.
- I comandi live (`*:library`, `extract:component`, `adopt:variant`, `bump:contract`, `sync:design`) si lanciano su richiesta, mai in CI né in build.

<!-- module-code: pds -->
<!-- phase-name: anytime -->
<!-- after: pds-additive:add -->
<!-- is-required: false -->
