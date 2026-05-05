# Factory Island — Type Index

> **Scope:** Domain-Index für persistierte State-Typen, Core-Interfaces und
> Public-API-Typen in `src/game/**`. Bewusst ausgeschlossen: lokale
> React-Props, interne Action-Handler-Deps, Test-Helfertypen und
> generierte `.d.ts`-Deklarationen.
> UI-only Slice-Typen aus [`store/types/ui-slice-types.ts`](./store/types/ui-slice-types.ts)
> sind in diesem Index bewusst out-of-scope.

> Domain type knowledge. Quick reference for AI prompting.
> **Last verified:** 2026-05-04.

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
| Drones | [`store/types/drone-types.ts`](./store/types/drone-types.ts), [`drones/candidates/types.ts`](./drones/candidates/types.ts), [`drones/candidates/candidate-builder.ts`](./drones/candidates/candidate-builder.ts) | drone FSM, role, task-selection types |
| Game Actions | [`store/game-actions.ts`](./store/game-actions.ts) | `GameAction` union type |

---

## 🏗️ Store & Core State

**Sources:** [`store/types.ts`](./store/types.ts), [`store/types/drone-types.ts`](./store/types/drone-types.ts), [`store/types/crafting-types.ts`](./store/types/crafting-types.ts), [`store/types/conveyor-types.ts`](./store/types/conveyor-types.ts), [`store/types/module-state.ts`](./store/types/module-state.ts), [`store/types/power-state.ts`](./store/types/power-state.ts), [`store/types/zone-source-state.ts`](./store/types/zone-source-state.ts)

| Type | Description |
|------|-------------|
| `GameState` | Root state object — all runtime data (assets, inventory, drones, crafting, energy, UI), including `tileMap`, `moduleInventory`, `moduleFragments`, `moduleLabJob`, `autoAssemblers`, `conveyorUndergroundPeers`, `splitterRouteState`, `splitterFilterState`, `ship`, `selectedAutoAssemblerId`, `selectedSplitterId` |
| `PlacedAsset` | Building or resource node on the grid: `{ id, type, x, y, size, width?, height?, fixed?, direction?, priority?, boosted?, moduleSlot?, isDockWarehouse?, status?, deconstructRequestSeq? }` |
| `AssetStatus` | Runtime marker for asset lifecycle states: `"deconstructing"` |
| `AssetType` | Union of all grid entities: trees, buildings, conveyors, service hubs, etc. |
| `BuildingType` | Subset of `AssetType` — buildable/managed building asset subset; includes fixed/special buildings such as `dock_warehouse` |
| `FloorTileType` | Placeable floor layer union: `"stone_floor" \| "grass_block"` |
| `Inventory` | `{ coins: number } & Record<ItemId, number>` — global or per-warehouse pool |
| `ToolKind` | Hotbar tool/build selector union: `"axe" \| "wood_pickaxe" \| "stone_pickaxe" \| "sapling" \| "building" \| "empty"` |
| `HotbarSlot` | Hotbar entry: `{ toolKind, buildingType?, amount, label, emoji }` |
| `Direction` | `"north" \| "east" \| "south" \| "west"` |
| `GameMode` | `"release" \| "debug"` — controls infinite warehouse + drop-rate overrides |
| `CollectableItemType` | `"wood" \| "stone" \| "iron" \| "copper"` — physically collectable by drones |
| `CollectionNode` | World-dropped resource pile with `itemType`, `amount`, `tileX`, `tileY`, `collectable`, `createdAt`, and `reservedByDroneId: string \| null` |
| `DroneTaskType` | `"construction_supply" \| "hub_restock" \| "hub_dispatch" \| "workbench_delivery" \| "building_supply" \| "deconstruct"` |
| `StarterDroneState` | Runtime state of a drone: `{ status, tileX, tileY, targetNodeId, cargo, ticksRemaining, hubId, currentTaskType, deliveryTargetId, craftingJobId, droneId, role?, deconstructRefund? }` |
| `DroneRole` | `"auto" \| "construction" \| "supply"` — biased scoring, no hard filter |
| `DroneStatus` | `idle` \| `moving_to_collect` \| `collecting` \| `moving_to_dropoff` \| `depositing` \| `returning_to_dock` |
| `ServiceHubInventory` | Hub-local stock map: `Record<CollectableItemType, number>` |
| `ServiceHubEntry` | Per hub: inventory, target stock, tier, assigned drones, optional `pendingUpgrade?` |
| `HubTier` | `1 \| 2` — proto hub vs service hub |
| `ConstructionSite` | Outstanding resource debt: `{ buildingType, remaining }` |
| `ProductionZone` | Zone metadata `{ id, name }`; membership is stored in `GameState.buildingZoneIds` |
| `CraftingSource` | Object union: `{ kind: "global" } \| { kind: "warehouse"; warehouseId: string } \| { kind: "zone"; zoneId: string }` |
| `WorkbenchSource` | `@deprecated` alias on `CraftingSource` for backward compatibility |
| `KeepStockTargetEntry` | Keep-stock target entry per recipe: `{ enabled, amount }` |
| `KeepStockByWorkbench` | Keep-stock map: `Record<workbenchId, Record<recipeId, KeepStockTargetEntry>>` |
| `UIPanel` | Which side panel is open: `"map_shop"`, `"warehouse"`, `"smithy"`, `"workbench"`, `"generator"`, `"battery"`, `"power_pole"`, `"auto_miner"`, `"auto_smelter"`, `"auto_assembler"`, `"manual_assembler"`, `"service_hub"`, `"conveyor_splitter"`, `"dock_warehouse"`, `"fragment_trader"`, `"module_lab"`, or `null` |
| `MachinePriority` | `1..5` — energy-scheduling priority (`1` high, `5` low) |
| `AutoMinerEntry` | Per-auto-miner production entry: `{ depositId, resource, progress }` |
| `AutoSmelterEntry` | Per-smelter belt processing: input buffer, processing, pending output, status, `lastRecipeInput`, `lastRecipeOutput`, `throughputEvents`, `selectedRecipe` |
| `SmithyState` | Smithy runtime state: fuel/input slots, selected recipe, processing/progress, outputs, and `buildingId` |
| `ManualAssemblerState` | Manual assembler runtime state: `{ processing, recipe, progress, buildingId }` |
| `BatteryState` | Battery energy state: `{ stored, capacity }` |
| `GeneratorState` | Fuel slot + burn progress, `running: boolean`, optional drone refill counter `requestedRefill?: number` |
| `AutoDeliveryEntry` | Auto-delivery log entry: `{ id, sourceType, sourceId, resource, amount, warehouseId, timestamp }` |
| `GameNotification` | Transient HUD notification: `id`, resource, displayName, amount, `expiresAt`, optional `kind?` |

### ModuleState

Exported from [`store/types/module-state.ts`](./store/types/module-state.ts).
Fields: `moduleInventory`, `moduleFragments`, `moduleLabJob`.
Central in `GameState` via `moduleInventory`, `moduleFragments`, and `moduleLabJob`.

### PowerState

Exported from [`store/types/power-state.ts`](./store/types/power-state.ts).
Aggregates battery/generator state and power-network fields (`connectedAssetIds`,
`poweredMachineIds`, `machinePowerRatio`, `energyDebugOverlay`, `cablesPlaced`,
`powerPolesPlaced`).
Referenced by `GameState` field types across the energy slice.

### ZoneSourceState

Exported from [`store/types/zone-source-state.ts`](./store/types/zone-source-state.ts).
Holds the zone/source assignment map around `ProductionZone` via
`buildingSourceWarehouseIds`, `productionZones`, and `buildingZoneIds`.
Referenced by `GameState` for building-to-warehouse and building-to-zone relations.

---

## ⚙️ Crafting

**Source:** [`crafting/types.ts`](./crafting/types.ts)

| Type | Description |
|------|-------------|
| `CraftingJob` | Snapshot-style job: frozen recipe, `inventorySource`, optional `inputBuffer?`, `workbenchId`, status, priority, source, `enqueuedAt`, `startedAt`, `finishesAt`, progress, `ingredients`, `output`, `processingTime`, reservation owner |
| `JobStatus` | `"queued" \| "reserved" \| "crafting" \| "delivering" \| "done" \| "cancelled"` |
| `JobPriority` | `"high" \| "normal" \| "low"` |
| `JobSource` | `"player" \| "automation"` |
| `CraftingQueueState` | `state.crafting` slice: `{ jobs, nextJobSeq, lastError }` |
| `CraftingInventorySource` | Physical stock scope: global / warehouse / zone (with `warehouseIds`) |
| `CraftingErrorKind` | `UNKNOWN_RECIPE` \| `UNKNOWN_WORKBENCH` \| `UNKNOWN_JOB` \| `INVALID_TRANSITION` \| `INVALID_OUTPUT_ITEM` |
| `RecipeId` | `string` alias |
| `JobId` | `string` alias |

---

## 📦 Items

**Source:** [`items/types.ts`](./items/types.ts)

| Type | Description |
|------|-------------|
| `ItemId` | Union of all item IDs: raw, material, intermediate, buildable, tool, seed |
| `ItemCategory` | `"raw_resource" \| "material" \| "intermediate" \| "buildable" \| "seed" \| "player_gear"` |
| `ItemDef` | Static metadata: `id`, displayName, category, stackSize, hotbar eligibility, optional `iconKey?`, `tags?`, `sortGroup?` |
| `ItemStack` | `{ itemId: ItemId, count: number }` |
| `WarehouseId` | `string` alias — asset ID of a warehouse |
| `NetworkStockView` | Read-only snapshot of aggregated warehouse totals |

---

## 🔒 Inventory / Reservations

**Source:** [`inventory/reservationTypes.ts`](./inventory/reservationTypes.ts)

| Type | Description |
|------|-------------|
| `Reservation` | Active hold: `id`, `itemId`, amount, ownerKind, ownerId, optional scope key, `createdAt` |
| `ReservationOwnerKind` | `"crafting_job" \| "system_request"` |
| `ReservationId` | `string` alias |
| `NetworkSlice` | `state.network`: `{ reservations, nextReservationId, lastError }` |
| `NetworkErrorKind` | `"INSUFFICIENT_STOCK" \| "UNKNOWN_RESERVATION" \| "EMPTY_BATCH"` |
| `MissingItem` | Per-item shortfall for a failed batch: requested vs available |

---

## 🚁 Drones

**Sources:** [`store/types/drone-types.ts`](./store/types/drone-types.ts), [`drones/candidates/types.ts`](./drones/candidates/types.ts), [`drones/candidates/candidate-builder.ts`](./drones/candidates/candidate-builder.ts)

| Type | Source | Description |
|------|--------|-------------|
| `DroneRole` | `store/types/drone-types.ts` | `"auto" \| "construction" \| "supply"` — biased scoring, no hard filter |
| `DroneStatus` | `store/types/drone-types.ts` | `idle` \| `moving_to_collect` \| `collecting` \| `moving_to_dropoff` \| `depositing` \| `returning_to_dock` |
| `DroneCargoItem` | `store/types/drone-types.ts` | Drone cargo payload: `{ itemType: CollectableItemType, amount }` |
| `StarterDroneState` | `store/types/drone-types.ts` | Runtime state of a drone: `status`, `tileX`, `tileY`, `targetNodeId`, `cargo`, `ticksRemaining`, `hubId`, `currentTaskType`, `deliveryTargetId`, `craftingJobId`, `droneId`, optional `role?`, optional `deconstructRefund?` |
| `DroneTaskType` | `store/types/drone-types.ts` | `"construction_supply" \| "hub_restock" \| "hub_dispatch" \| "workbench_delivery" \| "building_supply" \| "deconstruct"` |
| `DroneSelectionCandidate` | `candidates/types.ts` | Scored task option: taskType, nodeId, deliveryTargetId, score, bonus breakdown |
| `CandidateBonuses` | `candidates/candidate-builder.ts` | Optional: role, sticky, urgency, demand, spread |
| `CandidateMetadata` | `candidates/candidate-builder.ts` | Optional candidate metadata passed into score construction (currently `deconstructRequestSeq?`) |

`StarterDroneState` schema:

```ts
interface StarterDroneState {
  status: DroneStatus;
  tileX: number;
  tileY: number;
  targetNodeId: string | null;
  cargo: DroneCargoItem | null;
  ticksRemaining: number;
  hubId: string | null;
  currentTaskType: DroneTaskType | null;
  deliveryTargetId: string | null;
  craftingJobId: string | null;
  droneId: string;
  role?: DroneRole;
  deconstructRefund?: Partial<Record<CollectableItemType, number>> | null;
}
```

Drone FSM and role types live in [`store/types/drone-types.ts`](./store/types/drone-types.ts) and are re-exported from [`store/types.ts`](./store/types.ts).

---

## 🎮 Game Actions

**Source:** [`store/game-actions.ts`](./store/game-actions.ts)

| Type | Description |
|------|-------------|
| `GameAction` | Root discriminated union of reducer actions (UI/building/machine ticks, logistics/drone/ship/module actions) and embedded `NetworkAction` + `CraftingAction` branches |

---

## 🚢 Ship / Dock

**Source:** [`store/types/ship-types.ts`](./store/types/ship-types.ts)

| Type | Description |
|------|-------------|
| `RewardType` | `coins` \| `basic_resource` \| `rare_resource` \| `module_fragment` \| `complete_module` |
| `ShipStatus` | `sailing` \| `docked` \| `departing` |
| `ShipQuest` | Requested item, amount, label and phase |
| `ShipReward` | Reward kind, item id, amount, label, multiplier |
| `ShipState` | Persisted ship quest loop state (status, quests, timestamps, reward history, pity counters) |

---

## 🧩 Modules / Module Lab

**Sources:** [`modules/module.types.ts`](./modules/module.types.ts), [`constants/moduleLabConstants.ts`](./constants/moduleLabConstants.ts), [`store/types.ts`](./store/types.ts)

| Type | Description |
|------|-------------|
| `ModuleType` | `miner-boost` \| `smelter-boost` |
| `Module` | Owned module with `id`, `type`, `tier`, and mandatory `equippedTo: string \| null` (nicht optional) |
| `ModuleLabRecipe` | Static recipe definition for module lab |
| `ModuleLabJob` | In-flight module crafting job (persisted in GameState) |
| `ModuleFragmentCount` | Numeric unspent fragment count |

---

## 🔁 Conveyor / Auto Machines

**Source:** [`store/types/conveyor-types.ts`](./store/types/conveyor-types.ts)

| Type | Description |
|------|-------------|
| `ConveyorItem` | Belt-transportable item union |
| `ConveyorState` | Per-conveyor item queue |
| `AutoSmelterStatus` | `IDLE` \| `PROCESSING` \| `OUTPUT_BLOCKED` \| `NO_POWER` \| `MISCONFIGURED` |
| `AutoSmelterProcessing` | Active smelter processing payload |
| `AutoSmelterEntry` | Full smelter state including buffers, recipe tracking, throughput |
| `AutoAssemblerStatus` | `IDLE` \| `PROCESSING` \| `OUTPUT_BLOCKED` \| `NO_POWER` \| `MISCONFIGURED` |
| `AutoAssemblerRecipeId` | `metal_plate` \| `gear` |
| `AutoAssemblerEntry` | Full assembler state |

---

## ⚙️ Crafting – Extended Types

**Source:** [`crafting/types.ts`](./crafting/types.ts)

| Type | Description |
|------|-------------|
| `WorkbenchId` | String alias |
| `CraftingError` | Error payload with kind, message, optional job/recipe/workbench ids |
| `CraftingAction` | Discriminated union for `JOB_*` actions plus `CRAFT_REQUEST_WITH_PREREQUISITES` |

### Recipe Automation Policies

**Sources:** [`crafting/policies/policies.ts`](./crafting/policies/policies.ts), [`store/types.ts`](./store/types.ts)

`RecipeAutomationPolicyEntry` (`policies.ts`): per-recipe policy entry
(`autoCraftAllowed?`, `keepInStockAllowed?`, `manualOnly?`).

`RecipeAutomationPolicyMap`: map of recipe id to `RecipeAutomationPolicyEntry`;
used in `GameState.recipeAutomationPolicies` and re-exported via `store/types.ts`.

---

## 🔒 Inventory / Reservations – Extended

**Source:** [`inventory/reservationTypes.ts`](./inventory/reservationTypes.ts)

| Type | Description |
|------|-------------|
| `NetworkError` | Error payload with message, optional missing items or reservation id |
| `ReserveBatchResult` | Success with reservations or failure with NetworkError |
| `NetworkAction` | Discriminated union for reserve, commit, cancel |

---

## 🧪 Recipes

**Source:** [`simulation/recipes/`](./simulation/recipes/)

| Type | Description |
|------|-------------|
| `WorkbenchRecipe` | Workbench recipe schema |
| `SmeltingRecipe` | Smelting recipe schema |
| `ManualAssemblerRecipeKey` / `ManualAssemblerRecipe` | Manual assembler key/schema |
| `AutoAssemblerV1Recipe` | V1 auto-assembler recipe schema |

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

store/types/drone-types.ts
  ↑ imported by: store/types.ts, drones/candidates/types.ts
```

Current state: no direct cycle between `store/types.ts` and
`store/types/drone-types.ts` for `CollectableItemType`.
Both files import `CollectableItemType` from `store/types/item-types.ts`,
which keeps this dependency edge flat and acyclic.

---

## Type Conventions

- **String aliases for IDs:** `RecipeId`, `JobId`, `WarehouseId`, `ReservationId` — all are pure `string` aliases for readability, with no branding.
- **Discriminated unions** with string-literal discriminators: `JobStatus`, `DroneStatus`, `CraftingInventorySource`, `GameAction["type"]`.
- **Slice types** are exported separately (`CraftingQueueState`, `NetworkSlice`) and composed into `GameState` — not defined inline.
- **Owner convention:** reservation owners for crafting jobs use `reservationOwnerId === jobId`; reservation entries store the same value as `ownerId`.
- **Frozen recipe pattern:** `CraftingJob` contains a frozen recipe snapshot — recipe edits do not change running jobs.

---

## Type Checklists

### Add a new drone task type

1. [`store/types/drone-types.ts`](./store/types/drone-types.ts) — add a value to the `DroneTaskType` union.
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
