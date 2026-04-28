# Factory Island — Type Index

Quick reference for AI prompting. Each domain lists the canonical source file and the types most commonly needed in that domain's context.

---

## 🏗️ Store & Core State

**Source:** `store/types.ts`

| Type | Description |
|------|-------------|
| `GameState` | Root state object — all runtime game data (assets, inventory, drones, crafting, energy, UI) |
| `PlacedAsset` | A building or resource node on the grid: `{ id, type, x, y, size, direction?, priority?, boosted? }` |
| `AssetType` | Union of all grid entities: trees, buildings, conveyors, service hubs, etc. |
| `BuildingType` | Subset of `AssetType` — only player-placeable buildings |
| `Inventory` | `{ coins: number } & Record<ItemId, number>` — the global or per-warehouse resource pool |
| `Direction` | `"north" \| "east" \| "south" \| "west"` — conveyor / building facing |
| `GameMode` | `"release" \| "debug"` — controls infinite-warehouse and drop-rate overrides |
| `CollectableItemType` | `"wood" \| "stone" \| "iron" \| "copper"` — items drones can physically pick up |
| `CollectionNode` | A world-dropped resource pile awaiting drone pickup: tile position + claim status |
| `DroneTaskType` | `"construction_supply" \| "hub_restock" \| "hub_dispatch" \| "workbench_delivery" \| "building_supply"` |
| `StarterDroneState` | Full runtime state for one drone: position, status, cargo, task, hub assignment |
| `DroneRole` | `"auto" \| "construction" \| "supply"` — biases task scoring, never blocks fallback |
| `DroneStatus` | Drone FSM states: `"idle"`, `"moving_to_collect"`, `"collecting"`, `"moving_to_dropoff"`, etc. |
| `ServiceHubEntry` | Per-hub runtime state: inventory, target stock, tier, assigned drone IDs |
| `HubTier` | `1 \| 2` — Proto-Hub vs upgraded Service-Hub |
| `ConstructionSite` | Outstanding resource debt for a building being built: `{ buildingType, remaining }` |
| `ProductionZone` | Groups warehouses + crafting buildings into a shared local resource pool |
| `CraftingSource` | Where a crafting device reads/writes: `"global" \| "warehouse" \| "zone"` |
| `UIPanel` | Which side-panel is open (`"warehouse"`, `"smithy"`, `"service_hub"`, … or `null`) |
| `MachinePriority` | `1..5` — energy scheduling priority for consumer machines |
| `AutoSmelterEntry` | Per-smelter belt-processing state: input buffer, processing, pending output, status |
| `GeneratorState` | Fuel slot + burn progress + requested drone-refill counter |
| `GameNotification` | Transient HUD notification: resource, display name, amount, expiry |

---

## ⚙️ Crafting

**Source:** `crafting/types.ts`

| Type | Description |
|------|-------------|
| `CraftingJob` | Snapshot-style job: frozen recipe, status, progress, source, reservation owner |
| `JobStatus` | `"queued" \| "reserved" \| "crafting" \| "delivering" \| "done" \| "cancelled"` |
| `JobPriority` | `"high" \| "normal" \| "low"` — affects queue ordering |
| `JobSource` | `"player" \| "automation"` — who enqueued the job |
| `CraftingQueueState` | The `state.crafting` slice: `{ jobs, nextJobSeq, lastError }` |
| `CraftingInventorySource` | Physical stock scope for a job: global / warehouse / zone (with warehouseIds) |
| `CraftingErrorKind` | Error codes: `UNKNOWN_RECIPE`, `UNKNOWN_WORKBENCH`, `INVALID_TRANSITION`, etc. |
| `RecipeId` | `string` alias — identifies a recipe definition |
| `JobId` | `string` alias — stable unique job identifier |

---

## 📦 Items

**Source:** `items/types.ts`

| Type | Description |
|------|-------------|
| `ItemId` | Union of all item identifiers: raw resources, materials, intermediates, buildables, tools, seeds |
| `ItemCategory` | `"raw_resource" \| "material" \| "intermediate" \| "buildable" \| "seed" \| "player_gear"` |
| `ItemDef` | Static item metadata: display name, category, stack size, hotbar eligibility |
| `ItemStack` | `{ itemId: ItemId, count: number }` — used in recipes, reservations, crafting jobs |
| `WarehouseId` | `string` alias — matches the placed asset ID of a warehouse |
| `NetworkStockView` | Read-only snapshot of aggregated warehouse totals across the network |

---

## 🔒 Inventory / Reservations

**Source:** `inventory/reservationTypes.ts`

| Type | Description |
|------|-------------|
| `Reservation` | An active hold on stock: item, amount, owner kind, owner ID, optional scope key |
| `ReservationOwnerKind` | `"crafting_job" \| "system_request"` |
| `ReservationId` | `string` alias — stable reservation identifier |
| `NetworkSlice` | The `state.network` slice: `{ reservations: Reservation[] }` |
| `NetworkErrorKind` | `"INSUFFICIENT_STOCK" \| "UNKNOWN_RESERVATION" \| "EMPTY_BATCH"` |
| `MissingItem` | Per-item shortfall on a failed batch reservation: requested vs available |

---

## 🚁 Drones

**Candidates:** `drones/candidates/types.ts` and `drones/candidates/candidate-builder.ts`

| Type | Source | Description |
|------|--------|-------------|
| `DroneSelectionCandidate` | `candidates/types.ts` | Scored task option: taskType, nodeId, deliveryTargetId, score, bonus breakdown |
| `CandidateBonuses` | `candidates/candidate-builder.ts` | Optional bonus components passed to `buildScoredCandidate`: role, sticky, urgency, demand, spread |

> **To add a new drone task type:** `store/types.ts` (add to `DroneTaskType`) → new `*-candidates.ts` file → `candidates/scoring/scoring-constants.ts` → `selection/select-drone-task-bindings.ts`

---

## 🔗 Cross-Domain Dependencies

```
items/types.ts
  ↑ imported by: store/types.ts, crafting/types.ts, inventory/reservationTypes.ts

inventory/reservationTypes.ts
  ↑ imported by: store/types.ts (as NetworkSlice), crafting/types.ts (as WarehouseId)

crafting/types.ts
  ↑ imported by: store/types.ts (as CraftingQueueState)

store/types.ts
  ↑ imported by: drones/candidates/*.ts, action-handlers/**
```

No circular type dependencies exist between these modules.
