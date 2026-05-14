# SYSTEM_REGISTRY.md

> AI-friendly navigation map for Factory Island. Current state, not target state.
> Last verified: 2026-05-05.

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

| Task                                 | Primary Systems                                      | Secondary Systems                                                |
| ------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------- |
| New building                         | Building Placement, Reducer, UI-Panels               | Inventory, Energy, Construction Sites                            |
| Construction-site / hub-upgrade flow | Construction Sites, Drones                           | Building Placement, Service Hubs, Energy                         |
| New recipe                           | Crafting, Simulation/Recipes                         | Inventory, UI-Panels                                             |
| New UI panel                         | UI-Panels                                            | Store, Selection-State                                           |
| New drone rule                       | Drones                                               | Inventory, Tick-Pipeline                                         |
| Shop / Fragments                     | Fragment Trader, `BUY_FRAGMENT` / `COLLECT_FRAGMENT` | Game-Actions, Modules                                            |
| Research / Building unlock           | Research Lab, `RESEARCH_BUILDING`                    | `ResearchLabPanel`, `handleResearchAction`, `unlockedBuildings`  |
| New ship quest / reward              | Ship / Dock Quest System, Persistence                | Save codec, save migrations                                      |
| New module / module-lab recipe       | Modules / Module Lab System                          | `moduleLabConstants`, module-lab-actions, save checklist         |
| New splitter filter behavior         | Conveyor Splitter Filter / Route State               | `splitter-filter-state`, conveyor-routing, `SET_SPLITTER_FILTER` |
| New dev scene                        | Dev Scenes                                           | scene-factory, DevSceneSelector, FactoryApp dev branch           |

---

## 2. Stack & Guiding Rules

- **Stack:** React 19 + TypeScript + Phaser 3.80 + Vite 5; Jest; Yarn 1.x.
- **State:** a single `useReducer` (`GameState` in [src/game/store/types.ts](src/game/store/types.ts)). Single source of truth.
- **Tick-driven:** three `setInterval` calls in [src/game/entry/use-game-ticks.ts](src/game/entry/use-game-ticks.ts) (Natural Spawn, Sapling Polling, and a central BASE_TICK orchestrator at 100 ms). The orchestrator dispatches `GENERATOR_TICK → ENERGY_NET_TICK → LOGISTICS_TICK → DRONE_TICK → JOB_TICK` in deterministic order each firing, plus the independent workbench/lab/ship/notification ticks at their configured cadences. Mounted from [src/game/entry/FactoryApp.tsx](src/game/entry/FactoryApp.tsx) → `dispatch({type: "*_TICK"})`.
- **Golden rule:** Phaser never dispatches. React layer dispatches from: UI events, tick hooks (`use-game-ticks.ts`), keyboard handlers, and DEV debug mock. Phaser reads snapshots.
- **Action discoverability:** Search exact action string. Note: some actions are handled via handler predicates or dispatch-chain guards, not switch-case (e.g. `auto-assembler-actions.ts`).
- **`GameAction` union:** canonical in [src/game/store/game-actions.ts](src/game/store/game-actions.ts). No re-export hub.
- **Persistence:** `localStorage` every 10 s + `beforeunload`. DEV-only HMR snapshot stored on `window.__FI_HMR_STATE__` via `debug/hmrState.ts`.
- **Determinism:** Most reducers are pure, but several tick handlers use `Math.random()` and `Date.now()` (e.g. natural spawn, module lab, ship actions). Verify test injection/mocking per handler.

---

## 3. Runtime Map

1. `main.factory.tsx` boots React → mounts `FactoryApp`.
2. `FactoryApp` selects mode (`debug` | `release`) and mounts `GameInner` with `key=mode`.
3. `GameInner` initializes `useReducer(gameReducer)` and mounts the three tick timers in `useGameTicks` (Natural Spawn, Sapling Polling, BASE_TICK orchestrator).
4. UI (HUD + Panels) reads `state` as a prop and calls `dispatch` directly.
5. Phaser (`PhaserHost` + `PhaserGame`) receives state snapshots for render synchronization.
6. All mutations → `dispatch(action)` → `gameReducer` → bounded-context live path → legacy cluster dispatch chain → new state.
7. Save codec periodically serializes `GameState` into `localStorage`; hydration on mount.
8. Within a single BASE_TICK firing, action order is deterministic (Generator → Energy → Logistics → Drone → Job, then the independent ticks). Across separate timer firings, browser scheduling order is NOT guaranteed.

---

## 4. Core Systems — Overview

| System                               | Main Path                                                                                                                                                                                                                                                  | Responsibility                                                                                                                    | Reads                                                                                                        | Writes                                                                                                                                         | Dependencies                       | Not Responsible For         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------- |
| **Entry / Bootstrap**                | [src/game/entry/](src/game/entry/)                                                                                                                                                                                                                         | App shell, reducer mount, tick intervals, HMR restore                                                                             | `state` (lifecycle)                                                                                          | `dispatch`                                                                                                                                     | Store, UI, Save                    | game logic, rendering       |
| **Reducer / Dispatch**               | [src/game/store/reducer.ts](src/game/store/reducer.ts), [game-reducer-dispatch.ts](src/game/store/game-reducer-dispatch.ts)                                                                                                                                | Central action dispatch chain                                                                                                     | entire `GameState`                                                                                           | entire `GameState`                                                                                                                             | all action handlers                | UI, rendering               |
| **Action-Handlers**                  | [src/game/store/action-handlers/](src/game/store/action-handlers/)                                                                                                                                                                                         | Cluster handler per action type                                                                                                   | `state` + `deps`                                                                                             | slices via pure updates                                                                                                                        | Decisions, Helpers, Selectors      | tick scheduling             |
| **Game-Actions Union**               | [src/game/store/game-actions.ts](src/game/store/game-actions.ts)                                                                                                                                                                                           | Canonical `GameAction` discriminated union                                                                                        | —                                                                                                            | —                                                                                                                                              | item/recipe types                  | logic (types only)          |
| **Crafting**                         | [src/game/crafting/](src/game/crafting/)                                                                                                                                                                                                                   | Job lifecycle: queued→reserved→crafting→delivering→done                                                                           | `crafting`, `network`, `inventory`, `warehouseInventories`, `serviceHubs`, `recipeAutomationPolicies`        | `crafting`, `network`, `inventory`, `warehouseInventories`, `serviceHubs`, `keepStockByWorkbench`, `recipeAutomationPolicies`                  | Inventory, Items, Recipes          | drone movement              |
| **Drones**                           | [src/game/drones/](src/game/drones/)                                                                                                                                                                                                                       | Task selection, movement, cargo FSM                                                                                               | `drones`, `assets`, `crafting`, inventories, `constructionSites`                                             | `drones`, target inventories, `constructionSites`, `collectionNodes`                                                                           | Decisions, Selectors               | energy, crafting planning   |
| **Inventory / Reservations**         | [src/game/inventory/](src/game/inventory/)                                                                                                                                                                                                                 | Logical holds on physical stock (`network`)                                                                                       | `inventory`, `warehouseInventories`, `serviceHubs`, `network`                                                | `network` (reservations)                                                                                                                       | Items                              | physical movement           |
| **Items**                            | [src/game/items/](src/game/items/)                                                                                                                                                                                                                         | `ItemId` union, item registry, stack sizes                                                                                        | —                                                                                                            | —                                                                                                                                              | —                                  | Recipes                     |
| **Recipes**                          | [src/game/simulation/recipes/](src/game/simulation/recipes/)                                                                                                                                                                                               | Static recipe definitions per workbench type plus system-specific recipe tables (e.g. `research-recipes.ts` for building unlocks) | —                                                                                                            | —                                                                                                                                              | Items                              | crafting lifecycle          |
| **Logistics-Tick**                   | [src/game/store/action-handlers/logistics-tick.ts](src/game/store/action-handlers/logistics-tick.ts) (+ `logistics-tick/`)                                                                                                                                 | AutoMiner, Conveyor, AutoSmelter, AutoAssembler per 500ms                                                                         | `assets`, inventories, `conveyors`                                                                           | `inventory`, `warehouseInventories`, `autoMiners`, `autoSmelters`, `autoAssemblers`, `conveyors`, `smithy`, `notifications`, `autoDeliveryLog` | Decisions, Conveyor                | drones, crafting            |
| **Energy / Power**                   | [src/game/store/energy/](src/game/store/energy/), [src/game/power/](src/game/power/)                                                                                                                                                                       | network connectivity, consumer priority, generator burn                                                                           | `assets`, `cellMap`, `constructionSites`, `generators`, `battery`, `connectedAssetIds`, active machine state | `poweredMachineIds`, `machinePowerRatio`, `generators`, `battery`                                                                              | Decisions                          | Crafting, Logistics         |
| **Buildings**                        | [src/game/buildings/](src/game/buildings/), [src/game/store/constants/buildings/](src/game/store/constants/buildings/)                                                                                                                                     | building definitions, input targets, service-hub/warehouse helpers                                                                | `assets`, `placedBuildings`                                                                                  | via reducer                                                                                                                                    | Items                              | placement validation        |
| **Construction Sites**               | [building-placement/](src/game/store/action-handlers/building-placement/), [building-site.ts](src/game/store/action-handlers/building-site.ts), [deposit-construction.ts](src/game/drones/execution/drone-finalization/depositing/deposit-construction.ts) | outstanding build/upgrade resource debt and drone completion                                                                      | `constructionSites`, `serviceHubs`, `inventory`, `assets`                                                    | `constructionSites`, `inventory`, `connectedAssetIds`, `serviceHubs`                                                                           | Building Placement, Drones, Energy | normal placement validation |
| **Zones**                            | [src/game/zones/](src/game/zones/)                                                                                                                                                                                                                         | production-zone aggregation, cleanup, and source resolution                                                                       | `productionZones`, `assets`, `buildingZoneIds`, `warehouseInventories`                                       | `productionZones`, `buildingZoneIds`, `buildingSourceWarehouseIds`                                                                             | Crafting sources, Decisions        | crafting plan               |
| **Conveyor**                         | [src/game/store/conveyor/](src/game/store/conveyor/)                                                                                                                                                                                                       | belt geometry, routing, underground pairing, splitter filter/route state                                                          | `conveyors`, `assets`, `splitterRouteState`, `splitterFilterState`                                           | via Logistics-Tick, `SET_SPLITTER_FILTER`                                                                                                      | —                                  | item definition             |
| **Ship / Dock Quest System**         | [src/game/ship/](src/game/ship/), [src/game/store/types/ship-types.ts](src/game/store/types/ship-types.ts), [src/game/store/action-handlers/ship-actions.ts](src/game/store/action-handlers/ship-actions.ts)                                               | ship voyage, dock quests, rewards                                                                                                 | `ship`, dock warehouse inventory                                                                             | `ship`, `warehouseInventories`, rewards, module fragments                                                                                      | Dock Warehouse, Modules, Save      | generic logistics           |
| **Modules / Module Lab System**      | [src/game/modules/](src/game/modules/), [src/game/constants/moduleLabConstants.ts](src/game/constants/moduleLabConstants.ts), [src/game/store/action-handlers/module-lab-actions.ts](src/game/store/action-handlers/module-lab-actions.ts)                 | module inventory, fragments, lab crafting jobs                                                                                    | `moduleInventory`, `moduleFragments`, `moduleLabJob`                                                         | `moduleInventory`, `moduleFragments`, `moduleLabJob`, equipped module slots                                                                    | Ship, UI, Save                     | normal workbench crafting   |
| **Bootstrap / Initial Fixed Layout** | [src/game/store/bootstrap/](src/game/store/bootstrap/), [src/game/store/initial-state.ts](src/game/store/initial-state.ts)                                                                                                                                 | seeded fixed assets such as Dock Warehouse                                                                                        | initial state, building registry                                                                             | initial asset/cell/inventory layout                                                                                                            | Save, Buildings, Ship              | runtime placement rules     |
| **Decisions**                        | [src/game/store/decisions/](src/game/store/decisions/)                                                                                                                                                                                                     | Pure eligibility/placement/dropoff logic                                                                                          | `state` (read-only)                                                                                          | —                                                                                                                                              | Helpers, Selectors                 | state mutation              |
| **Selectors**                        | [src/game/store/selectors/](src/game/store/selectors/)                                                                                                                                                                                                     | Read-only aggregations for UI/drones                                                                                              | `state`                                                                                                      | never                                                                                                                                          | —                                  | mutation                    |
| **Grid (UI)**                        | [src/game/grid/](src/game/grid/)                                                                                                                                                                                                                           | click handling, overlays, placement preview                                                                                       | `state`                                                                                                      | `dispatch`                                                                                                                                     | UI helpers                         | Phaser render               |
| **World (Phaser)**                   | [src/game/world/](src/game/world/)                                                                                                                                                                                                                         | Phaser game + React host for rendering                                                                                            | state snapshot                                                                                               | never                                                                                                                                          | Sprites                            | logic                       |
| **UI Panels / HUD**                  | [src/game/ui/panels/](src/game/ui/panels/), [src/game/ui/hud/](src/game/ui/hud/)                                                                                                                                                                           | side panels per building, hotbar, notifications                                                                                   | `state`                                                                                                      | `dispatch`                                                                                                                                     | Selectors                          | logic                       |
| **Persistence (Save)**               | [src/game/simulation/](src/game/simulation/)                                                                                                                                                                                                               | localStorage codec, migrations, normalizer                                                                                        | `state`                                                                                                      | never (in the reducer sense)                                                                                                                   | Types                              | live state                  |
| **Debug**                            | [src/game/debug/](src/game/debug/)                                                                                                                                                                                                                         | DEV tools, debug overlays (tree-shaken)                                                                                           | `state`                                                                                                      | via `DEBUG_SET_STATE`                                                                                                                          | —                                  | Production                  |
| **Dev Scenes (DEV only)**            | [src/game/dev/](src/game/dev/)                                                                                                                                                                                                                             | debug-only scene presets selected by URL                                                                                          | scene layouts, initial state                                                                                 | DEV initial state snapshot                                                                                                                     | FactoryApp, scene-builder          | production                  |
| **Constants**                        | [src/game/constants/](src/game/constants/), [src/game/store/constants/](src/game/store/constants/)                                                                                                                                                         | grid dimensions, timing, capacities, recipe constants                                                                             | —                                                                                                            | —                                                                                                                                              | —                                  | —                           |

---

## 5. Detail Maps

### 5.1 Reducer & Dispatch Chain

- **Entry point:** [reducer.ts](src/game/store/reducer.ts) — thin entry point for `gameReducer` + `gameReducerWithInvariants`.
- **Live bounded-context path:** [store/contexts/create-game-reducer.ts](src/game/store/contexts/create-game-reducer.ts) `applyLiveContextReducers`. Handles a curated allowlist of actions (notifications, zone, network commit/cancel, warehouse hotbar/transfer, crafting queue, UI selection) via the bounded-context reducers in [store/contexts/](src/game/store/contexts/). Returns `null` to fall through.
- **Legacy fallback chain:** [game-reducer-dispatch.ts](src/game/store/game-reducer-dispatch.ts). Chain of `handleXAction(state, action, deps?) → GameState | null`. `null` = fallthrough. Remaining actions → inline `switch`. This file is `@deprecated`; new handlers belong in `store/contexts/`.
- **DEV shadow diff:** in DEV builds, `gameReducer` re-runs the full bounded-context composition (`applyContextReducers`) and compares results to the legacy output via `shadowDiff`. Mismatches log warnings without affecting runtime; the legacy result is what the store sees.
- **Public API:** [reducer-public-api.ts](src/game/store/reducer-public-api.ts) — re-exports for external consumers.
- **Migration plan:** [docs/bounded-context-state-management-prd.md](docs/bounded-context-state-management-prd.md).

### 5.2 Crafting System

- **README:** [src/game/crafting/README.md](src/game/crafting/README.md).
- **Lifecycle:** `queued → reserved → crafting → delivering → done|cancelled` ([crafting/types.ts](src/game/crafting/types.ts)).
- **Three layers:** reservation (`inventory/`) · queue (`crafting/queue/`) · tick phases (`crafting/tick.ts` + `crafting/tickPhases.ts`).
- **Cluster handler:** [crafting-queue-actions/](src/game/store/action-handlers/crafting-queue-actions/).
- **Strict separation:** planning vs. execution phase in the tick.
- **Source union:** `global | warehouse | zone` — determines where reads come from and where delivery goes.
- **Additional touched slices:** also reads/writes `network`, `warehouseInventories`, `inventory`, `serviceHubs`, and `recipeAutomationPolicies`.

### 5.3 Drones

- **Task selection:** [drones/selection/select-drone-task.ts](src/game/drones/selection/select-drone-task.ts) — scoring-based.
- **Task types:** `construction_supply`, `hub_restock`, `hub_dispatch`, `workbench_delivery`, `building_supply`, `deconstruct` ([store/types.ts](src/game/store/types.ts)).
- **Roles:** `auto | construction | supply` — affect ONLY scoring (bonus); no hard filter. Role changes do NOT cancel running tasks.
- **Starter drone source:** `drones["starter"]` is canonical. Use `selectStarterDrone()` / `requireStarterDrone()` for stable reads; `syncDrones` remains a no-op compatibility helper.
- **FSM:** `DroneStatus` (idle / moving_to_collect / collecting / moving_to_dropoff / …).

### 5.4 Inventory Hierarchy (critical source of confusion)

| Layer | Field                             | Role                                                                       |
| ----- | --------------------------------- | -------------------------------------------------------------------------- |
| 1     | `state.inventory`                 | Global fallback pool (manual harvesting, crafting without explicit source) |
| 2     | `state.warehouseInventories[id]`  | Physical warehouses — auto-delivery lands here                             |
| 3     | `state.serviceHubs[id].inventory` | Physical hub-local stock used by hub fallback and drone flows              |
| 4     | `state.network.reservations`      | Logical holds on physical sources. NOT physical.                           |

**Canonical:** Physical inventory is the source of truth. `network` is only derived holds. Crafting reservations connect jobs and holds through `reservationOwnerId` on jobs and `ownerId` on reservation entries.

### 5.5 Production Zones & Source Resolution

- **Cluster:** [zone-actions.ts](src/game/store/action-handlers/zone-actions.ts) via [game-reducer-dispatch.ts](src/game/store/game-reducer-dispatch.ts).
- **Source precedence:** [resolveBuildingSource](src/game/store/building-source.ts) resolves Zone -> explicit Warehouse -> global fallback.
- **Zone inventory reads:** [production-zone-aggregation.ts](src/game/zones/production-zone-aggregation.ts) aggregates sorted zone warehouse IDs.
- **Zone inventory writes:** [applyZoneDelta](src/game/zones/production-zone-mutation.ts) distributes aggregate deltas across zone warehouses deterministically; [crafting-sources.ts](src/game/crafting/crafting-sources.ts) routes zone source mutations through it.
- **UI entry:** `ZoneSourceSelector` is embedded in crafting and auto-machine panels.

### 5.6 Construction Sites

- **State:** `constructionSites[assetId]` stores outstanding collectable resource debt for a building or hub upgrade.
- **Regular building path:** [place-building.ts](src/game/store/action-handlers/building-placement/place-building.ts) creates construction sites for eligible `CONSTRUCTION_SITE_BUILDINGS` when a service hub exists.
- **Hub upgrade path:** [building-site.ts](src/game/store/action-handlers/building-site.ts) handles `UPGRADE_HUB`, sets `serviceHubs[hubId].pendingUpgrade`, and creates matching construction debt.
- **Drone delivery path:** [deposit-construction.ts](src/game/drones/execution/drone-finalization/depositing/deposit-construction.ts) reduces `remaining`, removes completed sites, returns overflow to global inventory, and recomputes `connectedAssetIds` on completion.
- **Save risk:** `constructionSites` is persisted; old saves must still normalize through the save codec and migrations.

### 5.7 Tick Pipeline

| Tick                    | ms    | Condition                                                    | Handler                  |
| ----------------------- | ----- | ------------------------------------------------------------ | ------------------------ |
| `GROW_SAPLINGS`         | 1000  | always polling, conditional dispatch (`readyIds.length > 0`) | growth-actions           |
| `SMITHY_TICK`           | 100   | only when processing                                         | machine-actions          |
| `MANUAL_ASSEMBLER_TICK` | 100   | only when processing                                         | manual-assembler-actions |
| `MODULE_LAB_TICK`       | 500   | active module lab job                                        | module-lab-actions       |
| `GENERATOR_TICK`        | 200   | min. 1 running                                               | machine-actions          |
| `ENERGY_NET_TICK`       | 2000  | always                                                       | energy-net-tick          |
| `LOGISTICS_TICK`        | 500   | always                                                       | logistics-tick           |
| `JOB_TICK`              | 500   | pending Jobs OR Keep-Stock-Targets                           | crafting-queue-actions   |
| `DRONE_TICK`            | 500   | always                                                       | drone-tick-actions       |
| `SHIP_TICK`             | 1000  | always                                                       | ship-actions             |
| `EXPIRE_NOTIFICATIONS`  | 500   | always                                                       | maintenance-actions      |
| `NATURAL_SPAWN`         | 60000 | always                                                       | growth-actions           |

All tick intervals live in [entry/use-game-ticks.ts](src/game/entry/use-game-ticks.ts); [entry/FactoryApp.tsx](src/game/entry/FactoryApp.tsx) mounts the hook.

**LOGISTICS_TICK internal phases:** AutoMiner → Conveyor → AutoSmelter → AutoAssembler. Phase 4: `runAutoAssemblerPhase` (see [logistics-tick.ts](src/game/store/action-handlers/logistics-tick.ts)). Commit write set includes `autoAssemblers`, `smithy`, and `autoDeliveryLog`.

`autoDeliveryLog` is transient UI telemetry. Auto-miner and conveyor warehouse deliveries append/batch entries; save hydration resets the log to `[]`.

### 5.8 Energy Network

- **Tick phases:** [store/energy/](src/game/store/energy/) — production, consumers (priority-sorted), distribution.
- **Important paths:** [energy-tick-phases.ts](src/game/store/energy/energy-tick-phases.ts), [energy-priority.ts](src/game/power/energy-priority.ts).
- **Connectivity:** [logistics/connectivity.ts](src/game/logistics/connectivity.ts) — BFS over asset topology and pole range.
- **Write access:** `poweredMachineIds`, `machinePowerRatio`, `battery.stored`; `connectedAssetIds` is updated separately via `computeConnectedAssetIds()` when topology changes.
- **Consumer priority:** `MachinePriority` 1..5 — smaller number = earlier power access (`1` = highest priority).
- **Consumer filtering:** consumer phase includes active-processing checks for AutoSmelter and AutoAssembler.

### 5.9 Action Clusters (most common entry points)

| Cluster            | Path                                                                                                                                                                                                        | Action Count / Representative Actions                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Crafting           | [crafting-queue-actions/](src/game/store/action-handlers/crafting-queue-actions/)                                                                                                                           | 13; `JOB_TICK`, `JOB_ENQUEUE`, `SET_KEEP_STOCK_TARGET`, `NETWORK_*`                                                   |
| Zones              | [zone-actions.ts](src/game/store/action-handlers/zone-actions.ts)                                                                                                                                           | `CREATE_ZONE`, `DELETE_ZONE`, `SET_BUILDING_ZONE`                                                                     |
| Building Placement | [building-placement.ts](src/game/store/action-handlers/building-placement.ts) + [building-placement/](src/game/store/action-handlers/building-placement/)                                                   | 2; `BUILD_PLACE_BUILDING`, `BUILD_REMOVE_ASSET`                                                                       |
| Building Site      | [building-site.ts](src/game/store/action-handlers/building-site.ts)                                                                                                                                         | `SET_BUILDING_SOURCE`, `UPGRADE_HUB`                                                                                  |
| Machines           | [machine-actions.ts](src/game/store/action-handlers/machine-actions.ts) + [machine-actions/](src/game/store/action-handlers/machine-actions/)                                                               | many                                                                                                                  |
| Machine Config     | [machine-config.ts](src/game/store/action-handlers/machine-config.ts)                                                                                                                                       | `SET_MACHINE_PRIORITY`, `SET_MACHINE_BOOST`, `SET_SPLITTER_FILTER`                                                    |
| Auto Assembler     | [auto-assembler-actions.ts](src/game/store/action-handlers/auto-assembler-actions.ts)                                                                                                                       | `AUTO_ASSEMBLER_SET_RECIPE`                                                                                           |
| Ship               | [ship-actions.ts](src/game/store/action-handlers/ship-actions.ts)                                                                                                                                           | `SHIP_TICK`, `SHIP_DOCK`, `SHIP_DEPART`, `SHIP_RETURN`                                                                |
| Module Lab         | [module-lab-actions.ts](src/game/store/action-handlers/module-lab-actions.ts)                                                                                                                               | `MODULE_LAB_TICK`, `START_MODULE_CRAFT`, `COLLECT_MODULE`, `PLACE_MODULE`, `REMOVE_MODULE`                            |
| Research           | [research.ts](src/game/store/action-handlers/research.ts)                                                                                                                                                   | `RESEARCH_BUILDING` (`ResearchLabPanel` → `handleResearchAction` → `unlockedBuildings`)                               |
| Build Mode         | [game-actions.ts](src/game/store/game-actions.ts), [build-mode-actions/](src/game/store/action-handlers/build-mode-actions/), [building-placement.ts](src/game/store/action-handlers/building-placement.ts) | `TOGGLE_BUILD_MODE`, `SELECT_BUILD_BUILDING`, `SELECT_BUILD_FLOOR_TILE`, `BUILD_PLACE_BUILDING`, `BUILD_REMOVE_ASSET` |
| Click-Cell         | [click-cell.ts](src/game/store/action-handlers/click-cell.ts)                                                                                                                                               | 1 (central, dispatches internally)                                                                                    |
| Logistics          | [logistics-tick.ts](src/game/store/action-handlers/logistics-tick.ts) + [logistics-tick/](src/game/store/action-handlers/logistics-tick/)                                                                   | 1; `LOGISTICS_TICK`                                                                                                   |

Table is representative, not exhaustive.

### 5.10 UI Surfaces (Panels, HUD, Menus)

| Component               | Purpose                                                                  |
| ----------------------- | ------------------------------------------------------------------------ |
| `WarehousePanel`        | Warehouse inventory, source, zone, and hotbar transfer UI                |
| `SmithyPanel`           | Smithy fuel/input/recipe/output UI                                       |
| `WorkbenchPanel`        | Workbench crafting jobs and automation UI                                |
| `ManualAssemblerPanel`  | Manual assembler recipe and progress UI                                  |
| `AutoAssemblerPanel`    | Auto assembler recipe, buffers, and status UI                            |
| `AutoMinerPanel`        | Auto miner status, source, and module controls                           |
| `AutoSmelterPanel`      | Auto smelter recipe, source, and module controls                         |
| `BatteryPanel`          | Battery storage UI                                                       |
| `GeneratorPanel`        | Generator fuel/refill UI                                                 |
| `MapShopPanel`          | Trader/shop UI for purchasable shop items/tools (no building unlocks)    |
| `ResearchLabPanel`      | Building unlock UI via research recipes (`RESEARCH_BUILDING`)            |
| `PowerPolePanel`        | Power pole range/status UI                                               |
| `ServiceHubPanel`       | Hub inventory, target stock, drones, and upgrade UI                      |
| `ConveyorSplitterPanel` | Filter/route config for splitters                                        |
| `DockWarehousePanel`    | Ship dock & warehouse UI                                                 |
| `FragmentTraderPanel`   | Module fragment trading                                                  |
| `ModulLabPanel`         | Module lab job management                                                |
| `Hotbar`                | Active tool/building slots                                               |
| `ResourceBar`           | Top-level resource display                                               |
| `Notifications`         | Temporary success/error notifications                                    |
| `AutoDeliveryFeed`      | Recent automatic deliveries                                              |
| `ProductionStatusFeed`  | Production/debug status feed                                             |
| `ShipStatusBar`         | Ship status HUD overlay                                                  |
| `EnergyDebugOverlay`    | In-world energy debug overlay                                            |
| `EnergyDebugHud`        | Energy debug HUD overlay                                                 |
| `ZoneSourceSelector`    | Shared source/zone selector embedded in crafting and auto-machine panels |
| `BuildMenu`             | Build category + item selector                                           |
| `ModeSelect`            | Game mode switching                                                      |
| `DevSceneSelector`      | DEV scene switching by URL param                                         |
| `DebugPanel`            | DEV mock/reset/HMR tools                                                 |

Key files: [FactoryApp.tsx](src/game/entry/FactoryApp.tsx), [BuildMenu.tsx](src/game/ui/menus/BuildMenu.tsx), [ModeSelect.tsx](src/game/ui/menus/ModeSelect.tsx).
Research panel open/routing: [FactoryApp.tsx:393](src/game/entry/FactoryApp.tsx#L393), [ui-panel-toggle.ts:147](src/game/store/helpers/ui-panel-toggle.ts#L147).

### 5.11 Ship / Dock Quest System

- **State:** `ShipState` is persisted in `state.ship`.
- **Key actions:** `SHIP_TICK`, `SHIP_DOCK`, `SHIP_DEPART`, `SHIP_RETURN`.
- **UI:** [ShipStatusBar.tsx](src/game/ui/hud/ShipStatusBar.tsx), [DockWarehousePanel.tsx](src/game/ui/panels/DockWarehousePanel.tsx) (consumes reward preview via `getExpectedRewardRange`).
- **Coupling:** Dock Warehouse is coupled to ship state; reward flow yields module fragments and complete modules.
- **Save risk:** ship state must be included in save codec and migration.
- **Normalization:** QuestHistory/Departure normalization via save migration ([ship-types.ts:46](src/game/store/types/ship-types.ts#L46); ship normalization is part of the V28→V29 step in [migrations/v21-v30.ts](src/game/simulation/migrations/v21-v30.ts)).
- **Key files:** [ship-types.ts](src/game/store/types/ship-types.ts), [ship-actions.ts](src/game/store/action-handlers/ship-actions.ts), [ship-balance.ts](src/game/ship/ship-balance.ts) (balancing/routing), [quest-registry.ts](src/game/ship/quest-registry.ts) (quest-history filter), [reward-table.ts](src/game/ship/reward-table.ts) (reward preview API).

### 5.12 Modules / Module Lab System

- **State:** `moduleInventory`, `moduleFragments`, `moduleLabJob` are all persisted.
- **Tick:** `MODULE_LAB_TICK` advances active module lab jobs.
- **Key actions:** see [module-lab-actions.ts](src/game/store/action-handlers/module-lab-actions.ts).
- **UI:** [ModulLabPanel.tsx](src/game/ui/panels/ModulLabPanel.tsx) (single-l spelling is intentional).
- **Recipe guidance:** [moduleLabConstants.ts](src/game/constants/moduleLabConstants.ts).
- **Save checklist:** include `moduleInventory`, `moduleFragments`, and `moduleLabJob`.

### 5.13 Bootstrap / Initial Fixed Layout

- Dock Warehouse is NOT a normal buildable; it is seeded via bootstrap.
- Normalized through: [apply-dock-warehouse-layout.ts](src/game/store/bootstrap/apply-dock-warehouse-layout.ts), [registry.ts](src/game/store/constants/buildings/registry.ts), [initial-state.ts](src/game/store/initial-state.ts).
- Tied to ship state initialization; must be preserved across migrations.

### 5.14 Conveyor Splitter Filter / Route State

- **Splitter State (persisted):** `splitterRouteState` stores round-robin routing per splitter.
- **Splitter filters (persisted):** `splitterFilterState` stores item filter rules per splitter output side.
- **Key action:** `SET_SPLITTER_FILTER`.
- **Routing logic:** [conveyor-routing.ts](src/game/store/conveyor/conveyor-routing.ts) checks output filters before side selection, alternates left/right using `lastSide`, updates `splitterRouteState` only on successful routing, and leaves the item on the input conveyor when both sides are blocked.
- **UI:** [ConveyorSplitterPanel.tsx](src/game/ui/panels/ConveyorSplitterPanel.tsx).

### 5.15 Dev Scenes (DEV only)

- **Scenes:** `debug`, `logistics`, `power`, `assembler`, `empty`.
- **Selection:** URL `?scene=` parameter.
- **Entry:** [scene-factory.ts](src/game/dev/scene-factory.ts), [DevSceneSelector.tsx](src/game/dev/DevSceneSelector.tsx), `applyDevScene`.
- **Mount:** toggled through the [FactoryApp.tsx](src/game/entry/FactoryApp.tsx) DEV branch.

---

## 6. Hotspots & Risk Areas

| Hotspot                             | File / Area                                                                                                                                               | Risk                                                                                                                                                                                                                                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Three Inventories**               | `inventory` / `warehouseInventories` / `network`                                                                                                          | Wrong layer edited → stock inconsistency                                                                                                                                                                                                                                             |
| **`starterDrone` ↔ `drones[id]`**   | [drones/utils/drone-state-helpers.ts](src/game/drones/utils/drone-state-helpers.ts)                                                                       | Editing both without `syncDrones` → drift                                                                                                                                                                                                                                            |
| **Tick-Race**                       | [entry/use-game-ticks.ts](src/game/entry/use-game-ticks.ts)                                                                                               | Inside a single BASE_TICK firing, order is fixed (Generator→Energy→Logistics→Drone→Job). Between separate timer firings (Natural Spawn, Sapling Polling, BASE_TICK) the browser schedule is not guaranteed — cross-timer logic must stay commutative.                                |
| **Reducer-Split**                   | [reducer.ts](src/game/store/reducer.ts), [game-reducer-dispatch.ts](src/game/store/game-reducer-dispatch.ts), [store/contexts/](src/game/store/contexts/) | Three-layer dispatch: bounded-context **live** path (`applyLiveContextReducers`) for migrated actions, legacy cluster chain as fallback, and a DEV-only shadow-diff (`applyContextReducers` vs. legacy). New actions belong in `store/contexts/`, not in `game-reducer-dispatch.ts`. |
| **Phase-File-Explosion**            | `crafting-queue-actions/phases/`                                                                                                                          | A change typically touches 3 files (index + phase + deps)                                                                                                                                                                                                                            |
| **Save-Migrations**                 | [simulation/save-migrations.ts](src/game/simulation/save-migrations.ts)                                                                                   | Schema change without migration → hydration errors for existing saves                                                                                                                                                                                                                |
| **New persisted slices (save v32)** | [simulation/save-codec.ts](src/game/simulation/save-codec.ts), [simulation/save-migrations.ts](src/game/simulation/save-migrations.ts)                    | Current save version: 32. Includes `moduleInventory`, `moduleFragments`, `moduleLabJob`, `ship` (normalized in v29 migration), `splitterFilterState`, `splitterRouteState`; v31→v32 appends `research_lab` idempotent to `unlockedBuildings`                                         |
| **Energy Consumer Priority**        | [power/energy-priority.ts](src/game/power/energy-priority.ts)                                                                                             | Ordering bugs → wrong `machinePowerRatio`                                                                                                                                                                                                                                            |
| **`GameState` is a Flat Interface** | [store/types.ts](src/game/store/types.ts) (`interface GameState`)                                                                                         | large top-level field set; logical slice separation is only conceptual. Notable fields: `moduleInventory`, `moduleFragments`, `moduleLabJob`, `constructionSites`, `splitterRouteState`, `splitterFilterState`, `ship`                                                               |
| **HMR-Restore**                     | [entry/FactoryApp.tsx](src/game/entry/FactoryApp.tsx)                                                                                                     | DEV-only code; do not test in prod                                                                                                                                                                                                                                                   |

---

## 7. Change Recipes

### 7.1 Add a New Building

1. **Item ID** (if it has its own item): [items/registry.ts](src/game/items/registry.ts) + [items/types.ts](src/game/items/types.ts) if needed.
2. **Building definition:** [src/game/store/constants/buildings/registry.ts](src/game/store/constants/buildings/registry.ts) (size, cost, power demand).
3. **AssetType union:** extend in [store/types.ts](src/game/store/types.ts) (if this is a new asset type).
4. **Construction-site eligibility:** if drone-built, account for `CONSTRUCTION_SITE_BUILDINGS`, collectable costs, and hub availability in [place-building.ts](src/game/store/action-handlers/building-placement/place-building.ts).
5. **Initial state / slice:** if a dedicated slice is needed (e.g. analogous to `autoSmelters`), add it in [initial-state.ts](src/game/store/initial-state.ts) + `GameState`.
6. **Placement validation:** account for it in [grid/placement-validation.ts](src/game/grid/placement-validation.ts).
7. **Tick handler** (if processing): create a new cluster under [store/action-handlers/](src/game/store/action-handlers/), add the action to the union in [game-actions.ts](src/game/store/game-actions.ts), register `setInterval` in [entry/use-game-ticks.ts](src/game/entry/use-game-ticks.ts).
8. **Sprite/render:** [src/game/world/PhaserGame.ts](src/game/world/PhaserGame.ts) + [assets/sprites/](src/game/assets/sprites/).
9. **Build menu:** add the asset to `BUILD_CATEGORIES` in [registry.ts](src/game/store/constants/buildings/registry.ts).
10. **UI panel:** new file in [ui/panels/](src/game/ui/panels/), extend the `UIPanel` union in [store/types.ts](src/game/store/types.ts).
11. **Panel routing:** register panel in `tryTogglePanelFromAsset` ([ui-panel-toggle.ts](src/game/store/helpers/ui-panel-toggle.ts)).
12. **Factory route:** add the `state.openPanel === "xxx" && <XxxPanel … />` render route in [FactoryApp.tsx](src/game/entry/FactoryApp.tsx).
13. **Selection state:** define any `selectedXxxId` field in `GameState` and reset it explicitly where needed.
14. **Save migration:** if the slice is new → entry in [simulation/save-migrations.ts](src/game/simulation/save-migrations.ts).
15. **Integration test:** add a targeted placement/panel/save test for the new building path.

### 7.2 Add a New Recipe

1. **Output/input items** in [items/registry.ts](src/game/items/registry.ts) must exist.
2. **Choose recipe file** (matching the workbench type):
   - Smithy → [SmeltingRecipes.ts](src/game/simulation/recipes/SmeltingRecipes.ts)
   - Manual Assembler → [ManualAssemblerRecipes.ts](src/game/simulation/recipes/ManualAssemblerRecipes.ts)
   - Auto Assembler → [AutoAssemblerV1Recipes.ts](src/game/simulation/recipes/AutoAssemblerV1Recipes.ts)
   - Workbench → [WorkbenchRecipes.ts](src/game/simulation/recipes/WorkbenchRecipes.ts)
3. Use the schema for that recipe family:
   - Workbench: `key`, `label`, `emoji`, `inputItem`, `outputItem`, `processingTime`, `outputAmount`, `costs`. `costs` is the canonical ingredient field.
   - Smelting: `inputItem`, `outputItem`, `processingTime`, `outputAmount`, `inputAmount`.
   - Manual Assembler: `key`, `inputItem`, `outputItem`, `processingTime`, `outputAmount`, `inputAmount`.
   - Auto Assembler V1: `id`, `inputItem`, `inputAmount`, `outputItem`, `processingTimeSec`.
4. **Index re-exports automatically** via [recipes/index.ts](src/game/simulation/recipes/index.ts).
5. **No reducer change required** — recipes are read from the registry at runtime.
6. UI lists recipes automatically in the corresponding panel; if needed, check sprite/display name in [items/registry.ts](src/game/items/registry.ts).

### 7.3 New UI Panel

1. Create component under [ui/panels/](src/game/ui/panels/), props: `state`, `dispatch`, selected ID if needed.
2. Extend the `UIPanel` union in [store/types.ts](src/game/store/types.ts) with the new value.
3. If selection-dependent: new `selectedXxxId` field in `GameState`; selected IDs must be reset explicitly.
4. Panel routing lives in [ui-panel-toggle.ts](src/game/store/helpers/ui-panel-toggle.ts) + [FactoryApp.tsx](src/game/entry/FactoryApp.tsx).
5. `TOGGLE_PANEL` only toggles `openPanel`; it does not automatically handle selected IDs.
6. Asset-to-panel routing goes through `tryTogglePanelFromAsset` in [ui-cell-prelude.ts](src/game/store/action-handlers/ui-cell-prelude.ts).
7. Add panel routing in the render hierarchy — pattern: `state.openPanel === "xxx" && <XxxPanel … />`.
8. Create selectors for read-only data in [store/selectors/](src/game/store/selectors/) — UI must not import directly from `reducer.ts`.

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
