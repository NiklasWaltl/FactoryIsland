# SYSTEM_REGISTRY.md

> AI-friendly navigation map for Factory Island. Current state, not target state.
> Last verified: 2026-05-01.

---

## 1. Purpose

Compact index of all core systems with paths, responsibilities, read/write boundaries, and entry points — so future prompts can find the right code in 1–2 tool calls without exploratory searching first.

Deeper content: see [src/game/ARCHITECTURE.md](src/game/ARCHITECTURE.md), [src/game/TYPES.md](src/game/TYPES.md), [README.md](README.md).

---

## AI Usage of This File

Use this file as a routing overview, not as a detail document.
When a task is named:
1. Identify the affected system first.
2. Then read only the listed main paths for that system.
3. Pull in ARCHITECTURE.md only for runtime or data-flow questions.
4. Pull in TYPES.md only for type/domain questions.
5. If information here is marked as UNCERTAIN, validate it in code before proposing changes.

### Task-to-System Matrix

| Task | Primary Systems | Secondary Systems |
|---|---|---|
| New building | Building Placement, Reducer, UI-Panels | Inventory, Energy |
| New recipe | Crafting, Simulation/Recipes | Inventory, UI-Panels |
| New UI panel | UI-Panels | Store, Selection-State |
| New drone rule | Drones | Inventory, Tick-Pipeline |

---

## 2. Stack & Guiding Rules

- **Stack:** React 18 + TypeScript + Phaser 3 + Vite. Tests via Jest. Yarn 1.x.
- **State:** a single `useReducer` (`GameState` in [src/game/store/types.ts](src/game/store/types.ts)). Single source of truth.
- **Tick-driven:** ~10 independent `setInterval` calls in [src/game/entry/use-game-ticks.ts](src/game/entry/use-game-ticks.ts) (mounted from [src/game/entry/FactoryApp.tsx](src/game/entry/FactoryApp.tsx)) → `dispatch({type: "*_TICK"})`.
- **Golden rule:** Phaser NEVER calls `dispatch`. Only the React UI may mutate state. Phaser reads snapshots.
- **Action discoverability:** `grep "case \"X_ACTION\":" src/game` returns exactly one match.
- **`GameAction` union:** canonical in [src/game/store/game-actions.ts](src/game/store/game-actions.ts). No re-export hub.
- **Persistence:** `localStorage` every 10 s + `beforeunload`. HMR restore via `sessionStorage`.
- **Determinism:** all tick logic is pure functions over `state`.

---

## 3. Runtime Map

1. `main.factory.tsx` boots React → mounts `FactoryApp`.
2. `FactoryApp` selects mode (`debug` | `release`) and mounts `GameInner` with `key=mode`.
3. `GameInner` initializes `useReducer(gameReducer)` and ~10 tick intervals.
4. UI (HUD + Panels) reads `state` as a prop and calls `dispatch` directly.
5. Phaser (`PhaserHost` + `PhaserGame`) receives state snapshots for render synchronization.
6. All mutations → `dispatch(action)` → `gameReducer` → cluster handler chain → new state.
7. Save codec periodically serializes `GameState` into `localStorage`; hydration on mount.
8. Tick order within a browser frame is NOT guaranteed.

---

## 4. Core Systems — Overview

| System | Main Path | Responsibility | Reads | Writes | Dependencies | Not Responsible For |
|---|---|---|---|---|---|---|
| **Entry / Bootstrap** | [src/game/entry/](src/game/entry/) | App shell, reducer mount, tick intervals, HMR restore | `state` (lifecycle) | `dispatch` | Store, UI, Save | game logic, rendering |
| **Reducer / Dispatch** | [src/game/store/reducer.ts](src/game/store/reducer.ts), [game-reducer-dispatch.ts](src/game/store/game-reducer-dispatch.ts) | Central action dispatch chain | entire `GameState` | entire `GameState` | all action handlers | UI, rendering |
| **Action-Handlers** | [src/game/store/action-handlers/](src/game/store/action-handlers/) | Cluster handler per action type | `state` + `deps` | slices via pure updates | Decisions, Helpers, Selectors | tick scheduling |
| **Game-Actions Union** | [src/game/store/game-actions.ts](src/game/store/game-actions.ts) | Canonical `GameAction` discriminated union | — | — | item/recipe types | logic (types only) |
| **Crafting** | [src/game/crafting/](src/game/crafting/) | Job lifecycle: queued→reserved→crafting→delivering→done | `crafting`, `network`, inventories | `crafting`, inventories, `keepStockByWorkbench` | Inventory, Items, Recipes | drone movement |
| **Drones** | [src/game/drones/](src/game/drones/) | Task selection, movement, cargo FSM | `drones`, `assets`, `crafting`, inventories | `drones`, `starterDrone`, target inventories, `collectionNodes` | Decisions, Selectors | energy, crafting planning |
| **Inventory / Reservations** | [src/game/inventory/](src/game/inventory/) | Logical holds on physical stock (`network`) | `inventory`, `warehouseInventories`, `network` | `network` (reservations) | Items | physical movement |
| **Items** | [src/game/items/](src/game/items/) | `ItemId` union, item registry, stack sizes | — | — | — | Recipes |
| **Recipes** | [src/game/simulation/recipes/](src/game/simulation/recipes/) | Static recipe definitions per workbench type | — | — | Items | crafting lifecycle |
| **Logistics-Tick** | [src/game/store/action-handlers/logistics-tick.ts](src/game/store/action-handlers/logistics-tick.ts) (+ `logistics-tick/`) | AutoMiner, Conveyor, AutoSmelter per 500ms | `assets`, inventories, `conveyors` | `inventory`, `warehouseInventories`, `autoMiners`, `autoSmelters`, `conveyors`, `notifications` | Decisions, Conveyor | drones, crafting |
| **Energy / Power** | [src/game/store/energy/](src/game/store/energy/), [src/game/power/](src/game/power/) | network connectivity, consumer priority, generator burn | `assets`, `cellMap`, `constructionSites`, `generators`, `battery`, `connectedAssetIds` | `poweredMachineIds`, `machinePowerRatio`, `generators`, `battery` | Decisions | Crafting, Logistics |
| **Buildings** | [src/game/buildings/](src/game/buildings/), [src/game/store/constants/buildings/](src/game/store/constants/buildings/) | building definitions, input targets, service-hub/warehouse helpers | `assets`, `placedBuildings` | via reducer | Items | placement validation |
| **Zones** | [src/game/zones/](src/game/zones/) | production-zone aggregation and cleanup | `productionZones`, `assets` | `productionZones`, `buildingZoneIds`, `buildingSourceWarehouseIds` | Decisions | crafting plan |
| **Conveyor** | [src/game/store/conveyor/](src/game/store/conveyor/) | belt geometry, routing, underground pairing | `conveyors`, `assets` | via Logistics-Tick | — | item definition |
| **Decisions** | [src/game/store/decisions/](src/game/store/decisions/) | Pure eligibility/placement/dropoff logic | `state` (read-only) | — | Helpers, Selectors | state mutation |
| **Selectors** | [src/game/store/selectors/](src/game/store/selectors/) | Read-only aggregations for UI/drones | `state` | never | — | mutation |
| **Grid (UI)** | [src/game/grid/](src/game/grid/) | click handling, overlays, placement preview | `state` | `dispatch` | UI helpers | Phaser render |
| **World (Phaser)** | [src/game/world/](src/game/world/) | Phaser game + React host for rendering | state snapshot | never | Sprites | logic |
| **UI Panels / HUD** | [src/game/ui/panels/](src/game/ui/panels/), [src/game/ui/hud/](src/game/ui/hud/) | side panels per building, hotbar, notifications | `state` | `dispatch` | Selectors | logic |
| **Persistence (Save)** | [src/game/simulation/](src/game/simulation/) | localStorage codec, migrations, normalizer | `state` | never (in the reducer sense) | Types | live state |
| **Debug** | [src/game/debug/](src/game/debug/) | DEV tools, debug overlays (tree-shaken) | `state` | via `DEBUG_SET_STATE` | — | Production |
| **Constants** | [src/game/constants/](src/game/constants/), [src/game/store/constants/](src/game/store/constants/) | grid dimensions, timing, capacities, recipe constants | — | — | — | — |

---

## 5. Detail Maps

### 5.1 Reducer & Dispatch Chain

- **Entry point:** [reducer.ts](src/game/store/reducer.ts) — thin entry point for `gameReducer` + `gameReducerWithInvariants`.
- **Actual dispatch logic:** [game-reducer-dispatch.ts](src/game/store/game-reducer-dispatch.ts) (extracted).
- **Pattern:** chain of `handleXAction(state, action, deps?) → GameState | null`. `null` = fallthrough. Remaining actions → inline `switch`.
- **Public API:** [reducer-public-api.ts](src/game/store/reducer-public-api.ts) — re-exports for external consumers.

### 5.2 Crafting System

- **README:** [src/game/crafting/README.md](src/game/crafting/README.md).
- **Lifecycle:** `queued → reserved → crafting → delivering → done|cancelled` ([crafting/types.ts](src/game/crafting/types.ts)).
- **Three layers:** reservation (`inventory/`) · queue (`crafting/queue/`) · tick phases (`crafting/tick.ts` + `crafting/tickPhases.ts`).
- **Cluster handler:** [crafting-queue-actions/](src/game/store/action-handlers/crafting-queue-actions/).
- **Strict separation:** planning vs. execution phase in the tick.
- **Source union:** `global | warehouse | zone` — determines where reads come from and where delivery goes.

### 5.3 Drones

- **Task selection:** [drones/selection/select-drone-task.ts](src/game/drones/selection/select-drone-task.ts) — scoring-based.
- **Task types:** `construction_supply`, `hub_restock`, `hub_dispatch`, `workbench_delivery`, `building_supply` ([store/types.ts](src/game/store/types.ts)).
- **Roles:** `auto | construction | supply` — affect ONLY scoring (bonus); no hard filter. Role changes do NOT cancel running tasks.
- **Sync trap:** `starterDrone` ↔ `drones[id]` — duplicated state, kept via `syncDrones` ([drones/utils/drone-state-helpers.ts](src/game/drones/utils/drone-state-helpers.ts)). UNCERTAIN: migration path toward consolidation is not documented.
- **FSM:** `DroneStatus` (idle / moving_to_collect / collecting / moving_to_dropoff / …).

### 5.4 Inventory Hierarchy (critical source of confusion)

| Layer | Field | Role |
|---|---|---|
| 1 | `state.inventory` | Global fallback pool (manual harvesting, crafting without explicit source) |
| 2 | `state.warehouseInventories[id]` | Physical warehouses — auto-delivery lands here |
| 3 | `state.network.reservations` | Logical holds on (1)+(2). NOT physical. |

**Canonical:** Physical inventory is the source of truth. `network` is only derived holds. Reservations are managed through owner keys (convention: `ownerKey === jobId`).

### 5.5 Tick Pipeline

| Tick | ms | Condition | Handler |
|---|---|---|---|
| `GROW_SAPLINGS` | 1000 | always | growth-actions |
| `SMITHY_TICK` | 100 | only when processing | machine-actions |
| `MANUAL_ASSEMBLER_TICK` | 100 | only when processing | manual-assembler-actions |
| `GENERATOR_TICK` | 200 | min. 1 running | machine-actions |
| `ENERGY_NET_TICK` | 2000 | always | energy-net-tick |
| `LOGISTICS_TICK` | 500 | always | logistics-tick |
| `JOB_TICK` | 500 | pending Jobs OR Keep-Stock-Targets | crafting-queue-actions |
| `DRONE_TICK` | 500 | always | drone-tick-actions |
| `EXPIRE_NOTIFICATIONS` | 500 | always | maintenance-actions |
| `NATURAL_SPAWN` | 60000 | always | growth-actions |

All tick intervals live in [entry/use-game-ticks.ts](src/game/entry/use-game-ticks.ts); [entry/FactoryApp.tsx](src/game/entry/FactoryApp.tsx) mounts the hook.

### 5.6 Energy Network

- **Tick phases:** [store/energy/](src/game/store/energy/) — production, consumers (priority-sorted), distribution.
- **Connectivity:** [logistics/connectivity.ts](src/game/logistics/connectivity.ts) — BFS over asset topology and pole range.
- **Write access:** `poweredMachineIds`, `machinePowerRatio`, `battery.stored`; `connectedAssetIds` is updated separately via `computeConnectedAssetIds()` when topology changes.
- **Consumer priority:** `MachinePriority` 1..5 — smaller number = earlier power access (`1` = highest priority).

### 5.7 Action Clusters (most common entry points)

| Cluster | Path | Action Count |
|---|---|---|
| Crafting | [crafting-queue-actions/](src/game/store/action-handlers/crafting-queue-actions/) | 13 |
| Building Placement | [building-placement.ts](src/game/store/action-handlers/building-placement.ts) + [building-placement/](src/game/store/action-handlers/building-placement/) | 2 |
| Machines | [machine-actions.ts](src/game/store/action-handlers/machine-actions.ts) + [machine-actions/](src/game/store/action-handlers/machine-actions/) | many |
| Click-Cell | [click-cell.ts](src/game/store/action-handlers/click-cell.ts) | 1 (central, dispatches internally) |
| Logistics | [logistics-tick.ts](src/game/store/action-handlers/logistics-tick.ts) + [logistics-tick/](src/game/store/action-handlers/logistics-tick/) | 1 |

### 5.8 UI-Panels (1 panel per building type)

[src/game/ui/panels/](src/game/ui/panels/): `WarehousePanel`, `SmithyPanel`, `WorkbenchPanel`, `ManualAssemblerPanel`, `AutoAssemblerPanel`, `AutoMinerPanel`, `AutoSmelterPanel`, `BatteryPanel`, `GeneratorPanel`, `MapShopPanel`, `PowerPolePanel`, `ServiceHubPanel`, `EnergyDebugOverlay`, `ZoneSourceSelector`. Trigger via `openPanel` field + `selectedXxxId`.

---

## 6. Hotspots & Risk Areas

| Hotspot | File / Area | Risk |
|---|---|---|
| **Three Inventories** | `inventory` / `warehouseInventories` / `network` | Wrong layer edited → stock inconsistency |
| **`starterDrone` ↔ `drones[id]`** | [drones/utils/drone-state-helpers.ts](src/game/drones/utils/drone-state-helpers.ts) | Editing both without `syncDrones` → drift |
| **Tick-Race** | [entry/use-game-ticks.ts](src/game/entry/use-game-ticks.ts) | Order is nondeterministic; logic must be sufficiently commutative |
| **Reducer-Split** | [reducer.ts](src/game/store/reducer.ts), [game-reducer-dispatch.ts](src/game/store/game-reducer-dispatch.ts) | Thin entry point and actual dispatch chain live in separate files |
| **Phase-File-Explosion** | `crafting-queue-actions/phases/` | A change typically touches 3 files (index + phase + deps) |
| **Save-Migrations** | [simulation/save-migrations.ts](src/game/simulation/save-migrations.ts) | Schema change without migration → hydration errors for existing saves |
| **Energy Consumer Priority** | [power/energy-priority.ts](src/game/power/energy-priority.ts) | Ordering bugs → wrong `machinePowerRatio` |
| **`GameState` is a Flat Interface** | [store/types.ts:316](src/game/store/types.ts#L316) | ~62 fields; logical slice separation is only conceptual |
| **HMR-Restore** | [entry/FactoryApp.tsx](src/game/entry/FactoryApp.tsx) | DEV-only code; do not test in prod |

---

## 7. Change Recipes

### 7.1 Add a New Building

1. **Item ID** (if it has its own item): [items/registry.ts](src/game/items/registry.ts) + [items/types.ts](src/game/items/types.ts) if needed.
2. **Building definition:** [src/game/store/constants/buildings/registry.ts](src/game/store/constants/buildings/registry.ts) (size, cost, power demand).
3. **AssetType union:** extend in [store/types.ts](src/game/store/types.ts) (if this is a new asset type).
4. **Initial state / slice:** if a dedicated slice is needed (e.g. analogous to `autoSmelters`), add it in [initial-state.ts](src/game/store/initial-state.ts) + `GameState`.
5. **Placement validation:** account for it in [grid/placement-validation.ts](src/game/grid/placement-validation.ts).
6. **Tick handler** (if processing): create a new cluster under [store/action-handlers/](src/game/store/action-handlers/), add the action to the union in [game-actions.ts](src/game/store/game-actions.ts), register `setInterval` in [entry/use-game-ticks.ts](src/game/entry/use-game-ticks.ts).
7. **Sprite/render:** [src/game/world/PhaserGame.ts](src/game/world/PhaserGame.ts) + [assets/sprites/](src/game/assets/sprites/).
8. **UI panel:** new file in [ui/panels/](src/game/ui/panels/), extend the `UIPanel` union in [store/types.ts](src/game/store/types.ts), `TOGGLE_PANEL` applies automatically.
9. **Save migration:** if the slice is new → entry in [simulation/save-migrations.ts](src/game/simulation/save-migrations.ts).

### 7.2 Add a New Recipe

1. **Output/input items** in [items/registry.ts](src/game/items/registry.ts) must exist.
2. **Choose recipe file** (matching the workbench type):
   - Smithy → [SmeltingRecipes.ts](src/game/simulation/recipes/SmeltingRecipes.ts)
   - Manual Assembler → [ManualAssemblerRecipes.ts](src/game/simulation/recipes/ManualAssemblerRecipes.ts)
   - Auto Assembler → [AutoAssemblerV1Recipes.ts](src/game/simulation/recipes/AutoAssemblerV1Recipes.ts)
   - Workbench → [WorkbenchRecipes.ts](src/game/simulation/recipes/WorkbenchRecipes.ts)
3. Add an entry with `id`, `inputs[]`, `outputs[]`, `durationMs`, `workbenchType`.
4. **Index re-exports automatically** via [recipes/index.ts](src/game/simulation/recipes/index.ts).
5. **No reducer change required** — recipes are read from the registry at runtime.
6. UI lists recipes automatically in the corresponding panel; if needed, check sprite/display name in [items/registry.ts](src/game/items/registry.ts).

### 7.3 New UI Panel

1. Create component under [ui/panels/](src/game/ui/panels/), props: `state`, `dispatch`, selected ID if needed.
2. Extend the `UIPanel` union in [store/types.ts](src/game/store/types.ts) with the new value.
3. If selection-dependent: new `selectedXxxId` field in `GameState` + reset in `CLOSE_PANEL`/`TOGGLE_PANEL` ([store/action-handlers/ui-actions.ts](src/game/store/action-handlers/ui-actions.ts)).
4. Click handler: trigger in [store/action-handlers/click-cell.ts](src/game/store/action-handlers/click-cell.ts) (opens panel on asset click).
5. Add panel routing in the render hierarchy ([ui/](src/game/ui/) main layout) — pattern: `state.openPanel === "xxx" && <XxxPanel … />`.
6. Create selectors for read-only data in [store/selectors/](src/game/store/selectors/) — UI must not import directly from `reducer.ts`.

---

## 8. References

- [src/game/ARCHITECTURE.md](src/game/ARCHITECTURE.md) — deep architecture, reading order, tick pipeline details, glossary.
- [src/game/TYPES.md](src/game/TYPES.md) — type index by domain (Store, Crafting, Items, Inventory, Drones).
- [src/game/crafting/README.md](src/game/crafting/README.md) — job lifecycle in detail.
- [README.md](README.md) — Setup, Build, Test.
- [AGENTS.md](AGENTS.md) — AI-Agent-Guidelines.
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — known issues.

---

## TODO / UNCERTAIN

- **`starterDrone` ↔ `drones[id]` migration path:** documentation unclear. See ARCHITECTURE.md §State Map.
- **Tick order guarantees:** no global orchestration. Race safety per tick has not been formally verified.
