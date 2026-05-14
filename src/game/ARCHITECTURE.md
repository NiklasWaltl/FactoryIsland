# `src/game` — Architecture

> Architecture, runtime, and data-flow documentation. Current state. If conflicts arise, code is authoritative.
> **Last verified:** 2026-05-14.

---

## When should I read this file?

- You want to understand **how** the code interacts at runtime (ticks, dispatches, render path).
- You need **rationales** for the architecture (why three inventory layers, why no re-export hub, why Phaser is read-only).
- You are looking for the **logical slice decomposition** of `GameState` and its persistence status.

## What is not covered here?

- **Which file is responsible for X?** → [/SYSTEM_REGISTRY.md](../../SYSTEM_REGISTRY.md) (system table, hotspots, change recipes).
- **Which type exists in domain X?** → [TYPES.md](./TYPES.md) (type index by domain, cross-domain dependencies).

---

## Reading Order

Onboarding in this order:

1. [/SYSTEM_REGISTRY.md](../../SYSTEM_REGISTRY.md) — system map, routing.
2. This file — runtime + architecture decisions.
3. [TYPES.md](./TYPES.md) — type domains.
4. [`entry/FactoryApp.tsx`](./entry/FactoryApp.tsx) — Boot, Hydration, Save/HMR.
5. [`entry/use-game-ticks.ts`](./entry/use-game-ticks.ts) — all tick dispatches visible.
6. [`store/types.ts`](./store/types.ts) from L378 — `GameState` shape.
7. [`store/reducer.ts`](./store/reducer.ts) — thin reducer entry point (composes the three dispatch layers below).
8. [`store/contexts/create-game-reducer.ts`](./store/contexts/create-game-reducer.ts) — live bounded-context path (`applyLiveContextReducers`) + DEV shadow path (`applyContextReducers`).
9. [`store/game-reducer-dispatch.ts`](./store/game-reducer-dispatch.ts) — legacy cluster fallback chain (`@deprecated`).
10. [`store/game-actions.ts`](./store/game-actions.ts) — `GameAction`-Union.
11. [`crafting/README.md`](./crafting/README.md) — most complex subsystem.

---

## High-Level Architecture

```
React UI (HUD + Panels + Grid)        ← liest state, ruft dispatch
    ↓ dispatch
useReducer(gameReducer)               ← Single Source of Truth
    ↓ state
Phaser Renderer (PhaserHost/Game)     ← liest Snapshots, NIE dispatch
```

Three strictly separated worlds:

- **Simulation** — pure logic, no DOM/canvas access.
- **React UI** — interactive mutation via `dispatch`.
- **Phaser Renderer** — read-only via state bridge.

Persistence and HMR restore hook in alongside the runtime without mutating logic.

---

## Main Runtime Flow

```
main.factory.tsx
  └─ FactoryApp.tsx
       ├─ ModeSelect (debug | release)
       └─ GameInner (key=mode)
            ├─ useReducer(gameReducer | gameReducerWithInvariants)
            │     state: GameState  •  dispatch: (GameAction) => void
            ├─ useGameTicks(state, dispatch)
            │    └─ 3 timers: Natural Spawn, Sapling Polling, BASE_TICK orchestrator
            ├─ localStorage save (alle 10 s + beforeunload)
            ├─ HMR-State-Restore (DEV)
            ├─ Grid (Phaser-Host + React-Overlays)
            └─ HUD + Panels (state als Prop, dispatch als Prop)
```

All mutations run through `dispatch`. Phaser is read-only via `state` snapshots.
useGameTicks nutzt drei Timer: einen Natural-Spawn-Timer, einen Sapling-Polling-Timer und einen zentralen BASE_TICK-Orchestrator, der alle uebrigen Tick-Aktionen in deterministischer Reihenfolge dispatcht. Dadurch bleiben alle Tick-Frequenzen erhalten, waehrend die Dispatch-Reihenfolge innerhalb eines Tick-Durchlaufs stabil ist.

### Dispatch Sources

In the current runtime, `dispatch` is triggered from four source groups:

- **Tick hooks** (`entry/use-game-ticks.ts`) dispatch all periodic actions (mostly `*_TICK`).
- **Pointer/UI interactions** (Grid, Panels, Menus) dispatch building, machine, and panel actions.
- **Keyboard input** (`entry/FactoryApp.tsx`) dispatches hotbar/build/panel actions (`SET_ACTIVE_SLOT`, `TOGGLE_BUILD_MODE`, `CLOSE_PANEL`).
- **DEV debug callbacks** (`DebugPanel`) trigger `onMock` / `onResetState`; `FactoryApp` dispatches `DEBUG_SET_STATE` for controlled state mocking/reset.

### DEV Scene Boot Path (DEV only)

In DEV debug mode, scene boot can be URL-driven via `?scene=`:

- `getDevSceneFromUrl()` resolves the scene id from the URL parameter.
- `applyDevScene()` returns a new state via `buildSceneState(...)` before gameplay mounts.
- `hasDevSceneUrlParam()` gates this path so normal save hydration remains default when no scene parameter is present.

---

## Tick Pipeline

| Tick             | Interval (ms)  | Action                  | Trigger                                               | Handler                                                                                 | Primary state writes                                                                                                                           |
| ---------------- | -------------- | ----------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Sapling Growth   | 1000 (Polling) | GROW_SAPLINGS           | Polling läuft immer; Dispatch nur bei reifen Saplings | growth-actions                                                                          | assets, cellMap, saplingGrowAt                                                                                                                 |
| Natural Spawn    | 60 000         | `NATURAL_SPAWN`         | always                                                | [`growth-actions`](./store/action-handlers/growth-actions/)                             | `assets`, `cellMap`, `saplingGrowAt`                                                                                                           |
| Smithy           | 100            | `SMITHY_TICK`           | only when `smithy.processing`                         | [`machine-actions`](./store/action-handlers/machine-actions.ts)                         | `smithy`                                                                                                                                       |
| Manual Assembler | 100            | `MANUAL_ASSEMBLER_TICK` | only when `manualAssembler.processing`                | [`manual-assembler-actions.ts`](./store/action-handlers/manual-assembler-actions.ts)    | `manualAssembler`, source inventory, `notifications`                                                                                           |
| Module Lab       | 500            | `MODULE_LAB_TICK`       | only while `moduleLabJob !== null`                    | [`module-lab-actions.ts`](./store/action-handlers/module-lab-actions.ts)                | `moduleLabJob`, `moduleInventory`, `moduleFragments`, `assets`, `notifications`                                                                |
| Generator        | 200            | `GENERATOR_TICK`        | only when at least 1 generator is running             | [`machine-actions`](./store/action-handlers/machine-actions.ts)                         | `generators`                                                                                                                                   |
| Energy Net       | 2000           | `ENERGY_NET_TICK`       | always                                                | inline `switch` → [`energy-net-tick.ts`](./store/energy/energy-net-tick.ts)             | `battery.stored`, `poweredMachineIds`, `machinePowerRatio`                                                                                     |
| Logistics        | 500            | `LOGISTICS_TICK`        | always                                                | dispatch-chain guard → [`logistics-tick.ts`](./store/action-handlers/logistics-tick.ts) | `autoMiners`, `conveyors`, `autoSmelters`, `autoAssemblers`, `inventory`, `warehouseInventories`, `smithy`, `notifications`, `autoDeliveryLog` |
| Crafting Jobs    | 500            | `JOB_TICK`              | only when pending jobs OR active keep-stock targets   | [`crafting-queue-actions`](./store/action-handlers/crafting-queue-actions/)             | `crafting`, `network`, physical inventories, `keepStockByWorkbench`                                                                            |
| Drones           | 500            | `DRONE_TICK`            | always (sequential per-drone processing in key order) | [`drone-tick-actions`](./store/action-handlers/drone-tick-actions/)                     | `drones`, target inventories, `crafting` (input buffer + delivery), `collectionNodes`                                                          |
| Ship             | 1000           | `SHIP_TICK`             | always                                                | [`ship-actions.ts`](./store/action-handlers/ship-actions.ts)                            | `ship`, `warehouseInventories`, `inventory`, `moduleInventory`, `moduleFragments`, `notifications`                                             |
| Notifications    | 500            | `EXPIRE_NOTIFICATIONS`  | always                                                | [`maintenance-actions`](./store/action-handlers/maintenance-actions/)                   | `notifications`                                                                                                                                |

There is no separate `AUTO_ASSEMBLER_TICK` action. Auto-assembler processing runs as Phase 4 (`runAutoAssemblerPhase`) inside `LOGISTICS_TICK`.

`autoDeliveryLog` ist transiente UI-Telemetrie und wird **nicht persistiert**.
Einträge entstehen bei jeder Auto-Delivery (Auto-Miner, Conveyor-Transfer).
Mehrere Einträge innerhalb eines Zeitfensters werden gebatcht; bei Erreichen
eines konfigurierten Limits werden älteste Einträge rotiert (FIFO).
Die React-Komponente liest das Log direkt aus dem Game-State
(`FactoryApp.tsx:342`). Ziel ist ausschließlich UI-Feedback, keine
Replay-Fähigkeit.

> Hinweis: Die 1000 ms sind die Polling-Frequenz. Die Reifezeit eines neu gespawnten Saplings wird über `SAPLING_GROW_MS` gesetzt (derzeit 30 000 ms).

Most intervals use constants in [`store/constants/timing/timing.ts`](./store/constants/timing/timing.ts), [`store/constants/energy/`](./store/constants/energy/), [`store/constants/timing/workbench-timing.ts`](./store/constants/timing/workbench-timing.ts), and [`constants/moduleLabConstants.ts`](./constants/moduleLabConstants.ts). Sapling readiness scanning (1000ms) and notification cleanup (500ms) are currently inline literals in [`entry/use-game-ticks.ts`](./entry/use-game-ticks.ts).

**Consequence of nondeterminism:** Tick logic must be sufficiently commutative. Race conditions are tolerated because each tick performs a complete reducer pass and no intermediate states are shared across ticks.

---

## Data Flow

### Write Path

```
UI-Event / setInterval
  → dispatch(action)
  → gameReducer(state, action)
       → handleXAction(state, action, deps?) → GameState | null   [Cluster-Kette]
       → inline switch(action)                                    [Fallback]
  → neuer state
  → React Re-Render
  → Phaser Bridge konsumiert Snapshot
  → Save-Codec (alle 10 s) → localStorage
```

### Read Path

UI and Phaser consume `state` exclusively as a prop / snapshot. Read-only aggregations for UI/drones live in [`store/selectors/`](./store/selectors/).

### Inventory Data Flow

`GameState` contains three physical stock layers plus one logical reservation layer:

1. `inventory` — global fallback pool.
2. `warehouseInventories[id]` — physical warehouse and dock-warehouse storage.
3. `serviceHubs[id].inventory` — physical hub-local stock for drone and hub flows.
4. `network.reservations` — logical holds over physical sources.

**Canonical:** physical state is the source of truth; `network` is derived. Crafting jobs link to reservations through `job.reservationOwnerId`, and reservation entries store that value as `ownerId`.
Detailed routing to inventory code: [/SYSTEM_REGISTRY.md §5.4](../../SYSTEM_REGISTRY.md).

### Source-Precedence (Building Resource Resolution)

When a building resolves its source for crafting/logistics reads and writes, precedence is:

1. `buildingZoneIds` (if the assigned zone exists and has at least one warehouse)
2. `buildingSourceWarehouseIds` (explicit per-building warehouse assignment)
3. global fallback (`inventory`)

This priority is implemented in `store/building-source.ts` via `resolveBuildingSource()`. For zone sources, mutations do not write directly into a single warehouse; they use `applyZoneDelta()` (via `crafting/crafting-sources.ts`) to distribute deltas across zone warehouses deterministically.

### CollectionNode Claiming Semantics

`collectionNodes` are claimable world drops. Concurrency between drones is coordinated through `reservedByDroneId`:

- **Claim set:** task transition into `moving_to_collect` sets `reservedByDroneId = droneId`.
- **Claim held:** while the drone is en route/collecting, candidate scoring and filtering treat this node as reserved.
- **Claim release:** claim is cleared when collection finalizes, when assignment/transition aborts, or when node state is reset during load normalization.

Beim Laden werden Claims in beiden Pfaden auf `null` gesetzt: im Save-Codec sowie in den Save-Migrations, jeweils über `reservedByDroneId = null`.

---

## State Map

`GameState` is a single flat interface in [`store/types.ts`](./store/types.ts) (Interface `GameState`). Logically, it decomposes into the following slices:

| Slice (logical)          | Fields                                                                                                                                                                                                                                                                      | Persisted |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **Identity**             | `mode`                                                                                                                                                                                                                                                                      | yes       |
| **Inventories**          | `inventory`, `warehouseInventories`, `serviceHubs`, `network`                                                                                                                                                                                                               | yes       |
| **Terrain / World**      | `tileMap`, `floorMap`, `assets`, `cellMap`, `collectionNodes`, `saplingGrowAt`                                                                                                                                                                                              | yes       |
| **Build / Shop**         | `purchasedBuildings`, `placedBuildings`, `warehousesPurchased`, `warehousesPlaced`, `cablesPlaced`, `powerPolesPlaced`, `buildMode`, `selectedBuildingType`, `selectedFloorTile`, `unlockedBuildings`                                                                       | yes       |
| **Hotbar**               | `hotbarSlots`, `activeSlot`                                                                                                                                                                                                                                                 | yes       |
| **Machines / Logistics** | `smithy`, `manualAssembler`, `autoMiners`, `autoSmelters`, `autoAssemblers`, `conveyors`, `conveyorUndergroundPeers`, `generators`, `battery`                                                                                                                               | yes       |
| **Conveyor Routing**     | `splitterRouteState`, `splitterFilterState`                                                                                                                                                                                                                                 | yes       |
| **Energy**               | `connectedAssetIds`, `poweredMachineIds`, `machinePowerRatio`, `energyDebugOverlay`                                                                                                                                                                                         | partial   |
| **Drones / Hubs**        | `drones`, `constructionSites`                                                                                                                                                                                                                                               | yes       |
| **Zones**                | `productionZones`, `buildingZoneIds`, `buildingSourceWarehouseIds`                                                                                                                                                                                                          | yes       |
| **Crafting**             | `crafting`, `keepStockByWorkbench`, `recipeAutomationPolicies`                                                                                                                                                                                                              | yes       |
| **Modules / Module Lab** | `moduleInventory`, `moduleFragments`, `moduleLabJob`                                                                                                                                                                                                                        | yes       |
| **Ship / Dock**          | `ship`                                                                                                                                                                                                                                                                      | yes       |
| **UI (transient)**       | `openPanel`, `selectedWarehouseId`, `selectedPowerPoleId`, `selectedAutoMinerId`, `selectedAutoSmelterId`, `selectedAutoAssemblerId`, `selectedGeneratorId`, `selectedServiceHubId`, `selectedCraftingBuildingId`, `selectedSplitterId`, `notifications`, `autoDeliveryLog` | no        |

`unlockedBuildings` (`string[]`) startet mit Tier-0-Unlocks; Legacy-Saves werden per Migration auf gueltige Unlock-Listen angehoben.

The starter drone lives in `drones["starter"]`. `selectStarterDrone()` and `requireStarterDrone()` remain the stable read API; save migration v30 removed the old duplicated field.
Die aktuelle Save-Version ist 32. Zwischenschritte: v30 entfernt das legacy-duplicated `starterDrone`-Feld, v31 ergaenzt `unlockedBuildings` fuer Legacy-Saves, v32 ergaenzt `research_lab` idempotent in `unlockedBuildings`. Alle Schritte sind in `save-migrations.ts` dokumentiert.

Type definitions for all slice fields: see [TYPES.md](./TYPES.md).

## Current Runtime Domains Not Shown In The Old Core Loop

### Cell Interaction & Build/Floor Entry Path

- `CLICK_CELL` is the central grid interaction entry and is handled by `handleClickCellAction`.
- Build-mode selection (`TOGGLE_BUILD_MODE`, `SELECT_BUILD_BUILDING`, `SELECT_BUILD_FLOOR_TILE`) is handled by `build-mode-actions`.
- Floor placement uses its own action path (`BUILD_PLACE_FLOOR_TILE` -> `handleFloorPlacementAction`).
- Building placement/removal remains separate (`BUILD_PLACE_BUILDING`, `BUILD_REMOVE_ASSET`) via `building-placement`.
- All four paths are wired in `dispatchAction` (`store/game-reducer-dispatch.ts`) as separate reducer clusters.

### Research Lab / Unlock Pipeline

Das Unlock-System laeuft ueber die Action `RESEARCH_BUILDING` mit item-basierten Research-Rezepten (`research.ts`).
Der Handler schreibt das Ergebnis in das persistierte Feld `unlockedBuildings`; die Action wird ueber `game-reducer-dispatch.ts` in die Dispatch-Kette eingebunden.
Die Platzierungslogik (`place-building.ts`) gate't alle Gebaeudetypen, die noch nicht freigeschaltet sind.
Die Bedienung erfolgt ueber das Research-Lab-Panel (`FactoryApp.tsx`).

### Production Zones

Production Zones bilden einen eigenen Reducer-Cluster
(`store/game-reducer-dispatch.ts`, `handleZoneAction`) und beeinflussen direkt die
Build-/Crafting-Source-Auflösung.

Source-Precedence: Zone → explizites Warehouse → global.
Inventaränderungen für Zone-Sources werden über `applyZoneDelta`
deterministisch auf die zugehörigen Zone-Warehouses verteilt
(`production-zone-mutation.ts`, `production-zone-aggregation.ts`).

Die Routing- und Source-Logik liest Zone-Zugehörigkeit über
`resolveBuildingSource()` in `store/building-source.ts`.

### Ship / Dock Quest System

`state.ship` is persisted and advanced by `SHIP_TICK`. Dock quests use the fixed Dock Warehouse inventory (`dock-warehouse`) and can reward coins, resources, module fragments, or complete modules.

#### Fragment Trader

The Fragment Trader is a ship-adjacent subsystem with dedicated UI + action flow:

- `FragmentTraderPanel` is mounted via `openPanel === "fragment_trader"` in `entry/FactoryApp.tsx`.
- `BUY_FRAGMENT` spends coins and writes one `module_fragment` item into Dock Warehouse storage.
- `COLLECT_FRAGMENT` converts docked fragment items into persisted `moduleFragments`.

This creates a two-step path (buy/deposit then collect/convert) rather than directly incrementing `moduleFragments` on purchase.

- `BUY_FRAGMENT` schreibt über `addDockWarehouseItem` ein `module_fragment` in das Dock-Warehouse-Inventar.
- `COLLECT_FRAGMENT` konvertiert über `collectDockWarehouseFragment` Dock-Warehouse-Fragmente in den persistierten Zähler `moduleFragments`.

### Modules / Module Lab

`moduleFragments`, `moduleInventory`, and `moduleLabJob` are persisted. The Module Lab consumes fragments, advances with `MODULE_LAB_TICK`, and writes completed module instances into `moduleInventory`; equipped modules are mirrored on `asset.moduleSlot`.

### Service Hub Tiering / Upgrade Delivery

Service hubs are tiered and persisted through `serviceHubs[hubId]`:

- Tier model: `tier` is `1 | 2` (`types.ts`).
- Runtime upgrade marker: `pendingUpgrade` holds outstanding resource demand while an upgrade is in flight.
- Action entry: `UPGRADE_HUB` (`game-actions.ts`) does **not** immediately drain warehouses; it creates a construction-style demand.
- Construction integration: `building-site.ts` writes the pending demand into `constructionSites[hubId]` (construction debt).
- Finalization path A: drone construction deliveries resolve site debt; when complete, the deposit flow finalizes Tier 2, clears `pendingUpgrade`, and updates hub capabilities.
- Finalization path B: if a pending upgrade is satisfied via hub inventory state, the same drone deposit flow finalizes Tier 2 through the hub-upgrade satisfaction check.
- Finalisierungspfad A läuft über den Construction-Supply-Abschluss und ruft `finalizeHubTier2Upgrade` auf.
- Finalisierungspfad B läuft nach Hub-Deposit über `isHubUpgradeDeliverySatisfied` und ruft danach `finalizeHubTier2Upgrade` auf.

### Construction Sites

Construction Sites entstehen in zwei Pfaden:
(a) Regulärer Building-Placement-Flow (`place-building.ts`): Beim Platzieren eines
Gebäudes wird eine Construction Site angelegt, die offene Materialschuld
in `constructionSites[assetId]` hält.
(b) Hub-Upgrade-Flow (`UPGRADE_HUB`): Analog wird beim Hub-Upgrade eine Site erstellt.

Drone-Deposits (`deposit-construction.ts`) reduzieren schrittweise die `remaining`-
Schuld. Bei vollständiger Lieferung wird der Site-Eintrag entfernt und abhängige
Runtime-Daten (z. B. `connectedAssetIds`) werden recomputed.

Relevante Dateien: `store/action-handlers/building-placement/place-building.ts`, `drones/execution/drone-finalization/depositing/deposit-construction.ts`.

### Conveyor Route State

`conveyorUndergroundPeers`, `splitterRouteState`, and `splitterFilterState` are persisted logistics state. Splitter-Routing in `store/conveyor/conveyor-routing.ts` arbeitet nach folgendem Schema:

1. **Filter-Prüfung**: Vor der Side-Auswahl werden optionale Output-Filter
   pro Output-Seite geprüft.
2. **Round-Robin**: Über `lastSide` wird die nächste Ausgabe-Seite im
   Round-Robin-Verfahren gewählt.
3. **State-Update**: Bei erfolgreichem Routing wird `splitterRouteState`
   für den jeweiligen Splitter aktualisiert.
4. **Fallback**: Schlägt das Routing fehl (Filter blockiert, kein Platz),
   bleibt das Item auf dem Eingangs-Conveyor.

`SET_SPLITTER_FILTER` persistiert die Filter-Konfiguration pro Seite.

### Bootstrap / Fixed Dock Warehouse

The Dock Warehouse is not a normal build-menu placement. It is seeded and normalized by `applyDockWarehouseLayout()` and stored as a fixed `dock_warehouse` asset with `isDockWarehouse: true`.

---

## React vs Phaser vs Reducer — Boundaries

| Layer                       | Directory/directories                                                                                                                                                                                                                                                                               | Writes state?         | Reads state?        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------- |
| **Simulation (Pure Logic)** | [`store/`](./store/) (including [`store/selectors/`](./store/selectors/)), [`crafting/`](./crafting/), [`drones/`](./drones/), [`inventory/`](./inventory/), [`logistics/`](./logistics/), [`zones/`](./zones/), [`power/`](./power/), [`buildings/`](./buildings/), [`simulation/`](./simulation/) | only via reducer      | —                   |
| **UI (React)**              | [`ui/`](./ui/), [`grid/Grid*.tsx`](./grid/)                                                                                                                                                                                                                                                         | only via `dispatch`   | yes, as prop        |
| **Renderer (Phaser)**       | [`world/PhaserGame.ts`](./world/PhaserGame.ts), [`world/PhaserHost.tsx`](./world/PhaserHost.tsx), [`assets/sprites/`](./assets/sprites/)                                                                                                                                                            | never                 | snapshot via bridge |
| **Persistence**             | [`simulation/save*.ts`](./simulation/)                                                                                                                                                                                                                                                              | codec only            | hydrates state      |
| **Debug**                   | [`debug/`](./debug/)                                                                                                                                                                                                                                                                                | via `DEBUG_SET_STATE` | yes                 |
| **Entry / Bootstrap**       | [`entry/`](./entry/)                                                                                                                                                                                                                                                                                | indirectly            | yes                 |

**Golden rule:** Phaser must never call `dispatch`. UI events are the only source of interactive mutations apart from tickers.

**Rationale:** Phaser is render output, not an input channel. If Phaser dispatched, it would create a second mutation path alongside React — tests, replay, and save hydration rely on every state transition running through `dispatch`.

---

## Important Architecture Decisions

### 1. `GameAction` is standalone (Wave 2/3/3.5)

[`store/game-actions.ts`](./store/game-actions.ts) is the only canonical source of the `GameAction` union. No reducer code, no mixed-in logic — pure type definition. The old `actions.ts` re-export is gone; action handlers import `GameAction` directly from `store/game-actions.ts`.

**Rationale:** `grep "type GameAction ="` returns exactly one match. Findability for LLMs and humans.

### 2. Read-only selectors in `store/selectors/`

[`store/selectors/`](./store/selectors/) contains read-only view helpers, including zone/source/conveyor status, hub tier, drone status, and module selectors. New code should import selectors directly from `store/selectors/**`. `reducer.ts` still re-exports `reducer-public-api.ts` as a compatibility surface for older consumers.

**Rationale:** UI and drone code should import directly from `selectors/`, not via `reducer.ts`. One symbol — one canonical file.

### 3. Constants directly from `constants/`

Grid/building constants have canonical homes under `constants/` and `store/constants/`. Prefer direct imports for new code. For backward compatibility, `store/reducer.ts` still re-exports `reducer-public-api.ts`, and `simulation/game.ts` re-exports `store/reducer`.

### 4. Three-layer dispatch: bounded-context (live) → legacy cluster chain → DEV shadow diff

`gameReducer` in [`store/reducer.ts`](./store/reducer.ts) routes every action through three layers in order:

1. **Live bounded-context path** — `applyLiveContextReducers` in [`store/contexts/create-game-reducer.ts`](./store/contexts/create-game-reducer.ts). Handles a curated allowlist of actions (notifications, zone, network commit/cancel, warehouse hotbar/transfer, crafting queue, UI selection) through the per-domain reducers in [`store/contexts/`](./store/contexts/). Returns `null` to fall through.
2. **Legacy fallback chain** — `dispatchAction` in [`store/game-reducer-dispatch.ts`](./store/game-reducer-dispatch.ts). Chain of `handleXAction(state, action, deps?) → GameState | null`. Some clusters use `HANDLED_ACTION_TYPES` guards, others use inline `switch(action.type)` (e.g. `machine-actions.ts`, `ship-actions.ts`, `module-lab-actions.ts`). Remaining actions land in the inline `switch` at the end. This file is `@deprecated` — new handlers belong in `store/contexts/`.
3. **DEV shadow diff** — in DEV only, the full bounded-context composition (`applyContextReducers`) re-runs on the pre-action state and `shadowDiff` compares its result to the legacy output. Mismatches log warnings; the legacy result is what the store sees. Production builds skip the diff entirely.

The cutover plan is documented in [`docs/bounded-context-state-management-prd.md`](../../docs/bounded-context-state-management-prd.md).

**Rationale:** Bounded contexts narrow each reducer to a small state slice with an exhaustive action union, which makes ownership and isolation explicit. Running the legacy dispatcher as the source of truth while contexts ramp up keeps behaviour stable; the shadow diff catches regressions before each migration step flips into the live path.

### 5. Physical inventory layers + reservation layer coexist

`inventory` (global) / `warehouseInventories` (physical warehouses + dock warehouse) / `serviceHubs[].inventory` (physical hub stock) + `network` (logical reservations). Physical state is the source of truth.

**Rationale:** Reservations must be able to apply independently of physical stock (crafting reserves before it delivers), but physical inventory must remain readable at all times without a reservation lookup (manual harvesting, UI).

### 6. Strict separation of Planning vs. Execution in the crafting tick

`crafting/tick.ts` + `crafting/tickPhases.ts` separate the planning phase (decide what happens) from the execution phase (mutate state).

**Rationale:** Planning can iteratively reject candidates without leaving state inconsistencies.

## 7. Tick-Orchestrierung und Reihenfolge-Rationale

Die Tick-Architektur basiert auf einem zentralen BASE_TICK-Orchestrator statt auf voneinander entkoppelten Intervallen. Ziel ist eine reproduzierbare Dispatch-Reihenfolge fuer voneinander abhaengige Systeme bei unveraenderten Tick-Intervallen.

Deterministische Reihenfolge innerhalb eines Orchestrator-Durchlaufs:

1. `GENERATOR_TICK` - Ressourcenproduktion
2. `ENERGY_NET_TICK` - Energienetz-Update
3. `LOGISTICS_TICK` - Logistik + Auto-Assembler-Phase
4. `DRONE_TICK` - Drohnen-Bewegung
5. `JOB_TICK` - Job-Queue-Verarbeitung

Jede Phase sieht damit den konsistenten Vorzustand der vorherigen. Sondertimer (Natural Spawn, Sapling-Polling) laufen weiterhin unabhaengig, da sie keine Abhaengigkeit zu den oben genannten Phasen haben.

---

## Glossary

| Term                                 | Meaning                                                                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------- |
| **Asset**                            | Placed world object (building, tree, deposit, drone-capable). Keyed by `assetId`.                                          |
| **Cell**                             | 1×1 grid tile. Addressed via `cellKey(x,y)` from [`store/utils/cell-key.ts`](./store/utils/cell-key.ts).                   |
| **Hub / Service Hub**                | Drone home base with its own inventory (`ServiceHubInventory`).                                                            |
| **Workbench**                        | Crafting asset; occupied by crafting jobs.                                                                                 |
| **Network Slice**                    | Logical reservations on physical inventory. Defined in [`inventory/reservationTypes.ts`](./inventory/reservationTypes.ts). |
| **Owner**                            | Owner of a reservation. Convention: `reservationOwnerId === job.id` and reservation `ownerId === reservationOwnerId`.      |
| **Source / CraftingInventorySource** | Discriminated union: `global` \| `warehouse` \| `zone`.                                                                    |
| **Zone / ProductionZone**            | Logical grouping of buildings + warehouses with aggregated stock.                                                          |
| **Job-Lifecycle**                    | `queued → reserved → crafting → delivering → done                                                                          | cancelled`.  |
| **Keep-Stock-Target**                | Per-workbench/recipe auto-refill threshold.                                                                                |
| **Tick-Phase**                       | Internal step of a tick handler (e.g. `auto-miner` in `LOGISTICS_TICK`).                                                   |
| **Cluster**                          | Group of related action types with a shared handler under `store/action-handlers/`.                                        |
| **Deps**                             | Reducer-internal helpers injected into handlers. Avoids ESM cycles.                                                        |
| **HMR**                              | Hot Module Replacement. In DEV, state is mirrored on `window.__FI_HMR_STATE__` via `debug/hmrState.ts`.                    |
| **Construction Site**                | Building that still has outstanding resource debt. Drones deliver.                                                         |
| **DroneRole**                        | `auto                                                                                                                      | construction | supply`— affects only task scoring; role changes mutate only`drone.role` and do **not** cancel running tasks. |

---

## Appendix — Build & Tooling

### Entry HTML + Vite wiring

- `index.factory.html` is the browser entry document and mounts `src/game/entry/main.factory.tsx`.
- `vite.factory.config.ts` is the canonical Vite config for this game entry.
- The `factory-html-fallback` dev middleware rewrites `/` to `index.factory.html`.
- Build output targets `dist-factory/`; Phaser is split into a dedicated manual chunk.

### Standard scripts (`package.json`)

- `yarn dev` — run Vite dev server with `vite.factory.config.ts`.
- `yarn build` — run TypeScript project build (`tsconfig.factory.json`) and Vite production build.
- `yarn preview` — preview the production bundle.
- `yarn test` — run Jest tests.
- `yarn lint` — run ESLint across `.ts/.tsx` sources.

This appendix is intentionally short and architecture-focused; operational details remain in root-level setup docs.

---

## References

- [/SYSTEM_REGISTRY.md](../../SYSTEM_REGISTRY.md) — system routing, paths, hotspots, change recipes.
- [TYPES.md](./TYPES.md) — type domains and cross-domain dependencies.
- [`crafting/README.md`](./crafting/README.md) — job lifecycle in detail.
