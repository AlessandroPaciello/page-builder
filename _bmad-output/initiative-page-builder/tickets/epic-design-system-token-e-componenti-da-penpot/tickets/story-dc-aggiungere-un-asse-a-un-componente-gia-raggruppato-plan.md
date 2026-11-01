---
title: 'DC: aggiungere un asse a un componente già raggruppato'
type: 'feature'
ticket: '39'
created: '2026-11-01'
status: 'done'
baseline_revision: '672cb7d061f2be59eb5f1785abb239e191bc717b'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 1
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** DC sa disegnare celle e raggrupparle con `group_variants`, ma non aggiungere una proprietà a un container di varianti che esiste: `group_variants` risponde «già raggruppato» e nessuna reference descrive la sequenza, quindi la Multiselect resta senza l'asse `search` che il pannello ha già.

**Approach:** la voce DC impara la procedura in `draw-component.md` — leggi gli assi, aggiungi la proprietà, dai il default alle celle esistenti, adatta o disegna le celle del valore nuovo passando l'istanza annidata alla variante, verifica, mostra e chiedi il sì — e la prova sulla Multiselect in un file duplicato. Il server `pds` non cambia: `group_variants` resta l'unica scrittura del server, la procedura è `execute_code` come il resto di DC.

## Boundaries & Constraints

**Always:** si legge prima di scrivere; una conferma per ogni scrittura mostrata; prova solo su un **file duplicato**, non su una pagina duplicata; dopo la scrittura si rilegge — nessun `variantError`, ogni variante con tutti gli assi ai valori attesi, nomi delle celle e token invariati; `describe_component` legge i valori nuovi e `verify_component` dà il solo blocco «manca il contratto».

**Never:** niente plugin data `pagebuilder`, token, contratto o fingerprint (2.37 e MS); niente `addVariant()` (eredita geometria, stili e token); nessuna rinomina delle celle, nessun ritocco alle celle che l'asse non riguarda; nessuna skill nuova, nessuno strumento nuovo nel server `pds`; le tre copie della skill restano identiche.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Asse aggiunto | container con celle, asse assente | proprietà sugli assi, default su ogni variante, celle del valore nuovo adattate o disegnate | rilettura: nessun `variantError` |
| Asse già presente | seconda esecuzione | lo dichiara già presente e non scrive | nessuna scrittura |
| Nome o valore non ammesso | nome già presente, fuori `IDENTIFIER` o riservato; valore non concordato | rifiuto che nomina proprietà o cella | nessuna scrittura |
| Valore concordato non disegnato | manca la cella di quel valore | la cella si disegna da zero e si aggiunge al container | non è un rifiuto |
| Più container omonimi | file con pagina duplicata | errore che nomina i container | nessuna scrittura |

</frozen-after-approval>

## Code Map

- `skills/pds/pds-design/references/draw-component.md` -- sorgente di DC: passo 6 (24-36) resta il raggruppamento; la sezione nuova va dopo il passo 7 (riga 37, l'ultima di `## Disegno`, che comincia alla riga 15) e prima di `## Esito` (39); `## Non fai` (43-48) riceve l'eccezione alla riga 46; stile: italiano, imperativo, «chiamata separata» per le verifiche, una conferma per scrittura.
- `skills/pds/pds-design/SKILL.md:40,56` -- tabella delle voci e Riferimenti: la procedura è un caso di DC, non una voce nuova.
- `skills/pds/pds-design/references/kit-wrappers.md:28` -- il limite «mutare le varianti può corrompere il file» resta la condizione (duplicare il **file**, fermarsi se la chiamata non torna).
- `.agents/skills/pds-design/`, `.claude/skills/pds-design/` -- copie identiche alla sorgente (`diff -r`), come nella 2.36.
- `packages/scripts/src/core/group-variants.ts:117-138,214-217` -- `parseCellName`/`cellName`: forma `Component / Axis=Value`, ordine delle proprietà, nomi completi che la procedura cita; sola lettura.
- `skills/pds/pds-design/references/contract-rules.md:40` -- `IDENTIFIER` e nomi riservati: la procedura rinvia qui.

## Tasks & Acceptance

**Execution:**
- [x] `skills/pds/pds-design/references/draw-component.md` -- sezione «Aggiungere un asse a un container esistente»: la lettura di sola lettura registra anche **nomi e `shape.tokens`** delle celle (la baseline del confronto finale) e le `variants.properties` dei componenti annidati; mostra la matrice e concorda nome/valori/default e quali celle mostrano il valore nuovo, poi «Procedo?»; rifiuta senza scrivere l'asse già presente, il nome fuori `IDENTIFIER` o riservato, il valore non concordato; poi (1) `container.variants.addProperty()`, attesa che la proprietà compaia, **poi** `renameProperty(pos, nome)` e attesa del nome; (2) `setVariantProperty` su ogni voce di `container.variants.variantComponents()` e attesa della rilettura dei `variantProps`; (3) celle del valore nuovo: `switchVariant` sull'istanza annidata con l'indice della proprietà **della variante annidata**, oppure cella costruita da zero, `penpot.library.local.createComponent([board])`, `container.appendChild(istanza principale)`, `setVariantProperty` per ogni asse e rilettura (cambiare l'istanza annidata riporta l'asse nuovo al valore iniziale); (4) verifica in chiamata separata: nessun `variantError`, assi nell'ordine contratto → rendering → `state` → asse nuovo, nomi e token come la baseline, poi `describe_component` e `verify_component` — dicendo che il solo blocco «manca il contratto» vale **finché il container non ha `pagebuilder/contract`**, perché un asse non dichiarato (2.37/MS) sarebbe un blocco «asse estraneo»; (5) mostra l'esito e cosa resta a MS/`pds-code` -- il testo della procedura
- [x] `skills/pds/pds-design/references/draw-component.md` -- riga di `## Non fai`: aggiungere un asse al container esistente è la sola eccezione, con la conferma come condizione -- la regola resta
- [x] `skills/pds/pds-design/{SKILL.md,references/kit-wrappers.md}` -- una riga nella voce DC e nel limite dei salvataggi che rimanda alla procedura; la `description` di `SKILL.md` aggiunge la frase «aggiungi un asse al componente» -- instradamento
- [x] `.agents/skills/pds-design/`, `.claude/skills/pds-design/` -- copie identiche (`diff -r` vuoto) -- la skill installata è la stessa
- [x] prova live: la Multiselect sul file duplicato ha già `search` dalla prima prova, quindi **non si riscrive** — si rilegge lo stato (assi, 12 celle, `describe_component`, `verify_component`), si conferma il rifiuto «già presente» e si annota che il ramo «cella nuova» non è stato esercitato dal vivo -- la prova della voce

**Acceptance Criteria:**
- Given un container con celle e senza l'asse, when la procedura aggiunge `search`, then ogni variante porta `search=false`, le due celle aperte `md` e `sm` portano `search=true` col pannello `search=true`, e le altre celle — quelle che non mostrano il valore nuovo — non cambiano nome né token.
- Given la procedura eseguita, when si ripete, then l'asse è dichiarato già presente e non si scrive niente.
- Given un nome già presente, fuori `IDENTIFIER` o riservato, o un valore non concordato, when si esegue, then rifiuta nominando la proprietà o la cella senza scrivere; un valore concordato e non disegnato si disegna.
- Given le celle dopo la procedura, when `describe_component` e `verify_component`, then legge `search` su ogni cella e l'unico blocco è «manca il contratto».
- Given le copie `.claude` e `.agents`, when si confrontano con `skills/pds/pds-design`, then sono identiche.

## Implementation Notes

- 2026-11-01 — prova live sul file Penpot duplicato «tailwind (copia)», Multiselect: `addProperty` + `renameProperty(4, "search")`, `false` su tutte e 12 le celle, pannello `search=true` nelle due celle aperte (`size=md` e `size=sm`, `open=true`, `display=chips`, `state=default`). Rilettura: 12 celle, nessun `variantError`, nomi e token invariati; `describe_component` legge `search` su ogni cella e `verify_component` dà il solo blocco «manca il contratto». Una seconda esecuzione dichiara l'asse già presente e non scrive.
- La prova ha mostrato due cose, ora nella reference: cambiare l'istanza annidata riporta il valore della cella per l'asse nuovo al valore iniziale, quindi `setVariantProperty` si rifà e si rilegge dopo `switchVariant`; le due celle aperte crescono di 33 px (pannello `search=true` 206 px contro 173 px) e, con la griglia a posizioni manuali, la cella `md` tocca la riga sotto e la `sm` esce dal container di ~3 px. Le celle che l'asse non riguarda non sono state spostate: la disposizione resta al designer.
- 2026-11-01 — riprova di sola lettura sul file «tailwind (copia)», dopo la stesura della reference: container `Multiselect` con assi `size, open, display, state, search` (l'asse nuovo è l'ultimo), 12 celle, nessun `variantError`; `search=true` sulle due celle aperte `md` e `sm` (`open=true`, `display=chips`, `state=default`) col pannello annidato `content=options, search=true`, `search=false` sulle altre 10. `describe_component` legge `search` su tutte e 12; `verify_component` dà il solo blocco «manca il contratto». Il guard della procedura («asse già presente») rifiuta senza scrivere: `properties` contiene `search`. Il ramo «cella nuova» resta non esercitato dal vivo.

## Plan Change Log

- 2026-11-01 (loop 1, quick) — finding: l'AC 1 diceva «nessuna cella cambia aspetto», mentre le due celle adattate crescono di 33 px perché il pannello `search=true` è più alto (Implementation Notes); il Code Map indicava `## Disegno` alla riga 37, che è il passo 7 (il titolo è alla 15). Amended: AC 1 ristretto alle celle che non mostrano il valore nuovo; Code Map corretto; task riscritti con i referenti delle API (`createComponent` prima di `appendChild`, `pos` della variante annidata, attese fra `addProperty`/`renameProperty`/`setVariantProperty`, baseline di nomi e token, ordine degli assi, avvertenza sul container già taggato, frase d'ingresso nella `description`). Known-bad avoided: una procedura che non si esegue sul ramo «cella nuova» e un build record con un criterio impossibile. KEEP: la sezione «Aggiungere un asse a un container esistente» e la sua collocazione dopo il passo 7; la prova live e le due scoperte empiriche (cambiare l'istanza annidata riporta l'asse nuovo al valore iniziale; +33 px e sovrapposizione lasciata al designer); le righe in `SKILL.md` e `kit-wrappers.md`; le copie allineate; le Implementation Notes esistenti.

## Review Triage Log

Pass 1 (quick): 0 high, 6 medium, 5 low, 0 false.

| Verdetto | Rotta | Esito |
|---|---|---|
| medium | patch | Ramo «cella nuova» non eseguibile: `appendChild` da solo non crea una variante e `setVariantProperty` esiste solo su `LibraryVariantComponent`; serve `penpot.library.local.createComponent([board])` prima di `appendChild`, `component` è una voce di `container.variants.variantComponents()` e `istanzaPrincipale` non aveva referente. Assorbito nel task 1 riscritto (loopback bad_plan). |
| medium | patch | `shape.switchVariant(pos, …)`: `pos` è l'indice della proprietà della variante annidata, non del container; la lettura non raccoglieva `variants.properties` dei componenti annidati. Assorbito nel task 1 riscritto. |
| medium | patch | `addProperty()` seguito subito da `renameProperty`: manca l'attesa che la proprietà compaia (in `GROUP_VARIANTS_SOURCE:290-295` c'è). Assorbito nel task 1 riscritto. |
| medium | patch | Dopo `setVariantProperty` si rileggeva subito: la mutazione è asincrona (come in `group-variants.ts:304-313`). Assorbito nel task 1 riscritto con l'attesa. |
| medium | patch | «`verify_component` dà il solo blocco manca il contratto» vale solo per un container senza `pagebuilder/contract`: con il dato, `normalizeCells` (`verify.ts:333-334`) dà «Asse search estraneo» finché 2.37/MS non lo dichiara. Assorbito nel task 1 riscritto. |
| low | patch | Il passo 4 chiedeva nomi e `shape.tokens` «come prima della scrittura», ma la lettura non li registrava: nessuna baseline. Assorbito (la lettura li registra). |
| low | patch | «Ordine atteso» non definito e la regola dei nomi completi del passo 3 vale per le celle sciolte, non per le varianti; dopo l'aggiunta i nomi non si rinominano. Assorbito (ordine contratto → rendering → `state` → asse nuovo, nomi invariati). |
| low | bad_plan | AC 1 diceva «nessuna cella cambia aspetto» ma le due celle adattate crescono di 33 px: criterio impossibile come scritto. Corretto l'AC (le altre celle). |
| low | patch | La `description` di `SKILL.md` non dà una frase d'ingresso per «aggiungi un asse»: chi lo chiede non instrada la skill. Assorbito (frase aggiunta nel task 3). |
| low | bad_plan | Code Map: «`## Disegno` (37)» indica il passo 7, non il titolo (riga 15). Corretto. |
| medium | defer | Con `search` nel contratto (2.37) le due celle `search=true` sono `open=true`: per `verify.ts:353-357` servirebbe una cella base con gli stessi assi e `open=false`, altrimenti «Cella di rendering senza la cella base». È del disegno di 2.37, non di questa procedura: registrato in `deferred-work.md`. |

Pass 2 (quick, dopo il loopback bad_plan): 0 high, 5 medium, 1 low, 1 false.

| Verdetto | Rotta | Esito |
|---|---|---|
| medium | patch | `description` del comando `.opencode/commands/pds-design.md` e riga DC dei due `module-help.csv` non avevano la procedura nuova: la frase d'ingresso non arrivava al comando. Allineati alla `description` della skill e alla riga DC. |
| medium | patch | La posizione della proprietà si ricavava da `variants.properties`, che non è ordinato (`group-variants.ts:83-88`): indice sbagliato e `renameProperty`/`switchVariant` sull'asse sbagliato. Passi 1 e 3 ora usano le chiavi di `variantProps` (`propsOf`/`variantMap`). |
| medium | patch | Nel ramo «cella che esiste» non si scriveva mai il valore nuovo («rifai `setVariantProperty`» senza valore, default) e l'istanza annidata non era identificata: le due celle aperte non arrivavano a `true`. Ora `setVariantProperty(pos, valore)` dopo `switchVariant`, col componente d'origine come riconoscimento. |
| medium | patch | `istanzaPrincipale` restava senza referente e il receiver di `setVariantProperty` non era detto (residuo del primo giro, claim più stretto): legata a `createComponent([board]).mainInstance()` e al `variantComponents()` filtrato per `mainInstance().id`. |
| low | patch | La verifica chiedeva nomi e token «uguali alla baseline» anche per la cella nuova, che nella baseline non c'è: confronto limitato alle celle esistenti al passo 1. |
| medium | patch | Il passo 6 diceva che `Multiselect Panel` resta un componente singolo, mentre la sezione nuova usa le varianti annidate: verificato dal vivo (`isVariantContainer`, 4 celle `content` × `search`) e corretto; `singolo` resta per una board davvero senza celle. |
| false | — | AC 4 senza la condizione «finché manca `pagebuilder/contract`»: la procedura ammette solo il file duplicato, che non ha il plugin data (verificato: `verify_component` dà solo quel blocco), quindi l'AC è raggiungibile nel suo stato; la condizione è scritta nella reference al passo 5. |

## Design Notes

La reference e non uno strumento: la decisione del ticket è che «la procedura vive nella voce DC», e `group_variants` resta l'unica scrittura del server (test `pipeline-boundary`, README del server). La parte nuova è la sequenza, non il punto in cui passa.

API (lette con `penpot_api_info`): `Variants.addProperty`/`renameProperty`, `LibraryVariantComponent.setVariantProperty`, `Shape.switchVariant` (l'indice è della proprietà **della variante annidata**), `VariantContainer.appendChild`; `addVariant` vietato. Sono asincrone: dopo `addProperty` si attende che la proprietà compaia, dopo `renameProperty` che abbia il nome giusto (come in `GROUP_VARIANTS_SOURCE`), dopo `setVariantProperty` si attende la rilettura di `variantProps`. Una cella nuova si costruisce da zero, diventa componente con `penpot.library.local.createComponent([board])` e si aggancia con `appendChild` della sua istanza principale.

## Verification

**Commands:**
- `diff -r skills/pds/pds-design .agents/skills/pds-design && diff -r skills/pds/pds-design .claude/skills/pds-design` -- expected: nessun output

**Manual checks (if no CLI):**
- Prova live già eseguita sul **file Penpot duplicato** «tailwind (copia)» (Implementation Notes); la riprova è di sola lettura: la Multiselect ha `search` su tutte le celle, le due aperte `md`/`sm` col pannello `search=true`, una seconda esecuzione dichiara l'asse presente, `describe_component` legge `search` e `verify_component` dà il solo blocco `pagebuilder/contract`. Il ramo «cella nuova» resta non esercitato dal vivo: la sequenza è quella provata nel v6 (`createComponent` + `appendChild` + `setVariantProperty`).
