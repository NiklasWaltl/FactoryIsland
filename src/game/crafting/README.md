# `crafting/` — Crafting Subsystem

> Most complex subsystem in the repo. This README replaces reading 5+ files.

---

## Purpose

Manages all crafting jobs (Workbench, Manual Assembler, Smithy via output routing). Strictly separated: **Planning** (what should be built) vs. **Execution** (advance running jobs). Reservations live in [`../inventory/`](../inventory/), output routing here in [`output.ts`](./output.ts).

---

## Job Lifecycle

```
                    ┌──────────────────────┐
                    │       queued         │  no reservations held
                    └──────────┬───────────┘
                               │ Phase 2: reservation phase
                               │ (alle Ingredients reservierbar?)
                               ▼
                    ┌──────────────────────┐
                    │      reserved        │  network holds active
                    └──────────┬───────────┘
                               │ Phase 3: workbench frei?
                               ▼
                    ┌──────────────────────┐
                    │      crafting        │  workbench timer läuft
                    └──────────┬───────────┘
                               │ Phase 1: progress + commit
                               ▼
                    ┌──────────────────────┐
                    │     delivering       │  warten auf Drone-Pickup/Output
                    └──────────┬───────────┘
                               │ routeOutput()
                               ▼
                    ┌──────────────────────┐
                    │        done          │  terminal
                    └──────────────────────┘

   Aus jedem Status → cancelled (terminal, Reservierungen released)
```

Phase order per tick (`crafting/tick.ts`):

1. **Progress active `crafting` jobs** — commit ingredients + transition → `delivering`
2. **Promote `queued` → `reserved`** — when ingredients are reservable
3. **Promote `reserved` → `crafting`** — when workbench is free (instant completion when `processingTime===0`)

→ A freshly enqueued job can traverse `queued → reserved → crafting → delivering` in a single tick.

Status definition: [`crafting/types.ts:27`](./types.ts#L27).

---

## Planning vs. Execution (architecture rule)

`JOB_TICK` is split into two phases ([`tickPhases.ts`](./tickPhases.ts)):

| Phase | File | May enqueue new jobs? | Responsibility |
|---|---|---|---|
| **Planning** | [`workflows/keepStockWorkflow.ts`](./workflows/keepStockWorkflow.ts) | **yes, only here** | decide + plan + enqueue keep-stock refills |
| **Execution** | [`tick.ts`](./tick.ts) → `tick/job-lifecycle.ts` | **no, never** | advance existing jobs |

**Rule:** Conveyor, drone, and smelter ticks must also never create new crafting jobs. If a feature needs new auto-start logic, it belongs in the Planning phase.

---

## Module Map

| File / Folder | Purpose |
|---|---|
| [`types.ts`](./types.ts) | Pure data types: `CraftingJob`, `CraftingQueueState`, `JobStatus`, `CraftingInventorySource`. |
| [`tick.ts`](./tick.ts) | Orchestrator. Re-export hub. Phase 2 (reservation) lives here. |
| [`tickPhases.ts`](./tickPhases.ts) | Splits `JOB_TICK` into `applyPlanningTriggers` + `applyExecutionTick`. |
| [`tick/job-lifecycle.ts`](./tick/job-lifecycle.ts) | finish/cancel/release helpers + DEV invariants. |
| [`tick/source-selection.ts`](./tick/source-selection.ts) | `pickCraftingPhysicalSourceForIngredient` — where the ingredient physically comes from. |
| [`tick/hub-inventory-view.ts`](./tick/hub-inventory-view.ts) | Hub↔inventory adapter (hub inventory as virtual "Warehouse"). |
| [`queue/queue.ts`](./queue/queue.ts) | Pure queue helpers: enqueue/cancel/move/setPriority/sortByPriorityFifo. |
| [`queue/jobStatus.ts`](./queue/jobStatus.ts) | Read-only status queries for planning + UI. |
| [`queue/index.ts`](./queue/index.ts) | Barrel. |
| [`planner/planner.ts`](./planner/planner.ts) | `buildWorkbenchAutoCraftPlan` — creates step list for keep-stock refills (recursive through recipes). |
| [`planner/index.ts`](./planner/index.ts) | Barrel. |
| [`policies/policies.ts`](./policies/policies.ts) | `RecipeAutomationPolicy` logic (autoCraftAllowed, keepInStockAllowed, manualOnly). |
| [`policies/keepStockDecision.ts`](./policies/keepStockDecision.ts) | Per-target gate decision (single source of truth, shared with UI). |
| [`policies/index.ts`](./policies/index.ts) | Barrel. |
| [`workflows/keepStockWorkflow.ts`](./workflows/keepStockWorkflow.ts) | Planning side effect: plan + enqueue refill steps + recheck per step. |
| [`crafting-sources.ts`](./crafting-sources.ts) | Resolves `CraftingInventorySource` → concrete inventory view (`getCraftingSourceInventory`, `applyCraftingSourceInventory`). |
| [`output.ts`](./output.ts) | `routeOutput` — where finished output lands (Warehouse → Hub → global fallback). |
| [`workbench-input-buffer.ts`](./workbench-input-buffer.ts), [`workbench-input-complete.ts`](./workbench-input-complete.ts) | Drone input buffer per workbench (drones deliver ingredients; job starts only when buffer is complete). |

---

## Layer Overview (Data View)

```
              ┌────────────────────────────────────────┐
              │  Recipes (simulation/recipes/*)        │  ← statische Definitionen
              └─────────────────┬──────────────────────┘
                                │ Snapshot bei enqueue
                                ▼
   ┌────────────────────────────────────────────────────────┐
   │   CraftingQueueState  (state.crafting)                 │  ← Job-Liste mit Status
   └─────────────┬───────────────────────────┬──────────────┘
                 │                           │
       network reservations              physical stock
                 │                           │
                 ▼                           ▼
   ┌──────────────────────┐    ┌──────────────────────────────┐
   │  state.network       │    │ state.warehouseInventories   │
   │  (logical holds)     │    │ + state.inventory (global)   │
   │  inventory/          │    │ + state.serviceHubs[].inv    │
   └──────────────────────┘    └──────────────────────────────┘
```

**Source-of-truth rule:** Physical inventories are authoritative. `network.reserved` is *always* ≤ physically available (DEV invariant in [`tick/job-lifecycle.ts`](./tick/job-lifecycle.ts)).

---

## Common Tasks → Entry Points

| Task | File to Read/Edit |
|---|---|
| Add new Recipe | [`../simulation/recipes/`](../simulation/recipes/) (no crafting code change needed) |
| Change job status transition | [`tick.ts`](./tick.ts) + [`tick/job-lifecycle.ts`](./tick/job-lifecycle.ts) |
| Change output routing (e.g. hub priority) | [`output.ts`](./output.ts) |
| Change auto-refill behavior | [`workflows/keepStockWorkflow.ts`](./workflows/keepStockWorkflow.ts) + [`policies/keepStockDecision.ts`](./policies/keepStockDecision.ts) |
| Reservation bug | [`../inventory/reservations.ts`](../inventory/reservations.ts) — *not* in `crafting/` |
| UI display of job status | [`../ui/panels/WorkbenchPanel.tsx`](../ui/panels/WorkbenchPanel.tsx) + [`../ui/hud/productionTransparency.ts`](../ui/hud/productionTransparency.ts) |
| Planner depth / ingredient resolution | [`planner/planner.ts`](./planner/planner.ts) (`DEFAULT_MAX_DEPTH = 12`) |

---

## Recipe Schema (`WorkbenchRecipe`)

Defined in [`../simulation/recipes/WorkbenchRecipes.ts`](../simulation/recipes/WorkbenchRecipes.ts). Important to understand *which* field the crafting pipeline actually reads:

| Field | Type | Used by the crafting system for what? |
|---|---|---|
| `key` | `string` | Recipe ID (`recipeId` lookup via `getWorkbenchRecipe`). |
| `label`, `emoji` | `string` | UI-only (Workbench panel, tooltips). |
| `outputItem` | `string` | What the job produces; delivered via `routeOutput`. Must be registered in `isKnownItemId`. |
| `outputAmount` | `number` | Output amount per job completion. |
| `processingTime` | `number` (seconds) | Workbench timer duration. **`processingTime: 0` is a special path** (see below). |
| **`costs`** | `Partial<Record<keyof Inventory, number>>` | **Canonical ingredient source.** [`queue/queue.ts`](./queue/queue.ts) `recipeIngredientsToStacks` iterates exclusively over `costs` to build the job's `ingredients: ItemStack[]`. Reservations + plan ingredients ([`planner/planner.ts`](./planner/planner.ts)) also read from `costs`. |
| `inputItem` | `string` | **Not read in the crafting flow.** No match in `crafting/` for `recipe.inputItem`. The field is a legacy hint for UI/smelter-like paths — in Workbench recipes it is informational. (*Notes: to verify during later extensions — see note below.*) |

> **When you change costs/duration of a Recipe:**
> - Costs ⇒ edit `costs` (not `inputItem`).
> - Duration ⇒ edit `processingTime`.
> - Running jobs use the frozen snapshot (see recipe snapshot strategy below) — the effect is visible only for *newly enqueued* jobs.

### `processingTime: 0` Special Path

In [`tick.ts`](./tick.ts) (Phase 3, promotion `reserved → crafting`):

```ts
if (promoted.processingTime === 0) {
  const completed = finishCraftingJob(promoted, …);
  …
}
```

Effect: The job traverses `queued → reserved → crafting → delivering` in **a single `JOB_TICK`**. `finishCraftingJob` commits reservations immediately and routes the output directly. On the UI side, the `crafting` state is never visible — the job effectively appears instantly in `delivering`.

### Recipe Family Disambiguation

Three different recipe types exist in parallel; the crafting subsystem uses **only** `WorkbenchRecipe`:

| Recipe Type | File | Consumed by |
|---|---|---|
| `WorkbenchRecipe` | [`recipes/WorkbenchRecipes.ts`](../simulation/recipes/WorkbenchRecipes.ts) | `crafting/` (jobs, planner, queue) — `costs` as ingredients |
| `SmeltingRecipe` | [`recipes/SmeltingRecipes.ts`](../simulation/recipes/SmeltingRecipes.ts) | [`store/action-handlers/logistics-tick/phases/auto-smelter.ts`](../store/action-handlers/logistics-tick/phases/auto-smelter.ts) — uses `inputItem`/`inputAmount`/`outputItem` |
| `ManualAssemblerRecipe` | [`recipes/ManualAssemblerRecipes.ts`](../simulation/recipes/ManualAssemblerRecipes.ts) | [`store/action-handlers/manual-assembler-actions.ts`](../store/action-handlers/manual-assembler-actions.ts) — uses `inputItem`/`inputAmount`/`outputItem` |

---

## Notes & Gotchas

- **Recipe snapshot strategy:** `CraftingJob` freezes `ingredients`, `output`, `processingTime` on enqueue. Mid-game recipe edits do not corrupt running jobs.
- **`enqueuedAt` ≠ Wallclock.** It is a monotonic sequence counter. `startedAt`/`finishesAt` are wallclock `Date.now()` and informational only.
- **`done_pending_storage` intentionally does not exist** — warehouses do not have a hard item cap that could reject a deposit.
- **Owner convention:** `job.owner === job.id`. Stored explicitly to make the connection visible.
- **Planner is recursive** with `DEFAULT_MAX_DEPTH = 12`. Deep recipe trees could theoretically abort. (*Notes: not observed in practice — to verify.*)
- **Tests** live under [`__tests__/`](./__tests__/) and [`workflows/__tests__/`](./workflows/__tests__/). Lifecycle transitions are documented there authoritatively.