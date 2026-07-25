---
name: pr-review
description: Reviews a story branch's diff before (or right after) opening a PR — checks whether acceptance criteria are actually met by the diff, whether the PR body's claims match reality, and whether BMAD context changes (_bmad-output/) genuinely reflect what was built. Does not review code correctness or style — use code-review or bmad-code-review for that. Use when the user says "revisiona questa PR", "è pronta questa PR", "controlla gli acceptance criteria", "verifica il body della PR".
---
# PR Review

Reviews the *claims* a PR makes, not the code itself. `code-review` and `bmad-code-review` already own correctness, bugs, and style — don't re-do that work here. This skill exists for a narrower, easy-to-overlook failure mode: a PR whose diff is fine but whose story is only partially done, or whose description doesn't match what actually changed.

## Scope

1. **Acceptance criteria coverage** — does the diff actually support each AC in the story file, or are boxes checked on faith?
2. **PR body truthfulness** — do the claims in the PR template (which files have agent-generated code, which BMAD Context Changes boxes are checked) match the real diff?
3. **BMAD context integrity** — if `_bmad-output/planning-artifacts/` (architecture, PRD, epics) changed, does the change plausibly follow from the rest of the diff, or does it contradict it?

Not in scope: whether the code is correct, well-structured, secure, or tested well — that's `code-review`'s job. If the user wants both, say so and suggest running both, don't try to cover code quality here too.

## Input

Primary: the local diff of the current story branch against `develop` — `git diff develop...HEAD` (three-dot: only commits on this branch, not stuff `develop` picked up meanwhile). Confirm you're actually on a `story/*`/`fix/*`/`chore/*` branch before starting; if on `main`/`develop` directly, ask which branch to review instead of guessing.

If a PR body already exists (user pastes it, or it's fetchable — `gh pr view --json body` if `gh` is available, otherwise ask the user to paste it), use it as the thing being checked *against* the diff. If no PR body exists yet, this review is pre-flight: produce findings the user should resolve before drafting one (naturally feeds into `bmad-git-flow`'s `pr` action afterward — don't duplicate that action's template-drafting job, just report on readiness).

## Step 1: Identify the story

From the branch name (`story/{story_key}-slug`) or by asking, find `_bmad-output/implementation-artifacts/{story_key}.md`. If it doesn't exist, say so plainly — there's nothing to check coverage against, don't invent acceptance criteria to fill the gap.

## Step 2: Acceptance criteria coverage

For each AC line in the story file:

- Read the actual diff for evidence — file changes, added logic, new tests — that supports it. Quote the relevant diff hunk when you cite evidence, don't paraphrase from memory.
- Classify each AC as: **Met** (diff clearly supports it), **Not met** (checked in the story file but no diff evidence), **Unverifiable from diff alone** (e.g. a UX/behavioral AC that needs running the app — say so, don't guess a verdict), **Unrelated change present** (diff does something not covered by any AC — not necessarily wrong, but flag it so the human notices scope creep).

## Step 3: PR body truthfulness (if a body exists or is drafted)

Cross-check specific claims against the diff, don't take them at face value:

- `Agent-generated code: ... — which files` → do those files actually appear in `git diff --stat`? Flag files claimed but not in the diff, or vice versa.
- `BMAD Context Changes` checkboxes → does `_bmad-output/planning-artifacts/` or `_bmad-output/implementation-artifacts/{story_key}.md` actually appear in the diff for each checked box? Flag mismatches both ways (checked-but-absent, unchecked-but-present).
- `Human review of agent code: Yes/No` → can't be verified from a diff. Don't validate this one; note it's self-attested and move on.

## Step 4: BMAD context integrity

Only relevant if `_bmad-output/planning-artifacts/architecture.md` (or `prd.md`/`epics.md`) changed in this diff. Read the changed section and the rest of the diff side by side — does the architectural claim plausibly match what the code diff does? This is a judgment call, not a mechanical check: present it as a flag for human attention ("architecture.md now says X, but the diff appears to do Y — worth a second look"), never as a pass/fail verdict you're certain of.

## Output

A short structured report, most important findings first:

```
## AC Coverage
- [Met/Not met/Unverifiable/Unrelated] <AC text> — <evidence or gap>

## PR Body Truthfulness
- <claim> — <matches diff / mismatch, with specifics>

## BMAD Context Integrity
- <flag, if any — omit this section entirely if nothing changed under planning-artifacts/>

## Verdict
Ready to open / needs work before opening — <one line why>
```

Ready/needs-work is your assessment, not a gate you enforce — the human decides whether to open the PR anyway.
