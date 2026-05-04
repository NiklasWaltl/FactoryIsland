---
applyTo: "**/SYSTEM_REGISTRY.md"
---

#codebase

Please perform a self-audit of `SYSTEM_REGISTRY.md` against the changes introduced since the last commit.

## Goal

Determine whether `SYSTEM_REGISTRY.md` is still aligned with the latest code changes by checking:

1. Which documented systems in `SYSTEM_REGISTRY.md` were **not touched** by the code changes since the previous commit
2. Which changed files or changed subsystems are **not reflected** in `SYSTEM_REGISTRY.md`
3. Whether the document needs an update now, or whether it remains valid for the latest commit

Use the last commit diff as baseline (`HEAD~1..HEAD`). Prefer actual Git history / changed-file evidence over guesswork.

## Audit method

1. Read `SYSTEM_REGISTRY.md` and extract its documented systems, subsystems, hotspots, action clusters, persistence sections, UI surfaces, and task-to-system mappings.
2. Inspect the code changes introduced in the most recent commit using the equivalent of:
   - `git diff --name-only HEAD~1 HEAD`
   - `git diff HEAD~1 HEAD -- <relevant file>`
3. Group changed files into higher-level systems, for example:
   - crafting
   - logistics
   - energy
   - drones
   - ship / dock
   - module lab
   - save / migrations
   - UI panels / HUD / menus
   - dev scenes
   - conveyors / splitter routing
4. Compare the changed systems against the corresponding sections in `SYSTEM_REGISTRY.md`.
5. Classify findings using the legend below.

## Classification

| Symbol | Meaning |
|--------|---------|
| 🟢 | Changed code is already accurately covered by `SYSTEM_REGISTRY.md` |
| 🟡 | Related section exists, but it likely needs a refresh because the changed code altered behavior, names, files, state, or responsibilities |
| 🔴 | Changed code introduced or modified something important that is missing from `SYSTEM_REGISTRY.md` |
| ⚪ | Documented system was not touched by the last commit |

## Important rules

- Do NOT rewrite the document.
- Do NOT change source code.
- Do NOT mark a system as stale only because its files were unchanged.
- Focus on **delta awareness**: what changed in code vs. what the registry claims.
- Prefer concrete evidence: changed files, changed exports, changed state fields, changed action names, changed save slices, changed UI routes.
- If a commit only refactors internal implementation without affecting documented architecture, say so explicitly.
- If a changed file belongs to a documented system but does not invalidate the current docs, mark it 🟢, not 🟡.

## Output format

### 1. Commit Coverage
Provide a compact table:

| Changed File | System | Registry Section | Status |
|-------------|--------|------------------|--------|

### 2. Systems Not Touched
List all major systems from `SYSTEM_REGISTRY.md` that were not affected by the last commit:

- ⚪ ...
- ⚪ ...
- ⚪ ...

### 3. Potential Registry Drift
For every 🟡 or 🔴 item, use this format:

#### 🟡 [System or Topic]
- Changed in: `path/to/file.ts`
- Registry currently says: "..."
- Possible drift: ...
- Recommended doc update: ...

#### 🔴 [System or Topic]
- Changed in: `path/to/file.ts`
- Missing from registry: ...
- Why it matters: ...
- Recommended doc update: ...

### 4. Final Verdict
End with exactly one of these statements:

- `SYSTEM_REGISTRY.md is still current for the latest commit.`
- `SYSTEM_REGISTRY.md is mostly current, but has targeted drift.`
- `SYSTEM_REGISTRY.md is no longer current after the latest commit.`

### 5. Confidence
Add:
- `Confidence: High` if the changed files map clearly to documented systems
- `Confidence: Medium` if file-to-system mapping required interpretation
- `Confidence: Low` if the commit was too broad or ambiguous
