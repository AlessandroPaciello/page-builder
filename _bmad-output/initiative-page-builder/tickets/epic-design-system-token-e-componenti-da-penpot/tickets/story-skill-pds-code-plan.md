---
title: 'Skill `pds-code`'
type: 'feature'
ticket: '29'
created: '2026-11-02'
status: 'done'
baseline_revision: 'e4118c2b16381269668e89d616af298dc288c5ea'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-page-builder/spec-page-builder/penpot-pipeline.md', '{project-root}/packages/scripts/src/server/README.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `pds-design` porta tema e componenti in Penpot, ma nessuna skill fa il viaggio verso il codice. Le domande del nucleo (`part`, `repeat`, `element`, `slot`, `asse`, `fillInHug*`, `overflow`) e il `pagebuilder/contract` mancante restano senza risposta, perché nessuno scrive i plugin data. Il gate finale non esiste come comando unico.

**Approach:** nuova skill `pds-code`, sorella di `pds-design`, con le voci ET (estrai tema → `extract_theme`), VC (verifica → `verify_component`), GC (genera in `build_order` → `generate_component`, giudizio in Storybook), AC (riallinea `styles.ts`, diff al TSX solo su richiesta) e GA (gate). Le risposte alle domande e il `contract` si scrivono come shared plugin data `pagebuilder` via `execute_code` del server `penpot`, una per conferma.

## Boundaries & Constraints

**Always:** la skill non scrive mai un file `@generated` a mano: li scrivono `generate_component` ed `extract_theme`. Ogni scrittura di plugin data è mostrata prima (layer, chiave, valore) e passa da un sì; un sì vale solo per ciò che è stato mostrato. Scrive solo le chiavi `contract`, `part`, `repeat`, `element`, `slot`, `when`, `asse.<field>`, `fillInHugH`/`fillInHugV`, `overflow`, mai stile, geometria, layer o token. GC rispetta `build_order`. "testo + colore" è una voce fissa del giudizio in Storybook. On activation come `pds-design` (config `pds`, server `pds` e `penpot`, plugin connesso, una sola lettura).

**Decisioni (2026-11-02):** (1) La misura di quali operazioni di Penpot cancellano i plugin data `pagebuilder` è il primo task: raggruppa, booleana, copia tra file, ripristino di versione, stacco dell'istanza, duplica → resta / si perde / in parte, sul campione nell'istanza di collaudo, con Alessandro per le operazioni da UI. L'esito va nel README del collaudo e in `penpot-pipeline.md` § CI e collaudo, e la procedura del collaudo lo ripete come checklist. Nessuna scrittura di plugin data sul file vero prima dell'esito. (2) Due test nuovi accanto a `theme-in-css.test.ts`, ciascuno con prova rosso/verde: contrasto ≥ 4.5:1 sulle coppie di ruolo del tema (`X`/`X-foreground`), e ogni famiglia di `fonts.css` con il suo `@fontsource/*` in `packages/tokens/package.json`. (3) axe bloccante su ogni story `@generated` entra qui, anticipato dalla 2.30, con prova rosso/verde: GA = `check-types` + `test` (con dentro tema nel CSS, contrasto, font e axe). (4) Il componente reale è la Multiselect intera: Chip, Checkbox, Option, Multiselect Trigger, Multiselect Panel e Multiselect, generati in `build_order`. (5) Fuori: deduzione di `when` e layer nascosti, override nel campione (alla 2.38), `build_order` per le sezioni (alla 2.31); il reinstradamento si registra in coda a `deferred-work.md`. (6) La coppia `muted`/`muted-foreground` (4.35:1 nel tema Penpot) è controllata a 3:1 come superficie tenue (WCAG 1.4.11); `muted-foreground` resta a 4.5:1 su `background` e `card` (deciso da Alessandro dopo l'implementazione). (7) La prova live di GC/AC/GA si fa su **Chip**, non sulla Multiselect intera: la checkbox ha l'anello di focus disegnato come contenitore e il nucleo la blocca («`icon-check` in rami diversi»), e dietro di lei si ferma tutta la Multiselect. Il disegno va a `pds-design` come finding; la Multiselect intera si genera dopo la correzione (deciso da Alessandro il 2026-11-02, durante la prova live). I `contract` sui sei container e le `part` della checkbox restano scritti.

**Never:** nessuna scrittura di plugin data dentro `packages/scripts` (il gate `pipeline-boundary.test.ts` resta). Nessuna modifica al nucleo né al server `pds`. Il TSX dello sviluppatore non si tocca senza richiesta.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Domanda | `verify_component` dà `domanda` `part` con opzioni | le opzioni mostrate, scelta, anteprima `setSharedPluginData` sul layer, sì, scrittura, rilettura con `describe_component` | senza sì non scrive nulla |
| Contratto mancante | blocco «manca il contratto» | propone `nome@versione` dal registro, scrive sul container dopo il sì | nome assente dal registro → si ferma e manda a `pds-design` CN/CD |
| GC con domande aperte | `generate_component` dà `written: []` | torna a VC, nessun file | — |
| GC ordine | componente che contiene istanze | `build_order` prima, si genera nell'ordine | blocco di `build_order` → stop |
| GA | un controllo rosso | GA riporta rosso con il comando che è fallito | nessun "verde" parziale |

</frozen-after-approval>

## Code Map

- `skills/pds/pds-design/SKILL.md`, `references/*.md` -- modello da imitare: frontmatter `name`/`description` a invocazione esplicita, sezioni `Resolution rules`, `Su cosa non si transige`, `On activation`, `Le voci` (tabella), `Riferimenti`; reference `# XX — Titolo`, `## Ingresso`, passi, `## Non fai`.
- `.agents/skills/pds-design/`, `.claude/skills/pds-design/` -- copie installate, committate e identiche alla sorgente: `pds-code` va copiato uguale in entrambe.
- `.opencode/commands/pds-design.md` -- stub del comando (`@skills/pds-design`): serve `pds-code.md`.
- `skills/.claude-plugin/marketplace.json` -- array `skills` del plugin `pds`: una skill assente qui l'installer la ignora.
- `skills/pds/pds-setup/assets/module-help.csv`, `_bmad/pds/module-help.csv`, `_bmad/module-help.csv` -- righe per voce (formato delle righe `pds-design`). `skills/pds/pds-setup/assets/module.yaml:10` elenca le voci di pds-design: aggiungere quelle di pds-code.
- `packages/scripts/src/server/tools.ts:37-76`, `server.ts:138-200` -- strumenti `pds`: `generate_component` scrive solo senza `blocco`/`domanda` (`server.ts:175`); `extract_theme` scrive `packages/tokens/src/` senza gate.
- `packages/scripts/src/core/verify.ts:553-594,854-860,914`, `section.ts:57-137,177-210`, `registry.ts:101-133,322`, `geometry.ts:158,340-355` -- domande e chiavi che le risolvono; `asse` si salva come `asse.<field>` sul container; il resto sul layer.
- `packages/scripts/src/penpot/read-component.ts:145-158,301,365` -- come si rileggono i plugin data (tutte le chiavi stringa del namespace `pagebuilder`).
- `packages/contracts/src/registry.ts`, `verify.ts:137-148` -- formato `nome@versione` del contract.
- Gate esistenti: `pnpm check-types`, `pnpm test`, `packages/ui/src/styles/theme-in-css.test.ts` (tema nel CSS), `packages/scripts/src/shared/extract-theme.test.ts` (pacchetti font, solo unità). Contrasto: nessun controllo. axe: solo `packages/ui/src/editor/dropdown-menu.test.tsx` (modello d'uso di `vitest-axe`).
- `packages/scripts/collaudo/README.md`, `penpot-pipeline.md:104` -- dove registrare la misura dei plugin data.

## Tasks & Acceptance

**Execution:**
- [ ] Misura dei plugin data (decisione 1) -- `packages/scripts/collaudo/README.md`, `penpot-pipeline.md:104` -- precondizione delle scritture.
- [x] `packages/ui/src/styles/theme-contrast.test.ts`, `packages/ui/src/styles/fonts.test.ts` -- decisione 2 -- leggono `packages/tokens/src/theme.css`/`fonts.css` e `packages/tokens/package.json`.
- [x] `packages/ui/src/domains/stories-axe.test.tsx` -- rende ogni story `@generated` di `domains/` (composeStories) e la passa a `vitest-axe`; bloccante, con prova rosso/verde -- decisione 3.
- [x] `skills/pds/pds-code/SKILL.md` -- skill con le cinque voci e le regole qui sopra -- è la consegna.
- [x] `skills/pds/pds-code/references/{theme-extract,verify,generate,align,gate,answers}.md` -- una reference per voce più `answers.md`: tabella domanda → chiave → shape → valore e lo snippet `execute_code` di scrittura e rilettura.
- [x] `.agents/skills/pds-code/`, `.claude/skills/pds-code/`, `.opencode/commands/pds-code.md`, `marketplace.json`, i tre `module-help.csv`, `module.yaml` -- installazione e registrazione.
- [x] `skills/pds/pds-design/SKILL.md` e copie -- dove dice «lo fa `pds-code`», nessun cambio di regole; solo se un rimando è sbagliato. (Verificato: nessun rimando sbagliato, nessuna modifica.)
- [ ] Prova live sulla Multiselect -- `contract` sui sei container, risposte, GC in `build_order` (file `@generated` + scaffold dei sei componenti in `packages/ui/src/domains/`), giudizio in Storybook, AC dopo un cambio di aspetto, GA verde; esito in Implementation Notes.
- [x] `deferred-work.md` (solo in coda) -- reinstradamento delle quattro voci (decisione 5).

**Acceptance Criteria:**
- Given la Multiselect e i cinque componenti che contiene, when si seguono VC e GC, then ogni domanda mostra le opzioni, la risposta è scritta in Penpot solo dopo il sì e riletta da `describe_component`, e `generate_component` scrive `styles.ts`, scaffold e story.
- Given un cambio di aspetto in Penpot, when si esegue AC, then `styles.ts` è rigenerato, il TSX resta identico byte per byte e i cambi suggeriti sono mostrati come diff senza essere applicati.
- Given il repo dopo GC, when si esegue GA, then tutti i controlli sono verdi; un contrasto sotto soglia, una famiglia senza pacchetto o una violazione axe in una story `@generated` lo rendono rosso.

## Implementation Notes

**Fatto.** Skill `pds-code` (SKILL.md + sei reference: `theme-extract`, `verify`, `generate`, `align`, `gate`, `answers`), copie identiche in `.agents/skills/pds-code` e `.claude/skills/pds-code`, comando `/pds-code`, registrazione in `marketplace.json`, nei tre `module-help.csv` e in `module.yaml`. Tre gate nuovi, ciascuno con prova rosso/verde: `packages/ui/src/styles/theme-contrast.test.ts` (coppie `X`/`X-foreground`, base e varianti), `packages/ui/src/styles/fonts.test.ts` (famiglia del tema → `@fontsource/*` in `packages/tokens/package.json` e `@import` in `fonts.css`), `packages/ui/src/domains/stories-axe.test.tsx` (ogni story `@generated` di `domains/` via `composeStories` + `vitest-axe`). Prova del rosso di axe fatta anche end-to-end con una story `@generated` temporanea in `domains/` (una `<button>` senza nome accessibile → `button-name`; con il testo → verde), poi rimossa.

**Gate di contrasto: una coppia reale sotto soglia.** Il gate nuovo ha trovato subito un difetto vero del tema: `color.muted-foreground` (`neutral.500`, `#737373`) su `color.muted` (`neutral.100`, `#F5F5F5`) dà **4.35:1**, sotto 4.5:1. Il valore è in `theme.css` (`@generated`) e in Penpot (letto dal vivo il 2026-11-02), quindi non si corregge qui: il test tiene quella coppia al pavimento non-test di WCAG 1.4.11 (3:1, `FLOORS = { muted: 3 }`) e verifica `muted-foreground` a 4.5:1 su `background`/`card` (4.74:1), dove il ruolo è usato; una variante che abbassa una coppia della base è rossa. La correzione del token in Penpot (e la rimozione dell'eccezione) è in `deferred-work.md`. **Decisione da confermare in review:** il piano dice «≥4.5:1 su `X`/`X-foreground`» senza eccezioni; con l'eccezione la suite resta verde come chiede la verifica della story, senza l'eccezione sarebbe rossa su un valore che solo il designer può cambiare.

**Non fatto — misura dei plugin data (decisione 1).** Il primo task richiede l'istanza di collaudo (secondo stack compose, porte del Penpot vero fermate) e Alessandro per le operazioni da UI (copia tra file, ripristino di versione). In questa sessione il Penpot vero è acceso e il plugin è connesso al file «tailwind»: fermarlo per avviare `penpot-collaudo` avrebbe interrotto il lavoro dell'utente, e la decisione vieta comunque le scritture di plugin data sul file vero prima dell'esito. Ho scritto la **procedura e la checklist** (§ *Operazioni che cancellano i plugin data* in `packages/scripts/collaudo/README.md`, passo 8 della procedura di aggiornamento, rimando in `penpot-pipeline.md` § CI e collaudo) con la tabella a sei righe in stato **da misurare**; nessuna riga è compilata a caso. Finché la tabella è «da misurare» `pds-code` non scrive plugin data sul file vero: il vincolo è scritto nel README e nella pipeline.

**Non fatto — prova live sulla Multiselect.** I sei container esistono nel file Penpot «tailwind» (Multiselect, Multiselect Trigger, Multiselect Panel, Chip, Option, Checkbox), ma `verify_component` su ognuno dà il solo blocco «manca il contratto»: nessuno ha `pagebuilder/contract`. Scrivere il `contract` sui sei container richiede un sì umano per ogni scrittura, e la decisione 1 lo vieta prima della misura; quindi niente `contract`, niente risposte, niente GC/AC/GA sul componente reale. Le story `@generated` in `domains/` sono ancora zero: il gate axe è pronto e verde, e si applica alla prima story generata (verificato con la story temporanea).

- **Misura dei plugin data eseguita (2026-11-02, sessione con Alessandro)** sull'istanza `penpot-collaudo` 2.18.3, su una copia del campione, con chiavi sonda `probe`. Raggruppa, duplica, booleana e stacco via plugin; copia tra file, ripristino di versione e un tentativo di stacco da UI. Esiti: resta per tutte tranne la booleana (in parte: il layer booleano nasce senza chiavi). Un'istanza annidata in un principale non si stacca. Tabella nel README del collaudo, esito in `penpot-pipeline.md:104`, precondizione aggiornata in `answers.md`. Per arrivare a una copia da staccare è stata creata un'istanza di `Etichetta` sul canvas della copia.
- **Prova live su Chip (2026-11-02).** VC: `contract` scritto sui sei container della Multiselect; checkbox bloccata (anello di focus come contenitore → `icon-check` in rami diversi), quindi decisione (7). Chip: 16 `part` + 8 correzioni (`plus-path`/`x-path`, perché `svg-path` in due icone era un blocco) + 4 `repeat=lista`, ognuna mostrata e riletta con `describe_component`; regola «stesso layer in più celle = una domanda» aggiunta ad `answers.md`/`verify.md`. GC: `generate_component` ha scritto `Chip.styles.ts`, `Chip.stories.tsx` e lo scaffold `Chip.tsx`; `tsc` e i test di `ui` verdi, axe gira sulle due story e passa. **Giudizio di Alessandro in Storybook: negativo** — non si vedono le icone e i testi non sono centrati. Cause lette dal disegno e dall'output: (a) i path delle icone sono linee 5×0.01 con tratto, il generatore le rende come `div` con `stroke-*` (che vale solo in SVG) e `icon-x`/`x-path` hanno `cva` vuote perché la croce esiste solo nelle celle `removable=true`; (b) la radice è hug in Penpot (`sizingH: auto`) ma esce `flex` senza `w-fit`/`inline-flex` e occupa tutta la riga; (c) `Label` è una casella di testo fissa 7×14 (43×14 con removable) e diventa `w-[7px] h-[14px]`; (d) solo 2 story, perché `removable` è asse di rendering e non entra nelle story.
- **Dopo il giudizio (2026-11-02).** Su richiesta di Alessandro `Chip.tsx` usa le icone lucide (`Plus`/`X`, tratto 1.5, colore dalla `cva` di `plus-path`), la prop `removable` (asse di rendering → `data-removable`) e `w-fit` sulla radice; diff mostrato e approvato. Cambio di aspetto in Penpot (via `pds-design`, una cella per chiamata, verifica separata, approvato): i 4 `Label` passano da *layout child* fix ad auto e prendono il token `font.sans` (`applyToken` con l'elenco di proprietà `["fontFamilies"]` viene rifiutato da Penpot 2.18.3, senza elenco funziona). **AC:** `generate_component` riscrive solo `Chip.styles.ts`; `label` passa da `data-[removable=true]:w-[43px] font-medium h-[14px] text-secondary-foreground text-xs w-[7px]` a `font-medium font-sans text-secondary-foreground text-xs`; `Chip.tsx` identico (sha256 `ac60b841…` prima e dopo); nessun suggerimento. In Storybook «Opzione ✕» corrisponde a Penpot. **GA:** `pnpm check-types` 11/11, `pnpm lint` 7/7, `pnpm test` 8/8 (axe sulle story del Chip incluso), con `pnpm db:start`.

## Plan Change Log

## Review Triage Log

### Review quick (2026-11-02, iterazione 0)

Verdetti: high 0 · medium 2 · low 4 · false 3 · rifiutati per regola (fix = modificare il plan) 3.

| # | Finding | Verdetto | Route | Evidenza / azione |
|---|---|---|---|---|
| 1 | Implementation Notes contraddittorie (prime note «non fatto», checkbox `[ ]`) | rifiutato | — | il fix è modificare il plan; lo stato vero è nelle note successive e nelle decisioni (6) e (7) |
| 2 | AC 1 parla della Multiselect, generato solo Chip | rifiutato | — | decisione (7) di Alessandro nel blocco frozen; il fix è modificare il plan |
| 3 | AC 2: «suggerimenti come diff non applicati» mai esercitato (nessun suggerimento) | low | defer | il caso richiede un cambio di struttura dal vivo; voce in `deferred-work.md` |
| 4 | Skill: «solo le `options`» è falso per `part` (`verify.ts:553-561` accetta ogni chiave kebab) | medium | patch | corretto in `SKILL.md`, `answers.md`, `verify.md` e copie |
| 5 | `answers.md`: `when` non dice che va uguale in tutte le celle (`verify.ts:431-446` blocca) | medium | patch | corretto in `answers.md` e copie |
| 6 | `when` fuori dai field «blocco» senza riscontro nel codice | false | — | `verify.ts:879-889` lo valida contro `contract.fields` |
| 7 | `gate.md`: esempio «3.9:1, sotto 4.0:1» con soglia inesistente | low | patch | esempio cambiato in `primary … 4.1:1, sotto 4.5:1` |
| 8 | `stories-axe.test.tsx`: commento vecchio e scoperta vacua, regex rotta = verde | low | patch | asserisce `generated.length > 0`, tolto il segnaposto `skipIf` |
| 9 | `Chip.tsx` non usa le `cva` `icon-plus`/`icon-x`/`x-path` | rifiutato | — | richiesta di Alessandro (lucide); la causa è nel deferred del generatore; il fix sarebbe annotare il plan |
| 10 | Solo 2 story, `removable=true` senza story né axe | low | defer (esistente) | già in `deferred-work.md` (story senza assi di rendering), stessa causa |
| 11 | `Chip` non esportato dal barrel `domains/` | false | — | coerente con `index.ts` (export alla 2.31), non è un difetto di questo cambio |
| 12 | GA senza `pnpm lint` contro la Verification del plan | false | — | decisione (3): GA = `check-types` + `test`; la Verification del plan è il controllo della build, non la definizione di GA |

Dopo le patch: copie della skill identiche, `pnpm check-types` 11/11, `pnpm lint` 7/7, `pnpm test` 8/8.

## Verification

**Commands:**
- `pnpm check-types && pnpm lint && pnpm test` -- expected: verdi.
- `diff -r skills/pds/pds-code .agents/skills/pds-code && diff -r skills/pds/pds-code .claude/skills/pds-code` -- expected: nessuna differenza.

**Manual checks (if no CLI):**
- Prova live con Penpot 2.18.3 e plugin MCP connesso: le scritture di plugin data sono visibili in `describe_component`, e la story è giudicata in Storybook.
