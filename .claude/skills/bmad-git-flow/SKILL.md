---
name: bmad-git-flow
description: Guides branch naming, generates BMAD-flavored commit messages, drafts PR descriptions, and helps resolve conflicts in BMAD artifacts (_bmad/, _bmad-output/, docs/), following the team's Git & GitHub playbook. Use when the user says "che branch uso", "crea il branch per la story", "genera il commit message", "apri la PR", "bmad git flow", or has a conflict in file BMAD.
---
# BMad Git Flow

Applies the team's Git & GitHub Collaboration Playbook to **this** project's real layout — not the generic `.bmad/` layout the playbook document describes. This project uses `_bmad/` (installer-managed, mostly read-only), `_bmad-output/planning-artifacts/` and `_bmad-output/implementation-artifacts/` (BMAD-generated documents), and `docs/` (project knowledge). There is no GitHub Copilot in this workflow — Claude Code is the only AI agent, so skip any Copilot-specific instruction from the source playbook.

## Path mapping (playbook → this project)

| Playbook concept             | Real path here                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `.bmad/context/`           | `docs/` (project knowledge) + `_bmad-output/planning-artifacts/` (prd.md, architecture.md, epics.md)                       |
| `.bmad/stories/active        | completed                                                                                                                      |
| `.bmad/agents/`            | `_bmad/custom/*.toml` (agent/workflow overrides) — installer-managed `_bmad/` itself is read-only, never edit directly    |
| `.copilot-instructions.md` | N/A — skip                                                                                                                    |
| `CLAUDE.md`                | `{project-root}/CLAUDE.md` — doesn't exist yet; if a session needs it, offer to create one only when asked, not proactively |

Story key format: whatever `bmad-create-story` produced for `{{story_key}}` (check `_bmad-output/implementation-artifacts/` for existing examples, typically `{epic}.{story}` e.g. `1.2`). Don't assume `S12` — read the real key.

**Important divergence from the playbook:** the playbook's §2.2 tells you to gitignore `.claude/` as a local-only Claude Code cache. In this project `.claude/`, `.agents/`, and `.opencode/` hold the actual BMAD skill definitions (same skills, mirrored for different tool integrations) — this is committed, shared team content, not personal session state. Never suggest gitignoring these directories wholesale.

## Preflight

This skill exists so someone who doesn't know BMAD or this git workflow well can still follow it correctly — don't assume the user knows which action they need.

- No `.git/` at `{project-root}` → **lead with `setup`**, don't wait for the user to ask for it by name. Explain in one sentence why (nothing else in this skill works without a repo and a `develop` branch to target).
- Has `.git/` but no `develop` branch, no `.gitignore`, or no `.github/PULL_REQUEST_TEMPLATE.md` → mention what's missing before doing the requested action, and offer to run the relevant part of `setup` first. Don't silently work around a missing prerequisite.
- Everything present → proceed straight to the requested action.

## Dispatch

If the user names a clear action (branch, commit, pr, conflict), do that. If they're vague ("aiutami con git", "non so cosa fare", "come uso bmad con git qui") or this is their first time invoking the skill in the session, offer this short menu instead of guessing:

```
1. Sto iniziando da zero su questo repo → setup
2. Devo iniziare a lavorare su una story → branch
3. Ho modifiche pronte da salvare → commit
4. Ho finito una story, apro una PR → pr
5. Ho un conflitto in file BMAD → conflict
```

Never make the user read the playbook or this file directly to figure out which one applies — that defeats the point.

### Action: setup

The guided first-run path. One-time repo initialization per playbook §2.1 (layout), §2.2 (`.gitignore`), and the CODEOWNERS tip from §12.1 (conflict prevention). §2.3 (`.copilot-instructions.md`) is deliberately excluded — no Copilot in this workflow.

Walk through these in order, checking real state before each (`ls`/`find`/`git status` — never assume), confirming before every write:

**1. Git itself**, if missing:

```
git init
git checkout -b main
git checkout -b develop
```

Explain this creates the two long-lived branches from the playbook's 4-tier model (§3.1) before any story work can start.

**2. `.gitignore`** (§2.2) — adapted content, not a copy of the playbook's (that one assumes files that don't exist here):

```gitignore
# OS / editor noise
.DS_Store
Thumbs.db

# Local, personal overrides — team-shared skill defs (.claude/ .agents/ .opencode/) are NOT covered by this
CLAUDE.local.md
.claude/settings.local.json

# _bmad personal overrides already handled by _bmad/custom/.gitignore (*.user.toml) —
# don't duplicate that rule here, it's scoped correctly where it is
```

Keep this to what's actually relevant here — no Copilot-cache or `.bmad/sessions/` entries, they have no real target in this project. Extend later if new local-only files show up; don't guess preemptively.

**3. `.github/PULL_REQUEST_TEMPLATE.md`** — write the exact shape used by the `pr` action below, so new PRs on GitHub get it pre-filled automatically instead of the user having to paste it each time.

**4. `.github/CODEOWNERS`** — only the high-risk paths from the `conflict` action's table, so GitHub can request the right reviewer automatically instead of relying on someone remembering the rule:

```
_bmad-output/planning-artifacts/ @team-lead
_bmad/custom/ @team-lead
```

Ask who `@team-lead` actually is (a real GitHub username/team) — never invent one. If there's no designated team lead yet, skip this file rather than filling it with a placeholder.

**5. Layout check** (§2.1) — everything else the playbook's canonical tree calls for already exists in this project (`_bmad/`, `_bmad-output/`, `docs/`, `.claude/`/`.agents/`/`.opencode/`). Don't create `src/`/`tests/` placeholders — greenfield, they'll appear naturally once implementation starts. Check for `README.md`; offer to create a minimal one only if genuinely absent.

Confirm each numbered step individually — this is a one-time structural change, treat it with the same care as any other repo-safety action. Skipping a step because it's already satisfied is fine; skipping it silently because it seemed optional is not — say what you're skipping and why.

### Action: branch

For story work: `story/{story_key}-{short-slug}` (e.g. `story/1.2-page-builder-canvas`). Slug: lowercase, hyphenated, from the story title.
For bugs: `fix/{issue-or-short-desc}`.
For housekeeping/BMAD context updates: `chore/{description}` (e.g. `chore/update-architecture-context`).
Never `experiment/*` merges to `develop` directly — flag if the user tries.

Steps to hand the user (creation):

```
git checkout develop && git pull
git checkout -b story/{story_key}-{slug}
```

If `develop` is behind `origin`, warn before branching.

**Branch lifecycle** (playbook §3.3), the parts beyond naming:

- **Keep current**: rebase onto `develop` regularly while the branch is open — `git fetch origin && git rebase origin/develop`. Prefer rebase over merge for story branches, per the playbook; flag it if the user reaches for `git merge develop` instead and ask if that's intentional.
- **Story branch lifetime**: the playbook targets short-lived branches (under ~3-5 days). If a story branch looks like it's been open a long time (check `git log develop..story/{branch} --oneline` for a rough sense, or ask), mention the risk of a harder rebase later — don't block on it, just flag it.
- **After the story PR merges**: delete the branch — `git branch -d story/{story_key}-{slug}` locally, and the remote one via GitHub's post-merge prompt or `git push origin --delete story/{story_key}-{slug}`.
- **`develop` → `main`**: a distinct event from a story PR — a **release PR**, opened when a milestone is complete, not per-story. Don't conflate the two when the user asks to "open a PR" — check which direction they mean.
- Never commit directly to `main` or `develop` — always through a PR, even for small fixes. This is a hard rule from the playbook, not a suggestion.

### Action: commit

Format: `<type>(<scope>)[bmad:{story_key}]: <description>`

Types: `feat`, `fix`, `bmad` (changes under `_bmad-output/`, `_bmad/custom/`, `docs/`), `docs`, `refactor`, `test`, `chore`. Never `wip` on a commit destined for a PR — squash first.

| Path touched                                                                                              | Type                                                                                                         |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/`, `tests/` (once they exist)                                                                    | `feat` / `fix` / `refactor` / `test` — normal conventional-commit rules                             |
| `_bmad-output/planning-artifacts/`, `_bmad-output/implementation-artifacts/`, `_bmad/custom/*.toml` | `bmad` — artifacts the BMAD workflow itself generates or consumes (stories, PRD, architecture, overrides) |
| `docs/`, `README.md`                                                                                  | `docs` — human-authored project knowledge, not BMAD-workflow output                                       |
| `.gitignore`, `.github/**`, CI config, other repo tooling                                             | `chore`                                                                                                    |

No overlap between `bmad` and `docs` — `docs/` is never `bmad`, even though it's also "AI context" in the path-mapping table above; the type reflects who/what produced the change (a human writing docs vs. a BMAD workflow step), not who reads it later.

**Mixed diffs**, most-specific-wins:

- App code + anything else → `feat`/`fix` wins, mention the other change in the body.
- `_bmad-output/` + `docs/`, no app code → whichever path has the larger/driving change; if genuinely tied, `bmad`.

Read the actual staged diff (`git diff --cached`) before drafting — don't guess at scope/type from conversation alone.

Add a footer only when it carries real information — don't pad every commit with a boilerplate footer:

```
BMAD-Agent: claude-code
BMAD-Story: {story_key}
BMAD-Decision: <what and why, if applicable — omit if there's no real decision to record>
BMAD-Reviewed-By: <human, only once an actual human has reviewed — never fill this in preemptively>
```

`BMAD-Agent` and `BMAD-Reviewed-By` are usually omitted at commit time: `BMAD-Agent` only matters when it's not obvious from context who/what generated the change, and `BMAD-Reviewed-By` should never be filled in by the skill itself — that's a human's attestation, not something to draft on their behalf.

### Action: pr

**Base branch — decide this before drafting anything.** Never leave it to GitHub's default or assume:

- Current branch is `story/*`, `fix/*`, or `chore/*` → base is **`develop`**. Always.
- Current branch is `develop` and the user explicitly wants a release → base is **`main`** (release PR, milestone-driven, not per-story — confirm this is really what they mean, not a story PR opened from the wrong place).
- If asked to open the PR directly (`gh pr create`), pass `--base develop` (or `main` for a release) explicitly — don't rely on the repo's default branch. GitHub defaults new PRs to the repo's default branch, which is commonly `main`, not `develop` — that mismatch is exactly what happened the first time this was tried here.
- If drafting only (no `gh` available or not asked to run it), still state the base explicitly in the handoff: "apri questa PR verso `develop`" — don't leave it implicit.
- Already-open PR pointed at the wrong base: don't recreate it — GitHub lets you retarget an existing PR (edit the base in the PR header, or `gh pr edit <n> --base develop`).

If `.github/PULL_REQUEST_TEMPLATE.md` doesn't exist yet, mention that GitHub will pre-fill new PRs with it once created — offer to write it (via `setup`, not here) using the same shape below, so the user doesn't have to paste this manually every time. Don't create it inline as a side effect of drafting one PR body.

Draft a PR body from this shape, filled from the actual diff and the story file (read `_bmad-output/implementation-artifacts/{story_key}.md` for the AC list — don't fabricate acceptance criteria):

```markdown
## Story Reference
- **Story:** {story_key} — {title}
- **Story file:** `_bmad-output/implementation-artifacts/{story_key}.md`
- **Acceptance Criteria met:** ...

## Summary of Changes
...

## AI Agent Activity
- **Agent-generated code:** Yes/No — which files
- **Human review of agent code:** Yes/No
- **Key AI decisions made (and rationale):** ...

## BMAD Context Changes
- [ ] `docs/` or `_bmad-output/planning-artifacts/` updated
- [ ] `_bmad-output/implementation-artifacts/{story_key}.md` updated (ACs checked off)
- [ ] `_bmad/custom/` overrides updated
- [ ] No BMAD context changes in this PR

## How to Review
...

## Checklist
- [ ] Tests added/updated
- [ ] `_bmad-output/planning-artifacts/architecture.md` updated if a new architectural decision was made
- [ ] Self-reviewed all AI-generated code line by line
- [ ] No secrets in any file
```

Squash & merge story branches into `develop`. Merge commit (not squash, not rebase) for `develop` → `main`. Never rebase-merge — it's the playbook's explicit rule to preserve the BMAD-Decision footer trail.

**After the story PR merges**: the playbook moves the story file from `active/` to `completed/`; here there's no such folder, so the equivalent is updating the `Status` field inside `_bmad-output/implementation-artifacts/{story_key}.md` (e.g. to `Done`). Offer this as a small follow-up `chore` commit on `develop`, not bundled into the feature PR itself.

### Action: conflict

Conflict risk levels, from the playbook, mapped to real paths:

| Files in conflict                                               | Risk        | Resolution owner                               |
| --------------------------------------------------------------- | ----------- | ---------------------------------------------- |
| App source code                                                 | Low–Medium | Story owner, AI-assisted                       |
| `_bmad-output/planning-artifacts/` (prd, architecture, epics) | High        | Story owner + team lead review                 |
| `_bmad-output/implementation-artifacts/{story_key}.md`        | Medium      | Story owner's version wins; notify other party |
| `_bmad/custom/*.toml`                                         | High        | Team lead decision, notify whole team          |
| `docs/`                                                       | Medium      | Team consensus — read by every agent session  |

**Preventing conflicts, not just resolving them** (playbook §5.3): treat `_bmad-output/planning-artifacts/` as read-only while any story branch is active — updates to it go through their own dedicated PR to `develop`, never bundled silently into a story branch. If the user is mid-story and wants to change `architecture.md` or `prd.md`, suggest splitting that into a separate `chore/update-shared-context` branch instead of carrying it on the story branch — it's what causes the high-risk conflicts in the first place.

Never auto-resolve conflicts in these files with a blind merge. When asked to help resolve one:

1. Read both sides of the conflict plus the relevant story/architecture file for context.
2. Propose a resolution grounded in what's actually in those files — quote them, don't paraphrase from memory.
3. For `planning-artifacts` or `_bmad/custom/` conflicts, flag explicitly that this needs a second human reviewer before merge; don't present the resolution as final.

## Repo-safety rules

`setup` is the one action that touches the repo directly (`git init`, creating `main`/`develop`, writing `.gitignore`/`CODEOWNERS`/PR template) — confirm each step individually as described there, never batch them into one silent pass. Every other action (`branch`, `commit`, `pr`, `conflict`) only drafts names, messages, and bodies — it does not push, force-push, merge, delete branches, or commit on the user's behalf. Handing over a ready-to-run command is not the same as running it; wait for explicit "yes, do it" before any command with real side effects.
