# Spine Pair Review — page-builder

## Overall verdict

DESIGN.md/EXPERIENCE.md form a disciplined fast-path draft: inheritance from SPEC/companions/architecture is clean, capability numbering and glossary terms are used correctly, and the deliberate token-placeholder policy is transparently tracked in frontmatter, prose, and `.memlog.md`. The pair is not yet contract-ready, though: DESIGN.md's Components section is effectively empty (all detail deferred to "Finalize"), no Key Flow carries a failure path or covers CAP-10 (archive/restore), a public "slug not found" state is missing, and EXPERIENCE.md's section order misplaces Key Flows before Responsive & Platform. None of these are placeholder-token complaints — they are real coverage/shape gaps that should be closed in one Update pass before Finalize.

## 1. Flow coverage — partial
Checked each SPEC capability (CAP-1…15) against the four Key Flows (Marco/Editor, Giulia/Cliente, Sara/Admin, Luca/Visitatore) for a named protagonist, numbered steps, a climax beat, and a failure path where applicable, using `experience-example-mobile.md`/`experience-example-shadcn.md` (each of which attaches an explicit `Failure:` line to every flow) as the shape reference.

### Findings
- **high** No Key Flow dramatizes CAP-10 (archive/restore). State Patterns notes the transition is asymmetric ("Archiviata → solo Restore, mai direttamente a PUBLISHED") and AD-7 makes archiving a transactional operation that can demote a currently-PUBLISHED version — behaviorally surprising enough to deserve a flow, not just a state-table line (EXPERIENCE.md § Key Flows). *Fix:* add a short 5th flow (Editor/Admin archives a page with a live PUBLISHED version) or explicitly extend Sara's flow to include an archive step.
- **high** None of the four Key Flows include a `Failure:` annotation, unlike both paired examples where every flow ends with one. Error/edge handling is pushed entirely into State Patterns, decoupled from the flow narrative (EXPERIENCE.md § Key Flows). *Fix:* append one failure line per flow — e.g. Marco: publish dialog cancelled or save API error; Giulia: unauthorized action reached via direct URL; Sara: rollback attempted with only one version present; Luca: slug not found / archived page requested.
- **medium** CAP-15 commerce fallback (provider unreachable, referenced product removed) is self-flagged as an open gap ("[ASSUMPTION, gap non coperto esplicitamente da SPEC CAP-15]" in Component Patterns) but Luca's flow — the one flow that touches the storefront end-user experience — only shows the happy path (EXPERIENCE.md, Luca flow step 3-4). *Fix:* add the fallback branch to Luca's flow, or a short dedicated flow, so the gap is closed rather than doubly-flagged.
- **low** CAP-5 (ui compositions) has no flow of its own, but is well covered structurally through Component Patterns and appears inside the other four flows (TopBar, SaveStateIndicator, LifecycleBadge) — acceptable, noted only for completeness.

## 2. Token completeness — acceptable with a caveat
Per the task's explicit framing, the placeholder token values in DESIGN.md are a tracked project decision (CAP-1/Penpot pipeline, `.memlog.md` decisions), not a defect. Checked whether the placeholder treatment itself is applied consistently across `colors`/`typography`/`rounded`/`spacing`.

### Findings
- **medium** Placeholder discipline is inconsistent across token categories. `colors` uses a uniform, unmistakably-fake sentinel (`#000000` repeated for all 10 keys) — unambiguous to any consumer. `rounded` (`sm:4px, md:8px, lg:12px, full:9999px`), `spacing` (4px-based scale), and `typography.heading/body.fontWeight` (600/400) instead carry specific, plausible-looking values flagged only by a YAML block comment (`# [ASSUMPTION] Scala indicativa...`). A downstream consumer reading the frontmatter values without the comment (e.g. a codegen step, or a story-dev skimming) could easily treat these as real. This also sits in tension with the SPEC's own constraint ("mai inventare valori mancanti... solo default neutri" — `penpot-pipeline.md`). *Fix:* apply the same "obviously fake" sentinel discipline to `rounded`/`spacing`/`typography` weights (e.g. a single repeated dummy step), or inline the ASSUMPTION marker per-key rather than as one block comment.
- **low** `components: {}` is empty in frontmatter with a prose explanation — internally consistent, but see Component coverage (§3) for the resulting downstream gap.

## 3. Component coverage — weak
Checked that every component named in either file has a real row in DESIGN.md § Components and in EXPERIENCE.md § Component Patterns.

### Findings
- **high** DESIGN.md § Components has zero per-component entries — it only points at `design-system.md`'s catalog and defers all visual specification ("verranno popolati per i componenti-chiave... a Finalize"). Per `design-md-spec.md` §7, Components should carry "anatomy, color usage, sizing, state appearance" per component — none of that exists even at a structural placeholder level, unlike EXPERIENCE.md § Component Patterns, which does have real behavioral rows (TopBar, PageList, VersionList, SaveStateIndicator, Puck blocks, commerce blocks). The pairing is asymmetric: behavior without a visual anchor for any component. *Fix:* add placeholder-but-structural rows for at least the 5 named key components (TopBar, PageList, VersionList, LifecycleBadge, SaveStateIndicator), consistent with how DESIGN.md already handles placeholder colors/spacing.
- **medium** LifecycleBadge is explicitly named as one of the 5 "componenti-chiave" in DESIGN.md § Components, but has no dedicated row in EXPERIENCE.md § Component Patterns — it only appears inline inside the TopBar row. It already has enough real behavioral content stated elsewhere (3 states DRAFT/PUBLISHED/ARCHIVED mapped to feedback tokens, text+color rule) to justify its own row. *Fix:* promote LifecycleBadge to its own Component Patterns row.

## 4. State coverage — mostly strong, two notable gaps
Checked each IA surface (`/login`, `/pages`, `/pages/[id]/editor`, `/pages/[id]/versions`, `/my-pages`, `/audit`, `/[slug]`) against State Patterns for empty/error/permission-denied states.

### Findings
- **high** The public render route `/[slug]` has no documented "not found" state — neither for a slug that doesn't exist nor for one whose page is ARCHIVED (which should presumably also 404, by analogy with AD-13's non-public-resource rule). State Patterns covers empty PageList/VersionList, permission errors, save errors, and commerce-provider errors, but not this — arguably the single most common real-world state for a public commerce storefront (EXPERIENCE.md § State Patterns; § Key Flows, Luca). *Fix:* add a public-render 404/unavailable state.
- **medium** `/login` has no documented failure state (invalid credentials, lockout, etc.). Reasonable to leave light in a fast-path draft, but worth at least one line or an explicit note that it's deferred to the architecture's auth-provider defaults (EXPERIENCE.md § Information Architecture / § State Patterns — absent). *Fix:* add a one-liner or an explicit deferral note.
- **low** No state is documented for the confirmed action itself failing server-side (publish/rollback/archive erroring after the confirmation dialog) — Interaction Primitives specifies the confirmation gate but not the failure branch of the gated action.

## 5. Visual reference coverage — n/a / strong by absence
No mockups, wireframes, or imports exist yet in this early-phase project. Neither file references any, and EXPERIENCE.md's Information Architecture section correctly omits the "→ Composition reference" line the paired examples use once mockups exist. This is the expected shape for this phase, not a defect.

## 6. Bloat & overspecification — strong
Checked for invented detail beyond SPEC scope, redundant sections, and unnecessary elaboration.

### Findings
- **low** The "state = text + color, never color alone" rule is restated near-verbatim in four places (DESIGN.md Colors; DESIGN.md Do's/Don'ts; EXPERIENCE.md Accessibility Floor; EXPERIENCE.md Component Patterns/State Patterns). Justified as a hard cross-cutting a11y constraint worth reinforcing at each point of use, but creates four places to keep in sync if the rule ever changes. *Fix (optional):* state it once canonically and cross-reference from the other three.
- No findings of scope creep: both files stay within the 15 SPEC capabilities, `[ASSUMPTION]` tags are used honestly rather than silently inventing detail, and the "fast path" mode declared in `.memlog.md` is respected — no gold-plating found.

## 7. Inheritance discipline — strong
Checked `sources:` frontmatter resolution, capability/glossary term fidelity against SPEC.md and companions, and RBAC/architecture alignment.

### Findings
- **informational** All 7 `sources:` entries in both files resolve to real files (verified via filesystem check) and are identical between DESIGN.md and EXPERIENCE.md. Capability numbers (CAP-4, CAP-7, CAP-11, CAP-15) and glossary terms (DRAFT/PUBLISHED/ARCHIVED, PageVersion, block-id, slug) are used exactly as defined upstream — no renamed or drifted terminology found. The `/audit` 404-not-403 rule matches `rbac-matrix.md` and ARCHITECTURE-SPINE AD-13 precisely; the ISR/invalidation detail in Luca's flow matches AD-9. This is the strongest category in the pair.
- **informational** EXPERIENCE.md never uses the `{path.to.token}` cross-reference syntax toward DESIGN.md — expected and correct, since DESIGN.md's tokens are still placeholders and there is nothing concrete to point at yet. Flagged only so it isn't mistaken for an oversight.

## 8. Shape fit — mostly correct, one real ordering violation
Checked DESIGN.md section order against `design-md-spec.md`'s locked order, and EXPERIENCE.md section order against both paired examples.

### Findings
- **medium** In EXPERIENCE.md, **Key Flows** appears before **Responsive & Platform** (order: Foundation → IA → Voice and Tone → Component Patterns → State Patterns → Interaction Primitives → Accessibility Floor → **Key Flows** → **Responsive & Platform**). Both reference examples (`experience-example-mobile.md`, `experience-example-shadcn.md`) consistently place Responsive & Platform (when present) and Inspiration & Anti-patterns (when present) before Key Flows, which is always last. *Fix:* move "Responsive & Platform" to immediately after "Accessibility Floor," before "Key Flows."
- **low** "Inspiration & Anti-patterns" is omitted entirely. Acceptable — no named competitor/reference products were supplied and the section is documented as omittable — but unlike other omissions in this draft, it isn't explicitly traced as a decision in `.memlog.md`. Not required to fix, just noted for traceability symmetry.
- DESIGN.md's section order is fully canonical (Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts) — no violation found.

## Mechanical notes

- All cross-file links checked and resolve correctly: DESIGN.md → `penpot-pipeline.md`, `design-system.md`; EXPERIENCE.md → `DESIGN.md` (×2), `a11y-baseline.md`. No broken relative paths.
- Frontmatter is complete and consistent between the two files (`name`, `status`, `sources`, `updated` in EXPERIENCE.md; `name`, `description`, token blocks, `status`, `updated`, `sources` in DESIGN.md) — matches the shape of the paired examples plus the project's BMAD status/sources convention layered on top of the base `design.md` spec.
- No naming drift found between DESIGN.md/EXPERIENCE.md and SPEC.md/design-system.md/rbac-matrix.md/a11y-baseline.md/glossary.md/ARCHITECTURE-SPINE.md — capability numbers, role names, entity names, and lifecycle labels ("Bozza"/"Pubblicata"/"Archiviata") are all used identically to their upstream definitions.
- The 6 open `[ASSUMPTION]`s logged in `.memlog.md` (3-column editor layout, keyboard path for drag-and-drop, commerce fallback, PageList lifecycle filter, autosave debounce trigger, responsive breakpoints) are all traceable to matching `[ASSUMPTION]` markers in EXPERIENCE.md/DESIGN.md — no undocumented assumption found beyond what's already tracked.
