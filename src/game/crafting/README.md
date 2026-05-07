# `crafting/` — Crafting Subsystem

> Most complex subsystem in the repo. This README replaces reading 5+ files.

---

## Purpose

Das Crafting-Subsystem verwaltet die Workbench-Job-Queue. Manual Assembler und Smelting laufen in eigenen Action-Pfaden; die Output-Routing-API in [`output.ts`](./output.ts) ist vor allem im Workbench-/Drone-Kontext relevant. Strictly separated: **Planning** (what should be built) vs. **Execution** (advance running jobs). Reservations live in [`../inventory/`](../inventory/).

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
                               │ Phase 3: inputBuffer komplett +
                               │          workbench ready?
                               ▼
                    ┌──────────────────────┐
                    │      crafting        │  workbench timer läuft
                    └──────────┬───────────┘
                               │ Phase 1: progress +
                               │          lifecycle transition
                               ▼
                    ┌──────────────────────┐
                    │     delivering       │  warten auf Drone-Pickup/Output
                    └──────────┬───────────┘
                               │ routeOutput()
                               ▼
                    ┌──────────────────────┐
                    │        done          │  terminal
                    └──────────────────────┘

```

Cancel ist für `queued`, `reserved` und `crafting` erlaubt. `delivering` ist nicht mehr stornierbar (läuft weiter nach `done`); `done` ist terminal.

Phase order per tick (`crafting/tick.ts`):

1. **Progress active `crafting` jobs** — lifecycle progress; on completion status transition → `delivering` (no ingredient commit here)
2. **Promote `queued` → `reserved`** — reserve ingredients when they are reservable
3. **Promote `reserved` → `crafting`** — only when `inputBuffer` is complete and the workbench is ready/free (not deconstructing, not under construction; instant completion when `processingTime===0`)

Ein neu enqueueter Job erreicht `delivering` im selben Tick nur wenn der `inputBuffer` bereits vollständig gefüllt ist, die Workbench ready ist und `processingTime === 0`.

Status definition: [`crafting/types.ts:27`](./types.ts#L27).

---

## Planning vs. Execution (architecture rule)

`JOB_TICK` is split into two phases ([`tickPhases.ts`](./tickPhases.ts)):

| Phase         | File                                                                 | May enqueue new jobs? | Responsibility                             |
| ------------- | -------------------------------------------------------------------- | --------------------- | ------------------------------------------ |
| **Planning**  | [`workflows/keepStockWorkflow.ts`](./workflows/keepStockWorkflow.ts) | **yes, only here**    | decide + plan + enqueue keep-stock refills |
| **Execution** | [`tick.ts`](./tick.ts) → `tick/job-lifecycle.ts`                     | **no, never**         | advance existing jobs                      |

**Rule:** Conveyor, drone, and smelter ticks must also never create new crafting jobs. If a feature needs new auto-start logic, it belongs in the Planning phase.

---

## Module Map

| File / Folder                                                                                                              | Purpose                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [`types.ts`](./types.ts)                                                                                                   | Pure data types: `CraftingJob`, `CraftingQueueState`, `JobStatus`, `CraftingInventorySource`.                                |
| [`tick.ts`](./tick.ts)                                                                                                     | Orchestrator. Re-export hub. Calls the three execution phases in order.                                                      |
| [`tick/phases/`](./tick/phases/)                                                                                           | Execution phases: `phase-progress-crafting.ts`, `phase-reserve-queued.ts`, `phase-promote-reserved.ts`.                      |
| [`tickPhases.ts`](./tickPhases.ts)                                                                                         | Splits `JOB_TICK` into `applyPlanningTriggers` + `applyExecutionTick`.                                                       |
| [`tick/job-lifecycle.ts`](./tick/job-lifecycle.ts)                                                                         | finish/cancel/release helpers + DEV invariants.                                                                              |
| [`tick/source-selection.ts`](./tick/source-selection.ts)                                                                   | `pickCraftingPhysicalSourceForIngredient` — where the ingredient physically comes from.                                      |
| [`tick/hub-inventory-view.ts`](./tick/hub-inventory-view.ts)                                                               | Hub↔inventory adapter (hub inventory as virtual "Warehouse").                                                                |
| [`queue/queue.ts`](./queue/queue.ts)                                                                                       | Pure queue helpers: enqueue/cancel/move/setPriority/sortByPriorityFifo.                                                      |
| [`queue/jobStatus.ts`](./queue/jobStatus.ts)                                                                               | Read-only status queries for planning + UI.                                                                                  |
| [`queue/index.ts`](./queue/index.ts)                                                                                       | Barrel.                                                                                                                      |
| [`planner/planner.ts`](./planner/planner.ts)                                                                               | `buildWorkbenchAutoCraftPlan` — creates step list for keep-stock refills (recursive through recipes).                        |
| [`planner/index.ts`](./planner/index.ts)                                                                                   | Barrel.                                                                                                                      |
| [`policies/policies.ts`](./policies/policies.ts)                                                                           | `RecipeAutomationPolicy` logic (autoCraftAllowed, keepInStockAllowed, manualOnly).                                           |
| [`policies/keepStockDecision.ts`](./policies/keepStockDecision.ts)                                                         | Per-target gate decision (single source of truth, shared with UI).                                                           |
| [`policies/index.ts`](./policies/index.ts)                                                                                 | Barrel.                                                                                                                      |
| [`workflows/keepStockWorkflow.ts`](./workflows/keepStockWorkflow.ts)                                                       | Planning side effect: plan + enqueue refill steps + recheck per step.                                                        |
| [`crafting-sources.ts`](./crafting-sources.ts)                                                                             | Resolves `CraftingInventorySource` → concrete inventory view (`getCraftingSourceInventory`, `applyCraftingSourceInventory`). |
| [`output.ts`](./output.ts)                                                                                                 | `routeOutput` — where finished output lands (Warehouse → Hub → global fallback).                                             |
| [`workbench-input-buffer.ts`](./workbench-input-buffer.ts), [`workbench-input-complete.ts`](./workbench-input-complete.ts) | Drone input buffer per workbench (drones deliver ingredients; job starts only when buffer is complete).                      |

Die Execution ist auf einen Orchestrator (`tick`) und drei Phasenmodule aufgeteilt: `progress` (crafting-Jobs), `reserve` (queued-Jobs), `promote` (reserved-Jobs). Lifecycle-Helfer liegen in `job-lifecycle`.

---

## Advanced / Implementation Details

### Execution-Phasen

Die drei Phasenmodule `progress`, `reserve` und `promote` kapseln die jeweiligen Tick-Transitionen und werden vom Orchestrator in fester Reihenfolge aufgerufen.

### Planner-Core

Der Planner ist zweistufig: öffentliche Planner-API + rekursiver `planner-core` mit Fehler-Typisierung, Zustandsprojektion und `DEFAULT_MAX_DEPTH`. Der Core seedet erwartete Outputs nur für Jobs in `reserved`, `crafting` oder `delivering` derselben Inventory-Source.

### Scope-Key-System

Reservations nutzen ein Scope-Key-System mit Legacy-Scope und source-spezifischen Lane-Scopes (Warehouse-Lane).

### Output-Routing-API

Neben `routeOutput` gehören `resolveOutputDestination` und `pickOutputWarehouseId` zur gemeinsamen Runtime/Planner-API; genutzt wird sie vor allem im Workbench-/Drone-Pfad.

### CraftingAction-Union

`CraftingAction` umfasst Queue-Aktionen sowie `CRAFT_REQUEST_WITH_PREREQUISITES` für Plan-und-Enqueue-Flows.

### Prioritätskonfiguration

Reihenfolge ist zentral über `PRIORITY_ORDER` und `defaultPriorityFor` definiert. Queue-Reorder ist auf `queued`/`reserved` begrenzt; `top` setzt hohe Priorität und einen FIFO-Sentinel via `enqueuedAt`.

### Keep-Stock-Entscheidungsmodell

Entscheidungen sind als typed Decision-Union (`skip` | `satisfied` | `enqueue`) mit klaren Skip-Codes modelliert. Blocker umfassen offene Player-Jobs, Construction-Sites und pending Service-Hub-Upgrades.

### Lifecycle-Übergänge außerhalb des Crafting-Ticks

- **Input-Commit:** Ingredient-Reservations werden im Drone-Collecting-Pfad committed (`handleCollectingStatus` → `commitWorkbenchInputReservation`) und physisch ausgebucht, bevor der Input an der Workbench abgeliefert wird.
- **delivering → done:** Dieser Übergang inkl. Output-Deposit liegt im Drone-Workbench-Finalizer, nicht im Crafting-Tick.
- **Input-Complete-Prüfung:** Basiert auf `getWorkbenchJobInputAmount` aus den Drone-Need-Resolvern.

### Globale Source / Pseudo-Warehouse-Modell

Für globale Quellen werden Global-Inventory und Hub-Collectables über pseudo-Warehouse-IDs in ein einheitliches View-Modell überführt.

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

**Source-of-truth rule:** Die DEV-Invariant prüft Konsistenz zwischen Jobs und Reservations. Physische Verfügbarkeit wird über die Reservation-Engine abgesichert.

---

## Common Tasks → Entry Points

| Task                                      | File to Read/Edit                                                                                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add new Recipe                            | [`../simulation/recipes/`](../simulation/recipes/) (no crafting code change needed)                                                                 |
| Change job status transition              | [`tick.ts`](./tick.ts) + [`tick/job-lifecycle.ts`](./tick/job-lifecycle.ts)                                                                         |
| Change output routing (e.g. hub priority) | [`output.ts`](./output.ts)                                                                                                                          |
| Change auto-refill behavior               | [`workflows/keepStockWorkflow.ts`](./workflows/keepStockWorkflow.ts) + [`policies/keepStockDecision.ts`](./policies/keepStockDecision.ts)           |
| Reservation bug                           | [`../inventory/reservations.ts`](../inventory/reservations.ts) — _not_ in `crafting/`                                                               |
| UI display of job status                  | [`../ui/panels/WorkbenchPanel.tsx`](../ui/panels/WorkbenchPanel.tsx) + [`../ui/hud/productionTransparency.ts`](../ui/hud/productionTransparency.ts) |
| Planner depth / ingredient resolution     | [`planner/planner-core.ts`](./planner/planner-core.ts) (`DEFAULT_MAX_DEPTH = 12`)                                                                   |

Status-Transitionen finden in den Phasenmodulen und `job-lifecycle`-Helfern statt. `DEFAULT_MAX_DEPTH` ist im Planner-Core konfiguriert.

---

## Recipe Schema (`WorkbenchRecipe`)

Defined in [`../simulation/recipes/WorkbenchRecipes.ts`](../simulation/recipes/WorkbenchRecipes.ts). Important to understand _which_ field the crafting pipeline actually reads:

| Field            | Type                                       | Used by the crafting system for what?                                                                                                                                                                                                                                                     |
| ---------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`            | `string`                                   | Recipe ID (`recipeId` lookup via `getWorkbenchRecipe`).                                                                                                                                                                                                                                   |
| `label`, `emoji` | `string`                                   | UI-only (Workbench panel, tooltips).                                                                                                                                                                                                                                                      |
| `outputItem`     | `string`                                   | What the job produces; delivered via `routeOutput`. Must be registered in `isKnownItemId`.                                                                                                                                                                                                |
| `outputAmount`   | `number`                                   | Output amount per job completion.                                                                                                                                                                                                                                                         |
| `processingTime` | `number` (seconds)                         | Workbench timer duration. **`processingTime: 0` is a special path** (see below).                                                                                                                                                                                                          |
| **`costs`**      | `Partial<Record<keyof Inventory, number>>` | **Canonical ingredient source.** [`queue/queue.ts`](./queue/queue.ts) `recipeIngredientsToStacks` iterates exclusively over `costs` to build the job's `ingredients: ItemStack[]`. Reservations + plan ingredients ([`planner/planner.ts`](./planner/planner.ts)) also read from `costs`. |
| `inputItem`      | `string`                                   | **Not read in the crafting flow.** No match in `crafting/` for `recipe.inputItem`. The field is a legacy hint for UI/smelter-like paths — in Workbench recipes it is informational. (_Notes: to verify during later extensions — see note below._)                                        |

> **When you change costs/duration of a Recipe:**
>
> - Costs ⇒ edit `costs` (not `inputItem`).
> - Duration ⇒ edit `processingTime`.
> - Running jobs use the frozen snapshot (see recipe snapshot strategy below) — the effect is visible only for _newly enqueued_ jobs.

### `processingTime: 0` Special Path

In [`tick/phases/phase-promote-reserved.ts`](./tick/phases/phase-promote-reserved.ts) (Phase 3, promotion `reserved → crafting`):

```ts
if (promoted.processingTime === 0) {
  const completed = finishCraftingJob(promoted, …);
  …
}
```

Bei `processingTime === 0` wechselt der Job im selben Tick nach `delivering`. Output-Einlagerung und der Übergang nach `done` folgen im Drone-Workbench-Finalizer.

### Recipe Family Disambiguation

Three different recipe types exist in parallel; the crafting subsystem uses **only** `WorkbenchRecipe`:

| Recipe Type             | File                                                                                   | Consumed by                                                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WorkbenchRecipe`       | [`recipes/WorkbenchRecipes.ts`](../simulation/recipes/WorkbenchRecipes.ts)             | `crafting/` (jobs, planner, queue) — `costs` as ingredients                                                                                                                   |
| `SmeltingRecipe`        | [`recipes/SmeltingRecipes.ts`](../simulation/recipes/SmeltingRecipes.ts)               | [`store/action-handlers/logistics-tick/phases/auto-smelter.ts`](../store/action-handlers/logistics-tick/phases/auto-smelter.ts) — uses `inputItem`/`inputAmount`/`outputItem` |
| `ManualAssemblerRecipe` | [`recipes/ManualAssemblerRecipes.ts`](../simulation/recipes/ManualAssemblerRecipes.ts) | [`store/action-handlers/manual-assembler-actions.ts`](../store/action-handlers/manual-assembler-actions.ts) — uses `inputItem`/`inputAmount`/`outputItem`                     |

---

## Notes & Gotchas

- **Recipe snapshot strategy:** `CraftingJob` freezes `ingredients`, `output`, `processingTime` on enqueue. Mid-game recipe edits do not corrupt running jobs.
- **`enqueuedAt` ≠ Wallclock.** It is a monotonic sequence counter. `startedAt`/`finishesAt` are wallclock `Date.now()` and informational only.
- **`done_pending_storage` intentionally does not exist** — warehouses do not have a hard item cap that could reject a deposit.
- **Owner convention:** `reservationOwnerId` entspricht `job.id`.
- **Planner is recursive** with `DEFAULT_MAX_DEPTH = 12`. Deep recipe trees could theoretically abort. (_Notes: not observed in practice — to verify._)
- **Tests** live under [`__tests__/`](./__tests__/) and [`workflows/__tests__/`](./workflows/__tests__/). Lifecycle transitions are documented there authoritatively.
