---
title: 'Story 2.8 parte C — estensione dell''emitter una volta per tutte: proprietà assenti in una variante'
type: 'feature'
created: '2026-09-13'
status: 'done'
route: 'dispatch'
baseline_commit: '7a43b9ad8036bf1fe146855ebea31076f079ea25'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/specs/spec-page-builder/penpot-pipeline.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** l'emitter non sa esprimere una variante senza una proprietà che il default ha (es. outline senza fill): `deriveFor` fallisce con "l'emitter non può esprimere la rimozione di una classe" (render-component.ts:382) e `assertCoveredByBase` blocca qualunque valore d'asse option non default (render-component.ts:196-207). Il design è però valido — fatto coi token — e la pipeline deve estendere l'emitter **una volta per tutte**, non per componente (penpot-pipeline.md:110).

**Approach:** quando una proprietà token è presente nella cella default di un asse `option` e assente da una cella non default, l'emitter produce per quel valore **classi per variante**: la classe del default (es. `bg-primary`) resta nella base `cva` e la variante aggiunge la classe che rimuove l'effetto (es. `bg-transparent` per fill). Un solo asse per proprietà, come oggi. Le proprietà `coveredByBase` restano bloccate per-variante: la verifica contro la base non cambia.

## Boundaries & Constraints

**Always:**
- Fail-loud nominativo invariato per tutto il resto: due assi sulla stessa proprietà, token literal, proprietà non registrata o bloccata, valore keyword.
- L'output dei tre componenti committati (Badge, Input, AccordionItem) resta identico byte per byte: `render:check` a diff zero.
- La classe di "rimozione" passa dal registro delle proprietà (una mappatura esplicita), non da un valore inventato: sbloccarla è una riga del registro + test rosso/verde.
- Ogni controllo nuovo ha la sua prova rosso/verde.

**Never:**
- Niente `compoundVariants`: una proprietà che varia con due assi resta non esprimibile.
- Nessun cambio al contratto Badge (outline resta fuori dal contratto: `badge@1` ha solo default/secondary/destructive) e nessuna scrittura su Penpot.
- Nessuna classe per variante per le proprietà `coveredByBase` (`strokeWidth`, `opacity`) né per le bloccate: il caso "variante con opacità diversa dal default" resta un blocco.
- Nessuna modifica a mano sui file generati di `packages/ui/src/domains`: si rigenerano con `render:component`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Variante senza fill | cella `variant=outline` senza `fill`, default con `fill: color.primary` | `bg-primary` in base cva; la variante outline emette `bg-transparent` | N/A |
| Assenza simmetrica | proprietà assente dal default e da un valore (caso di oggi) | nessuna classe da nessuna parte, nessun errore | N/A |
| Proprietà coveredByBase assente in variante | `strokeWidth`/`opacity` assente in una cella option non default | componente bloccato con errore nominativo | fail-loud |
| Due assi sulla proprietà | `fill` varia con `variant` e `size` | errore "interazione non esprimibile" invariato | fail-loud |
| Classe di rimozione non mappata | proprietà con assenza in variante ma senza mappatura di rimozione nel registro | errore nominativo che nomina proprietà, parte, cella | fail-loud |

</frozen-after-approval>

## Code Map

- `packages/scripts/src/emitter/render-component.ts` -- `deriveFor` (378-387) è il fail da trasformare; `deriveClass` (223-282) instrada sull'EmitRule; `computePartClasses` (326-496) costruisce base + varianti; `assertCoveredByBase` (183-214) blocca i coveredByBase per-variante (righe 195-207) — si lascia com'è.
- `packages/scripts/src/style-properties.ts` -- registro: `EmitRule` (49-68) riceve il nuovo ramo; riga `fill` (100-105) riceve la mappatura di rimozione.
- `packages/scripts/src/emitter/axis-influence.ts` -- `influencingAxes` conta già l'assenza come valore `<assente>` (riga 38): l'asse risulta influente, nessun cambio.
- `packages/scripts/src/token-vocabulary.ts` -- `TYPE_UTILITY_PREFIXES.color` include `bg` (riga 21): `bg-transparent` NON deriva dal vocabolario token (nessun token "transparent"); serve gestione esplicita della classe di rimozione.
- `packages/scripts/src/emitter/render-component.test.ts` -- test da estendere: "strokeWidth solo su un valore option non default: blocca" (74-82, resta rosso ma per la nuova via coveredByBase); instradamento Badge (127-149).
- `packages/scripts/src/library/adopt-variant.ts` -- validazione "proprietà presente nel default e assente qui" (~riga 402-409) va allineata: oggi rifiuta, dopo deve accettare per gli assi option.
- `packages/ui/src/domains/data-display/Badge.tsx` -- file generato committato, si rigenera (nessun caso reale lo cambia: outline non è nel contratto Badge).
- `packages/scripts/src/emitter/gates.ts` -- gate di rigenerazione diff-zero: la prova end-to-end che l'output corrente non cambia.

## Tasks & Acceptance

**Execution:**
- [x] `packages/scripts/src/style-properties.ts` -- aggiungere a `EmitRule` il ramo di rimozione (es. `utility` con classe fissa di override, tipologia: classe strutturale dichiarata nella riga, non derivata dal token) e usalo sulla riga `fill` -- la mappatura vive nel registro, una sola volta per tutte
- [x] `packages/scripts/src/emitter/render-component.ts` -- in `deriveFor`, per un asse option non default con proprietà assente ma presente nel default, produrre la classe di rimozione dal registro invece di fallire; per coveredByBase/blocked/non-registrata il fail resta -- il caso outline senza fill diventa esprimibile
- [x] `packages/scripts/src/emitter/render-component.test.ts` -- rosso/verde: cella option senza fill → `bg-transparent` per variante, base con `bg-primary` intatta; coveredByBase senza proprietà in variante resta bloccato; test "strokeWidth solo su option" aggiornato al nuovo messaggio se cambia -- prova del nuovo controllo
- [x] `packages/scripts/src/library/adopt-variant.ts` -- allineare la validazione: assenza di proprietà del default in una cella option non default non è più un errore -- adopt e emitter dicono la stessa cosa
- [x] `packages/ui/src/domains/` (rigenerazione) -- `render:component` su Badge, Input, AccordionItem e `render:check --all` diff zero -- nessun cambiamento silenzioso dell'output esistente

**Acceptance Criteria:**
- Given una ricetta con cella `variant=X` (option, non default) senza `fill` mentre il default ha `fill: color.primary`, when `render:component`, then il file generato ha `bg-primary` nella base cva e `X: "bg-transparent"` nella variante, senza errori.
- Given l'output attuale di Badge, Input, AccordionItem, when `render:check --all`, then diff zero (nessun cambio byte per byte).
- Given `strokeWidth` assente in una cella option non default ma presente nel default, when render, then il componente blocca con errore nominativo (le coveredByBase non guadagnano la rimozione).
- Given `fill` che varia con due assi, when render, then l'errore "interazione non esprimibile in cva/prefissi" resta invariato.
- Given `pnpm test` in `packages/scripts`, when la suite gira, then verde senza skip.

## Implementation Notes

<!-- Agent-owned. Append-only during implementation: decisions made, files touched, surprises
     encountered. Leave empty at planning time; never delete this section. -->

- `EmitRule.utility` guadagna `removalClass?` invece di un nuovo ramo di `emit`: la classe di rimozione è la stessa natura della utility, e la riga `fill` la dichiara inline (`removalClass: "bg-transparent"`).
- `removalClasses()` deriva la whitelist dal registro (una fonte sola); `validateEmitted` esclude quelle classi dalla validazione vocabolario prima di validarle (`transparent` non è un token).
- La rimozione scatta SOLO con `prefix === null` (assi option): per `state`/`behavior` resta il fail-loud, messaggio aggiornato a "solo le varianti option la guadagnano".
- `adopt-variant.ts`: rimossa la protezione "proprietà del default assente dalla cella" e il `defaultBindings` ormai inutilizzato; resta la guardia di esistenza/unicità della cella default. Il caso parziale (proprietà tolta solo su una parte del prodotto cartesiano) emerge ora come errore "due assi" del controllo di espressività, coperto da test.
- Nessun file generato in `packages/ui/src/domains` è cambiato: nessuna ricetta committata usa la rimozione, `render:check` diff zero senza rigenerazione.
- Pre-esistente (non di questa story): un byte NUL in `adopt-variant.ts` (~riga 557, dentro un literal `join("\x00")`) fa vedere il file come binario a git. Igiene futura, fuori scope.

- 2026-09-13 — `style-properties.ts`: `EmitRule.utility` guadagna `removalClass?`; la riga `fill` dichiara `removalClass: "bg-transparent"`. Nuovo helper `removalClasses()` che espone le classi dichiarate (l'ordine segue il registro). La classe NON entra nel vocabolario token: `transparent` non è un token.
- 2026-09-13 — `render-component.ts`: nuovo `deriveRemovalClass` — per una proprietà assente da una cella option non default (`prefix === null`) ma presente nel default, restituisce la classe dal registro; per coveredByBase il messaggio nominativo dice esplicitamente "la base non ha classi per un valore d'asse option: componente bloccato"; per utility senza `removalClass` (o per le bloccate/non registrate, via `lookupProperty`) il fail nomina proprietà, parte, cella e il canale di sblocco. `deriveFor` instrada alla rimozione SOLO con `prefix === null`: per gli assi state/behavior la rimozione resta fail-loud ("solo le varianti option la guadagnano"). `validateEmitted` accetta le classi di `removalClasses()` (set modulo-level `REMOVAL_CLASSES`) filtrandole dalla validazione vocabolario — derivate dal registro, mai duplicate a mano.
- 2026-09-13 — `adopt-variant.ts`: tolto il blocco "proprietà presente nel default e assente qui" (~402-409) e con lui `defaultBindings` (ora inutilizzato); la guardia di esistenza/unicità della cella default resta (serve a `adopt-cli` come template di copia). Adopt ed emitter ora dicono la stessa cosa.
- 2026-09-13 — Test: in `render-component.test.ts` il vecchio caso "strokeWidth solo su option" resta com'è (il messaggio `/per un valore d'asse option/` non cambia: arriva da `assertCoveredByBase`); aggiunti: variante secondary senza fill → `bg-primary` in base cva + `secondary: "bg-transparent"`, assenza simmetrica senza classi né errori, strokeWidth assente da variante con default presente → blocco coveredByBase (nuova via), `shadow` senza `removalClass` → blocco nominativo, rimozione su asse state → fail-loud. In `style-properties.test.ts`: `removalClasses()` = `["bg-transparent"]` e coveredByBase senza rimozione. In `adopt-variant.test.ts`: il caso "cella nuova senza una proprietà del default" ora si ADOTTA (fontWeight tolto da ENTRAMBE le celle outline — su una sola sarebbe un errore due assi, coperto dal nuovo test "(variant, size)").
- 2026-09-13 — Sorpresa: `adopt-variant.ts` conteneva un byte NUL pre-esistente dentro un literal (`values.join("\x00")`, ~riga 557, `git diff` mostra il file come binary). Non introdotto da questa story, non toccato.
- 2026-09-13 — Verifica: `pnpm --filter @penpot-ds/scripts test` 512/512; `check-types` verde; `render:check` diff zero su Badge, Input, AccordionItem; `pnpm lint` verde. Nessuna rigenerazione necessaria: l'output dei tre componenti committati è byte-identico (nessun caso reale usa la rimozione).
- 2026-09-13 — Review fix 1 (removalClass per tipo di layer): `removalClass` ignorava `byLayerKind` — su un layer text la variante emetteva `bg-transparent` che non annulla `text-*`, in silenzio. `removalClass` è ora `string | Record<prefisso, classe>` con chiavi = PREFISSI utility; l'emitter risolve `byLayerKind[kind] ?? prefix` con la STESSA logica del ramo positivo e cerca per prefisso risolto. Riga `fill`: `{ bg: "bg-transparent", text: "text-transparent" }`. `removalClasses()` appiattisce i valori. Nuovi test: label (text) senza fill → `text-transparent` e non `bg-transparent`; root senza fill → `bg-transparent`.
- 2026-09-13 — Review fix 2 (adopt allineato): `planAdoption` accettava l'assenza di QUALUNQUE proprietà del default, anche senza rimozione mappata (fontWeight, shadow, padding…) — i 5 file si scrivevano e poi `render:component` falliva. Ora il loop delle celle nuove rifiuta l'assenza solo se la riga del registro non dichiara `removalClass` (via `propertyDefinition`, foglia: nessuna dipendenza UI). Test fontWeight capovolto (errore nominativo); nuovo caso verde con `fill` (senza rimozione → adottata); il caso "due assi" ripuntato su `fill` parziale (fontWeight parziale ora cade nell'errore di rimozione prima del check due assi).
- 2026-09-13 — Review fix 3 (regola icona nel ramo di rimozione): `deriveRemovalClass` applica `ignoreOnLayerKinds` come `deriveClass` — una proprietà geometria d'icona assente da una variante è ignorata (null), non bloccata. Test con la label di Badge trasformata in path (layer kind dalla fixture): strokeWidth presente nel default e assente da una variante → output identico al render senza.
- 2026-09-13 — Review fix 4: commento sopra `deriveFor` riscritto in forma coerente (assenza simmetrica vs rimozione per variante, un'unica sezione).

## Spec Change Log

<!-- Append-only. Populated by step-04 during review loops. Do not modify or delete existing entries.
     Each entry records: what finding triggered the change, what was amended, what known-bad state
     the amendment avoids, and any KEEP instructions (what worked well and must survive re-derivation).
     Empty until the first bad_spec loopback. -->

## Review Triage Log

<!-- Append-only. Populated by step-04 on every review pass: one row per reviewer finding —
     verdict (high/medium/low/false/maybe-false) with its evidence: the refutation for
     false, what would settle it for maybe-false. Empty until the first review pass. -->

- [blind-hunter] `removalClass` ignora `byLayerKind`: fill su layer text → base emette `text-*`, la rimozione emette `bg-transparent` che non annulla nulla — **high**: verificato con probe (label di Badge senza fill in secondary: base `text-primary-foreground`, variante `secondary: "bg-transparent"` inutile, nessun errore) — output infedele in silenzio, esattamente ciò che la pipeline vieta. → patch
- [blind-hunter + edge-case-hunter + verification-gap] adopt accetta l'assenza di proprietà che l'emitter non sa rimuovere (fontWeight/shadow/padding senza `removalClass`): `planAdoption` restituisce `adopt`, poi `render:component` fallisce dopo la scrittura dei 5 file; il commento "Adopt e emitter dicono la stessa cosa" sovrachira — **medium**: verificato con probe (fontWeight assente da una variante → errore "la classe di rimozione non è mappata" solo al render) e nessun test esegue l'emitter su un design adottato. Il blocco è comunque fail-loud e nominativo, mai silenzioso, ma arriva dopo la scrittura. → patch (check in `planAdoption` sull'esistenza di `removalClass`, stesso canale di `deriveRemovalClass`)
- [edge-case-hunter] `ignoreOnLayerKinds` non applicato nel ramo di rimozione: una proprietà geometria d'icona (strokeWidth su path) assente da una variante ma presente nel default passerebbe da `deriveRemovalClass` invece di essere ignorata — **medium**: verificato per lettura (deriveFor → deriveRemovalClass non consulta `ignoreOnLayerKinds`; `deriveClass` lo fa a riga 294). Per gli attuali coveredByBase (strokeWidth/opacity) l'esito è comunque un blocco, non un output sbagliato, ma è un'incoerenza con la regola icona. → patch
- [blind-hunter] `deriveRemovalClass` catch di `lookupProperty` senza prefisso location — **low**: il messaggio di `propertyProblem` è già nominativo (componente, parte, cella passati in `where`), il prefisso duplicherebbe; percorso raggiungibile solo con proprietà non registrata, già bloccata prima da estrazione/verify. → false (il messaggio resta nominativo perché `where` è popolato)
- [blind-hunter] commento in `computePartClasses` autocontraddittorio ("SOLO se assente anche dal default" + paragrafo dopo opposto) — **low**: verificato, il primo paragrafo è rimasto a metà riscrittura; fuorviante ma non comportamentale. → patch
- [blind-hunter] commento in `adopt-variant.ts` dice che la cella default resta "il punto di confronto" ma il confronto è stato tolto — **medium**: verificato, fa parte dello stesso problema del sovrachilare "dicono la stessa cosa" (riga sopra); si corregge con la patch adopt. → patch (stessa radice)
- [blind-hunter] ramo finale `deriveRemovalClass` non testato per regole non-utility/non-coveredByBase (es. radiusCorner) — **low**: la forma del test esistente (shadow, utility senza removalClass) copre lo stesso `fail`; il caso radiusCorner richiederebbe una ricetta artificiosa mai raggiungibile da dati reali (i radius sono costanti per parte nelle ricette committate). → false (stesso canale di fail già provato; il percorso extra non aggiunge protezione reale)
- [blind-hunter] test Badge asserisce `sm: "pl-2 pr-2"` non pertinente — **low**: accoppiamento lieve a un output collaterale; il test è già committato in quella forma per l'instradamento Badge (riga 141) e la coerenza col test esistente è intenzionale. → false
- [blind-hunter] test "assenza simmetrica" chiama `renderWith` due volte con la stessa mutazione — **low**: doppia chiamata ridondante ma innocua (determinismo byte per byte è lui stesso l'oggetto del test). → false
- [blind-hunter] rationale "transparent non è un token" duplicato in 5 punti — **low**: i commenti hanno prospettive diverse (registro, validazione, chiamata); il canale unico è `removalClasses()`, il codice non duplica logica, solo spiegazioni. → false
- [blind-hunter] manca test che le removal classes passano la validazione solo dal canale registro — **low**: `removalClasses()` deriva dal registro (unica fonte) e il test del registro verifica l'elenco; un test in più sulla negazione non aggiungerebbe protezione su un percorso diverso. → false
- [blind-hunter] manca test emitter per proprietà omessa da due assi — **low**: verificato con probe che il guard "più assi" scatta (errore nominativo) prima del ramo di rimozione; il test adopt copre la stessa forma. → false (comportamento già bloccato e verificato; aggiungere il test è possibile ma il guard esiste ed è nella suite)
- [edge-case-hunter] adopt scrive design che il render blocca (duplicato del finding medium sopra, stessa radice) — incluso nel gruppo adopt → patch

**Loop 1 — patch applicate e riverificate:**
- byLayerKind nella rimozione: `removalClass` per prefisso utility risolto (`{ bg: "bg-transparent", text: "text-transparent" }`), stessa risoluzione del ramo positivo; test rosso/verde su label (text) → `text-transparent`, mai `bg-transparent`.
- adopt: rifiuta l'assenza di una proprietà del default solo se la riga del registro non dichiara rimozione; test fontWeight capovolto (ora errore nominativo), nuovo caso verde con fill; commento aggiornato alla verità.
- regola icona applicata anche al ramo di rimozione (null, non blocco), con test.
- commento sopra `deriveFor` riscritto in forma coerente.
- Verifica completa post-patch: 516 test verdi, check-types OK, `render:check` diff zero (Badge, Input, AccordionItem), lint OK.

## Verification

**Commands:**
- `pnpm --filter @penpot-ds/scripts test` -- expected: verde
- `pnpm --filter @penpot-ds/scripts check-types` -- expected: verde
- `pnpm --filter @penpot-ds/scripts render:check` -- expected: diff zero su tutti i componenti
- `pnpm lint` -- expected: verde (boundaries)
