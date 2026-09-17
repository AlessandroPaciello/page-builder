---
title: 'Story 2.11 — Storybook del design system'
type: 'feature'
created: '2026-09-17'
status: 'done'
route: 'dispatch'
baseline_commit: '327897b3deb74f1da470c85e53eafc406dc67f21'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-17.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** le story generate non sono CSF3 valido: le props stanno al primo livello dell'oggetto story invece che in `args`, quindi Storybook le ignorerebbe e ogni story renderebbe il componente senza props, senza che alcun gate lo segnali. Nessuno Storybook aggrega i 4 componenti (`Badge`, `Input`, `Alert`, `AccordionItem`): il design system non è esplorabile e il giudizio visivo della ProductCard (Story 2.15) non ha dove avvenire.

**Approach:** l'emitter emette story CSF3 con le props in `args`; uno smoke test esegue tutte le story generate e una story senza `args` è un test rosso; una nuova app `apps/storybook` le aggrega con l'addon di accessibilità e produce un build statico in CI. Il gate scopre le story per glob e vale invariato per le story di `render` v2.

## Boundaries & Constraints

**Always:**
- Pass/fail negli script e prova rosso/verde per ogni controllo nuovo.
- Nessun elenco hard-coded di componenti o story: scoperta per glob sia in `main.ts` sia nello smoke test.
- `render:check` a diff zero sulla nuova baseline: l'unico diff ammesso rispetto a `HEAD` sono i 4 `.stories.tsx` rigenerati.
- Marker `@generated`, provenienza e titolo `Dominio/Nome` invariati.
- Token solo via `@penpot-ds/ui/globals.css`: nessun tema duplicato in Storybook.
- Mai scritture su Penpot; estrazione e `verify:library` invariati.

**Never:**
- Modifiche a mano sui file `@generated`; modifiche ai `.tsx`/`.test.tsx` dei componenti.
- Deploy o pubblicazione dello statico: solo build in CI.
- Ristrutturazioni di `gates:render`/`verify:library` oltre l'aggiunta (la v1 resta intatta fino alla 2.16).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Story senza `args` | `.stories.tsx` in vecchia forma (props al primo livello) | smoke rosso nominativo (componente + nome story) | le altre story girano comunque |
| Tutto allineato | 4 componenti con story CSF3 | smoke verde, `storybook dev` e build statico OK | N/A |
| Build statico rotto | errore di bundling | job CI rosso con il modulo nel log | il dev resta usabile |

</frozen-after-approval>

## Code Map

- `packages/scripts/src/emitter/render-component.ts:1178` `renderStoriesFile` (chiamata `:1365-1369`, titoli da `DOMAIN_TITLES :653-660`, header da `provenanceHeader :662`) — qui va l'emissione CSF3.
- `packages/scripts/src/emitter/render-component.test.ts:252,328,351` — asserzioni sulla forma delle story, da aggiornare alla CSF3.
- `packages/scripts/src/emitter/gates.ts`, `gates-runner.ts` — struttura dei gate esistenti, da non ristrutturare: lo smoke vive in `packages/ui`.
- `packages/ui/src/domains/*/*.stories.tsx` (4 file: `data-display/Badge`, `inputs/Input`, `feedback/Alert`, `layout/AccordionItem`) — da rigenerare via CLI, mai a mano.
- `packages/ui/src/styles/globals.css:1-5,128` — importa già il tema token: riusarlo nel `preview` di Storybook.
- `packages/ui/package.json` — suite vitest esistente (testing-library, vitest-axe): ospita lo smoke test.
- `pnpm-workspace.yaml` (catalog), `turbo.json` (outputs), `.github/workflows/ci.yml` (job `ci`) — wiring del build statico.

## Tasks & Acceptance

**Execution:**
- [x] `packages/scripts/src/emitter/render-component.ts` -- `renderStoriesFile` emette CSF3 (`Meta`/`StoryObj` tipizzati, props in `args`) -- cuore della story
- [x] `packages/scripts/src/emitter/render-component.test.ts` -- aggiorna le asserzioni alla forma CSF3 + prova rosso/verde -- prova
- [x] 4 `.stories.tsx` in `packages/ui/src/domains` -- rigenera via `render:component`, mai a mano -- nuova baseline
- [x] `packages/ui` (`package.json` + `stories.smoke.test.tsx`) -- scopre le story per glob, asserisce `args` presente e rende ogni story via `composeStories` -- gate valido per v1 e v2
- [x] `apps/storybook` (`main.ts` con glob, `preview.ts` con `globals.css`, addon a11y, script `dev`/`build`) -- aggregazione esplorabile
- [x] `pnpm-workspace.yaml`, `turbo.json`, `.github/workflows/ci.yml` -- pin delle versioni compatibili con React 19 e build statico in CI -- wiring

**Acceptance Criteria:**
- Given le story rigenerate, when avvio Storybook, then i 4 componenti sono navigabili con i token applicati e il pannello a11y attivo.
- Given una story senza `args`, when gira lo smoke test, then il test è rosso e nomina componente e story.
- Given `pnpm test`, `check-types`, `lint` e `render:check`, when girano, then sono verdi senza skip e il diff è zero.

## Implementation Notes

- Decorator headless oltre l'esempio Badge: `AccordionItem` richiede il wrapper `<AccordionPrimitive.Root>` (import riusato verbatim dalla base, `rootProps` dal binding, nessuna lista hard-coded), altrimenti la story lancia e non è né navigabile né rendibile via `composeStories`. Solo i 4 `.stories.tsx` sono cambiati in `domains/`; `.tsx`/`.test.tsx` byte-identici.
- Storybook risolto a `10.6.0` (React 19 + Vite + Tailwind v4, build verde). `apps/storybook` ha script `lint`/`test` echo-stub (solo config + output statico ignorato): `check-types` copre i TS, ma la scelta è segnalata alla review.
- Verifiche proprie dello step-03 sul diff: `render:check` 4/4 diff zero; `@penpot-ds/ui` 39/39; `@penpot-ds/scripts` 626/626; `check-types` 11/11; `lint` 7/7; `build-storybook` con 11 story e bundle a11y presenti.

## Spec Change Log

## Review Triage Log

Loop 1 (2026-09-17, diff 116K incl. lockfile; verification-gap: nessun gap):

- BH1 (CI senza artifact) — `false`: vite nomina il modulo che fallisce nel log e CI conserva il log intero; nessun artefatto serve alla diagnosi.
- BH2 (nome package `storybook` ambiguo) — `false`: `pnpm --filter` seleziona solo package workspace, la dipendenza npm omonima non è selezionabile; build verde lo prova.
- BH3 (cache turbo maschera rotture) — `false`: niente `remoteCache` in `turbo.json`, runner CI partono freddi e gli input sono content-hash.
- BH4 (stub lint/test verdi finti) — `false`: `check-types` copre davvero tutti i TS di storybook; gli stub sono no-op dichiarati, non passi finti; nessuna boundary da controllare.
- BH5 (tsconfig allenta `noUnused*`) — `low` → patch: la base li vuole `true`, l'override li spegne; togliere le due righe.
- BH6 (import CSS non risolvibile / `global.d.ts` ridondante) — `false`: l'export `./globals.css` esiste e la build risolve il tema; la dichiarazione serve perché `types: ["node"]` esclude `vite/client`.
- BH7 (glob duplicato main.ts/smoke) — `low` → patch: due letterali in package diversi (niente costante condivisa possibile); basta un commento di cross-reference.
- BH8 (`args: {}` passa) — `false`: args vuoto è legittimo per componenti senza props; l'emitter deriva gli args dai field del contratto, le required sono sempre incluse.
- BH9 (titolo/marker/provenance senza copertura) — `false`: titoli nei test CSF3, marker via `isGeneratedFile`, provenienza (`penpotComponentId`+`fixtureHash`+comando) nel loop su tutti i file.
- BH10 (portal leak senza cleanup) — `false`: ogni `render` è seguito da `unmount` nella stessa iterazione e React rimuove i portali all'unmount.
- BH11 (`extractImport` senza fallback) — `false`: a riga mancante chiama `fail()` e fallisce loud, mai alias non importato.
- BH12 (`Story` implicit any / decorator inline) — `false`: `check-types` strict verde prova il typing contestuale; la duplicazione per-story è stilistica, senza danno nominabile.
- BH13 (red-proof su letterale) — `false`: le asserzioni positive (`toContain` StoryObj/args sull'output reale) intercettano una regressione dell'emitter; il letterale è documentazione.
- BH14 (conteggio 11 story non asserito) — `false`: `render:check` verifica "4 file attesi" per componente (4/4 riverificato) e copre file spariti o derivati.
- BH15 (README mancante) — `low`, rejected: nessun requisito docs negli AC; porta nello script `dev`, no-deploy nel commento CI; fix = nuovi file.
- BH16 (caret `^10.6.0` non pinned) — `false`: caret è la convenzione del catalog (come tutte le altre dipendenze); il pin esatto vive nel lockfile.
- BH17 (epic-2-context perde i dettagli v1) — `false`: i requisiti v1 vivono nelle story congelate 2-1…2-10, intoccate; il context distilla per regola propria.
- ECH1 (valore asse con `-`/spazio → syntax error) — vero ma pre-esistente (vecchio codice identico) → defer.
- ECH2 (asse option senza valori) — `false`: `defineContract` rifiuta (`default` deve stare in `values`, impossibile a lista vuota).
- ECH3 (`args: null` passa lo smoke) — `low` → patch: in CSF3 args è un oggetto; escludere anche `null`.
- ECH4 (primo args mancante abortisce il loop) — `low`, rejected: il gate è comunque rosso; enumerare tutti i fallimenti è un di più che ristruttura il test.
- ECH5 (`composeStories` che lancia nasconde le altre) — `low`, rejected: come ECH4, e gli altri moduli girano comunque.
- ECH6 (bang accessor `!.content`) — `low` → patch: `expect defined` prima di leggere `.content`.
- ECH7 (= BH4) — `false`, vedi BH4.
- ECH8 (= BH13) — `false`, vedi BH13.

## Design Notes

Forma CSF3 emessa (titolo e marker invariati):

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./Badge";
const meta = { component: Badge, title: "Data Display/Badge" } satisfies Meta<typeof Badge>;
export default meta;
export const VariantDefault: StoryObj<typeof Badge> = { args: { label: "Etichetta", variant: "default" } };
```

Decisioni registrate: `apps/storybook` perché è un'app con output statico (convenzione `apps/*`); smoke in `packages/ui` per non creare import cross-package nei gate di `scripts`; la major di Storybook si risolve in implementazione dai docs ufficiali (compatibile React 19 + Vite + Tailwind v4) e si pinna nel catalog.

## Verification

**Commands:**
- `pnpm --filter @penpot-ds/scripts test` -- expected: verde con le nuove asserzioni CSF3
- `pnpm --filter @penpot-ds/ui test` -- expected: verde incluso lo smoke sulle 4 story
- `pnpm --filter @penpot-ds/scripts render:check` -- expected: diff zero dopo la rigenerazione
- `pnpm --filter storybook build-storybook` -- expected: statico prodotto senza errori
- `pnpm check-types` + `pnpm lint` -- expected: verdi senza skip
