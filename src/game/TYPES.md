# Factory Island — Type Index

> Domain type knowledge. Quick reference for AI prompting.
> **Last verified:** 2026-05-01.

---

## When should I read this file?

- You need the **type signature** of a domain concept (job, drone, reservation, asset).
- You want to know **which types are shared between domains** (cross-domain).
- You are adding a **new type** and need the conventions + checklist.

## What is not covered here?

- **Which file is responsible for X?** → [/SYSTEM_REGISTRY.md](../../SYSTEM_REGISTRY.md).
- **How do ticks / dispatches / data flow work?** → [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Reading Order

1. Read this overview and identify the affected domain.
2. Open the source file for the domain ("Source" column).
3. For cross-domain changes: check §"Cross-Domain Dependencies" at the end.

---

## Domain Overview

| Domain | Source | Contents |
|---|---|---|
| Store & Core State | [`store/types.ts`](./store/types.ts) | `GameState` + all slice types |
| Crafting | [`crafting/types.ts`](./crafting/types.ts) | job lifecycle types |
| Items | [`items/types.ts`](./items/types.ts) | item IDs, categories, stacks |
| Inventory / Reservations | [`inventory/reservationTypes.ts`](./inventory/reservationTypes.ts) | reservation types, network slice |
| Drones | [`drones/candidates/types.ts`](./drones/candidates/types.ts), [`drones/candidates/candidate-builder.ts`](./drones/candidates/candidate-builder.ts) | task-selection types |
| Game Actions | [`store/game-actions.ts`](./store/game-actions.ts) | `GameAction` union type |

---

## 🏗️ Store & Core State

**Source:** [`store/types.ts`](./store/types.ts)

| Type | Description |
|------|-------------|
| `GameState` | Root state object — all runtime data (assets, inventory, drones, crafting, energy, UI) |
| `PlacedAsset` | Building or resource node on the grid: `{ id, type, x, y, size, direction?, priority?, boosted? }` |
| `AssetType` | Union of all grid entities: trees, buildings, conveyors, service hubs, etc. |
| `BuildingType` | Subset of `AssetType` — only player-placeable buildings |
| `Inventory` | `{ coins: number } & Record<ItemId, number>` — global or per-warehouse pool |
| `Direction` | `"north" \| "east" \| "south" \| "west"` |
| `GameMode` | `"release" \| "debug"` — controls infinite warehouse + drop-rate overrides |
| `CollectableItemType` | `"wood" \| "stone" \| "iron" \| "copper"` — physically collectable by drones |
| `CollectionNode` | World-dropped resource pile with tile + claim status |
| `DroneTaskType` | `"construction_supply" \| "hub_restock" \| "hub_dispatch" \| "workbench_delivery" \| "building_supply"` |
| `StarterDroneState` | Runtime state of a drone: position, status, cargo, task, hub |
| `DroneRole` | `"auto" \| "construction" \| "supply"` — biased scoring, no hard filter |
| `DroneStatus` | FSM states: `idle`, `moving_to_collect`, `collecting`, `moving_to_dropoff`, … |
| `ServiceHubEntry` | Per hub: inventory, target stock, tier, assigned drones |
| `HubTier` | `1 \| 2` — proto hub vs service hub |
| `ConstructionSite` | Outstanding resource debt: `{ buildingType, remaining }` |
| `ProductionZone` | Groups warehouses + crafting buildings into a local pool |
| `CraftingSource` | Where crafting reads/writes: `"global" \| "warehouse" \| "zone"` |
| `UIPanel` | Which side panel is open (`"warehouse"`, `"smithy"`, … or `null`) |
| `MachinePriority` | `1..5` — energy-scheduling priority (`1` high, `5` low) |
| `AutoSmelterEntry` | Per-smelter belt processing: input buffer, processing, pending output, status |
| `GeneratorState` | Fuel slot + burn progress + drone refill counter |
| `GameNotification` | Transient HUD notification: resource, displayName, amount, expiry |

---

## ⚙️ Crafting

**Source:** [`crafting/types.ts`](./crafting/types.ts)

| Type | Description |
|------|-------------|
| `CraftingJob` | Snapshot-style job: frozen recipe, status, progress, source, reservation owner |
| `JobStatus` | `"queued" \| "reserved" \| "crafting" \| "delivering" \| "done" \| "cancelled"` |
| `JobPriority` | `"high" \| "normal" \| "low"` |
| `JobSource` | `"player" \| "automation"` |
| `CraftingQueueState` | `state.crafting` slice: `{ jobs, nextJobSeq, lastError }` |
| `CraftingInventorySource` | Physical stock scope: global / warehouse / zone (with `warehouseIds`) |
| `CraftingErrorKind` | Error codes: `UNKNOWN_RECIPE`, `UNKNOWN_WORKBENCH`, `INVALID_TRANSITION`, … |
| `RecipeId` | `string` alias |
| `JobId` | `string` alias |

---

## 📦 Items

**Source:** [`items/types.ts`](./items/types.ts)

| Type | Description |
|------|-------------|
| `ItemId` | Union of all item IDs: raw, material, intermediate, buildable, tool, seed |
| `ItemCategory` | `"raw_resource" \| "material" \| "intermediate" \| "buildable" \| "seed" \| "player_gear"` |
| `ItemDef` | Static metadata: displayName, category, stackSize, hotbar eligibility |
| `ItemStack` | `{ itemId: ItemId, count: number }` |
| `WarehouseId` | `string` alias — asset ID of a warehouse |
| `NetworkStockView` | Read-only snapshot of aggregated warehouse totals |

---

## 🔒 Inventory / Reservations

**Source:** [`inventory/reservationTypes.ts`](./inventory/reservationTypes.ts)

| Type | Description |
|------|-------------|
| `Reservation` | Active hold: item, amount, ownerKind, ownerId, optional scope key |
| `ReservationOwnerKind` | `"crafting_job" \| "system_request"` |
| `ReservationId` | `string` alias |
| `NetworkSlice` | `state.network`: `{ reservations, nextReservationId, lastError }` |
| `NetworkErrorKind` | `"INSUFFICIENT_STOCK" \| "UNKNOWN_RESERVATION" \| "EMPTY_BATCH"` |
| `MissingItem` | Per-item shortfall for a failed batch: requested vs available |

---

## 🚁 Drones

**Sources:** [`drones/candidates/types.ts`](./drones/candidates/types.ts), [`drones/candidates/candidate-builder.ts`](./drones/candidates/candidate-builder.ts)

| Type | Source | Description |
|------|--------|-------------|
| `DroneSelectionCandidate` | `candidates/types.ts` | Scored task option: taskType, nodeId, deliveryTargetId, score, bonus breakdown |
| `CandidateBonuses` | `candidates/candidate-builder.ts` | Optional: role, sticky, urgency, demand, spread |

Drone FSM and role types live in [`store/types.ts`](./store/types.ts) — see above.

---

## Cross-Domain Dependencies

```
items/types.ts
  ↑ imported by: store/types.ts, crafting/types.ts, inventory/reservationTypes.ts

inventory/reservationTypes.ts
  ↑ imported by: store/types.ts (as NetworkSlice), store/game-actions.ts (as NetworkAction)

crafting/types.ts
  ↑ imported by: store/types.ts (as CraftingQueueState), store/game-actions.ts (as CraftingAction)

store/types.ts
  ↑ imported by: drones/candidates/*.ts, action-handlers/**
```

In the verified excerpt, no circular type dependencies exist between these modules.

---

## Type Conventions

- **String aliases for IDs:** `RecipeId`, `JobId`, `WarehouseId`, `ReservationId` — all are pure `string` aliases for readability, with no branding.
- **Discriminated unions** with string-literal discriminators: `JobStatus`, `DroneStatus`, `CraftingInventorySource`, `GameAction["type"]`.
- **Slice types** are exported separately (`CraftingQueueState`, `NetworkSlice`) and composed into `GameState` — not defined inline.
- **Owner convention:** reservation owners for crafting jobs use `ownerKey === jobId`.
- **Frozen recipe pattern:** `CraftingJob` contains a frozen recipe snapshot — recipe edits do not change running jobs.

---

## Type Checklists

### Add a new drone task type

1. [`store/types.ts`](./store/types.ts) — add a value to the `DroneTaskType` union.
2. Create a new `*-candidates.ts` file under [`drones/candidates/`](./drones/candidates/).
3. [`drones/candidates/scoring/scoring-constants.ts`](./drones/candidates/scoring/scoring-constants.ts) — scoring weights.
4. [`drones/selection/select-drone-task-bindings.ts`](./drones/selection/select-drone-task-bindings.ts) — register the binding.

### Add a new action type

1. [`store/game-actions.ts`](./store/game-actions.ts) — add a discriminated-union branch.
2. Select or create a cluster handler under [`store/action-handlers/`](./store/action-handlers/); extend the `HANDLED_ACTION_TYPES` set.
3. If tick-driven: register the `setInterval` in [`entry/use-game-ticks.ts`](./entry/use-game-ticks.ts).

### New `GameState` slice field

1. Add the field to `GameState` in [`store/types.ts`](./store/types.ts).
2. Initial value in [`store/initial-state.ts`](./store/initial-state.ts).
3. Save migration in [`simulation/save-migrations.ts`](./simulation/save-migrations.ts) for existing saves.
4. Document persistence status in `ARCHITECTURE.md` §State Map.

---

## References

- [/SYSTEM_REGISTRY.md](../../SYSTEM_REGISTRY.md) — system routing, paths, change recipes.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — runtime flow, state map with persistence, architecture decisions.
