# `src/game` — Architecture

> Architecture, runtime, and data-flow documentation. Current state. If conflicts arise, code is authoritative.
> **Last verified:** 2026-05-01.

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
6. [`store/types.ts`](./store/types.ts) from L316 — `GameState` shape.
7. [`store/reducer.ts`](./store/reducer.ts) — thin reducer entry point.
8. [`store/game-reducer-dispatch.ts`](./store/game-reducer-dispatch.ts) — actual dispatch chain.
9. [`store/game-actions.ts`](./store/game-actions.ts) — `GameAction`-Union.
10. [`crafting/README.md`](./crafting/README.md) — most complex subsystem.

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
            │    └─ ~10× setInterval → dispatch({type: "X_TICK"})
            ├─ localStorage save (alle 10 s + beforeunload)
            ├─ HMR-State-Restore (DEV)
            ├─ Grid (Phaser-Host + React-Overlays)
            └─ HUD + Panels (state als Prop, dispatch als Prop)
```

All mutations run through `dispatch`. Phaser is read-only via `state` snapshots. Tick order within a browser frame is **not guaranteed** — each tick is its own `setInterval`.

---

## Tick Pipeline

| Tick | Interval (ms) | Action | Trigger | Handler | Primary state writes |
|---|---|---|---|---|---|
| Sapling Growth | 1000 | `GROW_SAPLINGS` | always | [`growth-actions`](./store/action-handlers/growth-actions/) | `assets`, `cellMap`, `saplingGrowAt` |
| Natural Spawn | 60 000 | `NATURAL_SPAWN` | always | [`growth-actions`](./store/action-handlers/growth-actions/) | `assets`, `cellMap`, `saplingGrowAt` |
| Smithy | 100 | `SMITHY_TICK` | only when `smithy.processing` | [`machine-actions`](./store/action-handlers/machine-actions.ts) | `smithy` |
| Manual Assembler | 100 | `MANUAL_ASSEMBLER_TICK` | only when `manualAssembler.processing` | [`manual-assembler-actions.ts`](./store/action-handlers/manual-assembler-actions.ts) | `manualAssembler`, source inventory, `notifications` |
| Generator | 200 | `GENERATOR_TICK` | only when at least 1 generator is running | [`machine-actions`](./store/action-handlers/machine-actions.ts) | `generators` |
| Energy Net | 2000 | `ENERGY_NET_TICK` | always | inline `switch` → [`energy-net-tick.ts`](./store/energy/energy-net-tick.ts) | `battery.stored`, `poweredMachineIds`, `machinePowerRatio` |
| Logistics | 500 | `LOGISTICS_TICK` | always | inline `switch` → [`logistics-tick.ts`](./store/action-handlers/logistics-tick.ts) | `autoMiners`, `conveyors`, `autoSmelters`, `inventory`, `warehouseInventories`, `smithy`, `notifications`, `autoDeliveryLog` |
| Crafting Jobs | 500 | `JOB_TICK` | only when pending jobs OR active keep-stock targets | [`crafting-queue-actions`](./store/action-handlers/crafting-queue-actions/) | `crafting`, `network`, physical inventories, `keepStockByWorkbench` |
| Drones | 500 | `DRONE_TICK` | always | [`drone-tick-actions`](./store/action-handlers/drone-tick-actions/) | `drones`, `starterDrone`, target inventories, `crafting` (input buffer + delivery), `collectionNodes` |
| Notifications | 500 | `EXPIRE_NOTIFICATIONS` | always | [`maintenance-actions`](./store/action-handlers/maintenance-actions/) | `notifications` |

Constants in [`store/constants/timing/timing.ts`](./store/constants/timing/timing.ts), [`store/constants/energy/`](./store/constants/energy/), [`store/constants/timing/workbench-timing.ts`](./store/constants/timing/workbench-timing.ts).

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

`GameState` contains three inventory layers that together define the truth about stock:

1. `inventory` — global fallback pool.
2. `warehouseInventories[id]` — physical warehouses.
3. `network.reservations` — logical holds on (1)+(2).

**Canonical:** physical state is the source of truth; `network` is derived. Reservations are managed through owner keys (convention: `ownerKey === jobId`).
Detailed routing to inventory code: [/SYSTEM_REGISTRY.md §5.4](../../SYSTEM_REGISTRY.md).

---

## State Map

`GameState` is a single flat interface in [`store/types.ts:316`](./store/types.ts#L316) with ~62 fields. Logically, it decomposes into the following slices:

| Slice (logical) | Fields | Persisted |
|---|---|---|
| **Identity** | `mode` | yes |
| **Inventories** | `inventory`, `warehouseInventories`, `network` | yes |
| **Assets / World** | `assets`, `cellMap`, `floorMap`, `collectionNodes`, `saplingGrowAt` | yes |
| **Build / Shop** | `purchasedBuildings`, `placedBuildings`, `warehousesPurchased`, `warehousesPlaced`, `cablesPlaced`, `powerPolesPlaced`, `buildMode`, `selectedBuildingType`, `selectedFloorTile` | partial |
| **Hotbar** | `hotbarSlots`, `activeSlot` | yes |
| **Machines** | `smithy`, `manualAssembler`, `autoMiners`, `autoSmelters`, `conveyors`, `generators`, `battery` | yes |
| **Energy** | `connectedAssetIds`, `poweredMachineIds`, `machinePowerRatio`, `energyDebugOverlay` | partial |
| **Drones / Hubs** | `starterDrone`, `drones`, `serviceHubs`, `constructionSites` | yes |
| **Zones** | `productionZones`, `buildingZoneIds`, `buildingSourceWarehouseIds` | yes |
| **Crafting** | `crafting`, `keepStockByWorkbench`, `recipeAutomationPolicies` | yes |
| **UI (transient)** | `openPanel`, `selectedWarehouseId`, `selectedPowerPoleId`, `selectedAutoMinerId`, `selectedAutoSmelterId`, `selectedGeneratorId`, `selectedServiceHubId`, `selectedCraftingBuildingId`, `notifications`, `autoDeliveryLog` | no |

`starterDrone` and `drones[id]` are kept synchronized — legacy for backward compatibility. (*UNCERTAIN:* Migration path not documented; for `syncDrones`, see [`drones/utils/drone-state-helpers.ts`](./drones/utils/drone-state-helpers.ts).)

Type definitions for all slice fields: see [TYPES.md](./TYPES.md).

---

## React vs Phaser vs Reducer — Boundaries

| Layer | Directory/directories | Writes state? | Reads state? |
|---|---|---|---|
| **Simulation (Pure Logic)** | [`store/`](./store/) (including [`store/selectors/`](./store/selectors/)), [`crafting/`](./crafting/), [`drones/`](./drones/), [`inventory/`](./inventory/), [`logistics/`](./logistics/), [`zones/`](./zones/), [`power/`](./power/), [`buildings/`](./buildings/), [`simulation/`](./simulation/) | only via reducer | — |
| **UI (React)** | [`ui/`](./ui/), [`grid/Grid*.tsx`](./grid/) | only via `dispatch` | yes, as prop |
| **Renderer (Phaser)** | [`world/PhaserGame.ts`](./world/PhaserGame.ts), [`world/PhaserHost.tsx`](./world/PhaserHost.tsx), [`assets/sprites/`](./assets/sprites/) | never | snapshot via bridge |
| **Persistence** | [`simulation/save*.ts`](./simulation/) | codec only | hydrates state |
| **Debug** | [`debug/`](./debug/) | via `DEBUG_SET_STATE` | yes |
| **Entry / Bootstrap** | [`entry/`](./entry/) | indirectly | yes |

**Golden rule:** Phaser must never call `dispatch`. UI events are the only source of interactive mutations apart from tickers.

**Rationale:** Phaser is render output, not an input channel. If Phaser dispatched, it would create a second mutation path alongside React — tests, replay, and save hydration rely on every state transition running through `dispatch`.

---

## Important Architecture Decisions

### 1. `GameAction` is standalone (Wave 2/3/3.5)

[`store/game-actions.ts`](./store/game-actions.ts) is the only canonical source of the `GameAction` union. No reducer code, no mixed-in logic — pure type definition. `actions.ts` (formerly a pure re-export) was removed; all 45 handlers import directly.

**Rationale:** `grep "type GameAction ="` returns exactly one match. Findability for LLMs and humans.

### 2. Read-only selectors in `store/selectors/`

[`store/selectors/`](./store/selectors/) contains only non-mutating aggregations (zone, source status, conveyor-zone status). `reducer.ts` re-exports them only for compatibility reasons.

**Rationale:** UI and drone code should import directly from `selectors/`, not via `reducer.ts`. One symbol — one canonical file.

### 3. Constants directly from `constants/`

Grid and building constants (`GRID_W`, `GRID_H`, `CELL_PX`, `WAREHOUSE_CAPACITY`) are imported directly from [`constants/grid.ts`](./constants/grid.ts) and [`store/constants/buildings/index.ts`](./store/constants/buildings/index.ts). `reducer.ts` is no longer a re-export hub.

### 4. Cluster handler chain instead of mega-switch

`dispatchAction` in [`store/game-reducer-dispatch.ts`](./store/game-reducer-dispatch.ts) is the dispatch chain of `handleXAction(state, action, deps?) → GameState | null`. Each handler decides via the `HANDLED_ACTION_TYPES` set whether it is responsible; `null` = fallthrough. Remaining actions land in the inline `switch` at the end of this file. [`store/reducer.ts`](./store/reducer.ts) remains the thin public entry point.

**Rationale:** Clusters are grouped by domain (crafting, drones, energy). A domain change touches only one cluster. Deps are injected to avoid ESM cycles with `reducer.ts`.

### 5. Three inventory layers coexist

`inventory` (global) / `warehouseInventories` (physical) / `network` (logically reserved). Physical state is the source of truth.

**Rationale:** Reservations must be able to apply independently of physical stock (crafting reserves before it delivers), but physical inventory must remain readable at all times without a reservation lookup (manual harvesting, UI).

### 6. Strict separation of Planning vs. Execution in the crafting tick

`crafting/tick.ts` + `crafting/tickPhases.ts` separate the planning phase (decide what happens) from the execution phase (mutate state).

**Rationale:** Planning can iteratively reject candidates without leaving state inconsistencies.

### 7. Tick order deliberately nondeterministic

No global tick orchestrator — every `setInterval` runs independently.

**Rationale:** Simpler than a centralized scheduler. Race conditions are tolerable because each tick performs a complete reducer pass. (*UNCERTAIN:* Race safety per tick has not been formally verified.)

---

## Glossary

| Term | Meaning |
|---|---|
| **Asset** | Placed world object (building, tree, deposit, drone-capable). Keyed by `assetId`. |
| **Cell** | 1×1 grid tile. Addressed via `cellKey(x,y)` from [`store/utils/cell-key.ts`](./store/utils/cell-key.ts). |
| **Hub / Service Hub** | Drone home base with its own inventory (`ServiceHubInventory`). |
| **Workbench** | Crafting asset; occupied by crafting jobs. |
| **Network Slice** | Logical reservations on physical inventory. Defined in [`inventory/reservationTypes.ts`](./inventory/reservationTypes.ts). |
| **Owner** | Owner of a reservation. Convention: `ownerKey === jobId`. |
| **Source / CraftingInventorySource** | Discriminated union: `global` \| `warehouse` \| `zone`. |
| **Zone / ProductionZone** | Logical grouping of buildings + warehouses with aggregated stock. |
| **Job-Lifecycle** | `queued → reserved → crafting → delivering → done|cancelled`. |
| **Keep-Stock-Target** | Per-workbench/recipe auto-refill threshold. |
| **Tick-Phase** | Internal step of a tick handler (e.g. `auto-miner` in `LOGISTICS_TICK`). |
| **Cluster** | Group of related action types with a shared handler under `store/action-handlers/`. |
| **Deps** | Reducer-internal helpers injected into handlers. Avoids ESM cycles. |
| **HMR** | Hot Module Replacement. State is mirrored in `sessionStorage`. |
| **Construction Site** | Building that still has outstanding resource debt. Drones deliver. |
| **DroneRole** | `auto | construction | supply` — affects only task scoring; role changes mutate only `drone.role` and do **not** cancel running tasks. |

---

## References

- [/SYSTEM_REGISTRY.md](../../SYSTEM_REGISTRY.md) — system routing, paths, hotspots, change recipes.
- [TYPES.md](./TYPES.md) — type domains and cross-domain dependencies.
- [`crafting/README.md`](./crafting/README.md) — job lifecycle in detail.
