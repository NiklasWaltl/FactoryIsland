# Factory Island — Type Index

> Domänen-Typwissen. Quick reference für AI-Prompting.
> **Stand:** verifiziert 2026-05-01.

---

## Wann lese ich diese Datei?

- Du brauchst die **Typsignatur** eines Domain-Konzepts (Job, Drone, Reservation, Asset).
- Du willst wissen, **welche Typen zwischen Domänen geteilt** werden (Cross-Domain).
- Du fügst einen **neuen Typ** hinzu und brauchst die Konventionen + Checkliste.

## Was finde ich hier nicht?

- **Welche Datei ist für X zuständig?** → [/SYSTEM_REGISTRY.md](../../SYSTEM_REGISTRY.md).
- **Wie laufen Ticks / Dispatches / Datenfluss?** → [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Reading Order

1. Diese Übersicht lesen, betroffene Domain identifizieren.
2. Quelldatei der Domain öffnen (Spalte "Source").
3. Bei Cross-Domain-Änderung: §"Cross-Domain Dependencies" am Ende prüfen.

---

## Domänenübersicht

| Domain | Source | Inhalt |
|---|---|---|
| Store & Core State | [`store/types.ts`](./store/types.ts) | `GameState` + alle Slice-Typen |
| Crafting | [`crafting/types.ts`](./crafting/types.ts) | Job-Lifecycle-Typen |
| Items | [`items/types.ts`](./items/types.ts) | Item-IDs, Kategorien, Stacks |
| Inventory / Reservations | [`inventory/reservationTypes.ts`](./inventory/reservationTypes.ts) | Reservation-Typen, Network-Slice |
| Drones | [`drones/candidates/types.ts`](./drones/candidates/types.ts), [`drones/candidates/candidate-builder.ts`](./drones/candidates/candidate-builder.ts) | Task-Auswahl-Typen |
| Game Actions | [`store/game-actions.ts`](./store/game-actions.ts) | `GameAction`-Union |

---

## 🏗️ Store & Core State

**Source:** [`store/types.ts`](./store/types.ts)

| Type | Description |
|------|-------------|
| `GameState` | Root state object — alle Runtime-Daten (assets, inventory, drones, crafting, energy, UI) |
| `PlacedAsset` | Building oder Resource-Node auf dem Grid: `{ id, type, x, y, size, direction?, priority?, boosted? }` |
| `AssetType` | Union aller Grid-Entities: trees, buildings, conveyors, service hubs, etc. |
| `BuildingType` | Subset von `AssetType` — nur Player-platzierbare Buildings |
| `Inventory` | `{ coins: number } & Record<ItemId, number>` — globaler oder per-Warehouse-Pool |
| `Direction` | `"north" \| "east" \| "south" \| "west"` |
| `GameMode` | `"release" \| "debug"` — steuert Infinite-Warehouse + Drop-Rate-Overrides |
| `CollectableItemType` | `"wood" \| "stone" \| "iron" \| "copper"` — physikalisch von Drones aufnehmbar |
| `CollectionNode` | World-dropped Resource-Pile mit Tile + Claim-Status |
| `DroneTaskType` | `"construction_supply" \| "hub_restock" \| "hub_dispatch" \| "workbench_delivery" \| "building_supply"` |
| `StarterDroneState` | Runtime-State eines Drones: position, status, cargo, task, hub |
| `DroneRole` | `"auto" \| "construction" \| "supply"` — biased Scoring, kein Hard-Filter |
| `DroneStatus` | FSM-States: `idle`, `moving_to_collect`, `collecting`, `moving_to_dropoff`, … |
| `ServiceHubEntry` | Per-Hub: inventory, target stock, tier, assigned drones |
| `HubTier` | `1 \| 2` — Proto-Hub vs Service-Hub |
| `ConstructionSite` | Outstanding Resource-Schuld: `{ buildingType, remaining }` |
| `ProductionZone` | Gruppiert Warehouses + Crafting-Buildings zu lokalem Pool |
| `CraftingSource` | Wo Crafting liest/schreibt: `"global" \| "warehouse" \| "zone"` |
| `UIPanel` | Welches Side-Panel offen ist (`"warehouse"`, `"smithy"`, … oder `null`) |
| `MachinePriority` | `1..5` — Energy-Scheduling-Priorität (`1` hoch, `5` niedrig) |
| `AutoSmelterEntry` | Per-Smelter Belt-Processing: input buffer, processing, pending output, status |
| `GeneratorState` | Fuel-Slot + Burn-Progress + Drone-Refill-Counter |
| `GameNotification` | Transient HUD-Notification: resource, displayName, amount, expiry |

---

## ⚙️ Crafting

**Source:** [`crafting/types.ts`](./crafting/types.ts)

| Type | Description |
|------|-------------|
| `CraftingJob` | Snapshot-Style Job: frozen recipe, status, progress, source, reservation owner |
| `JobStatus` | `"queued" \| "reserved" \| "crafting" \| "delivering" \| "done" \| "cancelled"` |
| `JobPriority` | `"high" \| "normal" \| "low"` |
| `JobSource` | `"player" \| "automation"` |
| `CraftingQueueState` | `state.crafting` slice: `{ jobs, nextJobSeq, lastError }` |
| `CraftingInventorySource` | Physical Stock-Scope: global / warehouse / zone (mit `warehouseIds`) |
| `CraftingErrorKind` | Error-Codes: `UNKNOWN_RECIPE`, `UNKNOWN_WORKBENCH`, `INVALID_TRANSITION`, … |
| `RecipeId` | `string` alias |
| `JobId` | `string` alias |

---

## 📦 Items

**Source:** [`items/types.ts`](./items/types.ts)

| Type | Description |
|------|-------------|
| `ItemId` | Union aller Item-IDs: raw, material, intermediate, buildable, tool, seed |
| `ItemCategory` | `"raw_resource" \| "material" \| "intermediate" \| "buildable" \| "seed" \| "player_gear"` |
| `ItemDef` | Statische Metadata: displayName, category, stackSize, hotbar-Eligibility |
| `ItemStack` | `{ itemId: ItemId, count: number }` |
| `WarehouseId` | `string` alias — Asset-ID eines Warehouses |
| `NetworkStockView` | Read-only Snapshot aggregierter Warehouse-Totals |

---

## 🔒 Inventory / Reservations

**Source:** [`inventory/reservationTypes.ts`](./inventory/reservationTypes.ts)

| Type | Description |
|------|-------------|
| `Reservation` | Active Hold: item, amount, ownerKind, ownerId, optionaler Scope-Key |
| `ReservationOwnerKind` | `"crafting_job" \| "system_request"` |
| `ReservationId` | `string` alias |
| `NetworkSlice` | `state.network`: `{ reservations, nextReservationId, lastError }` |
| `NetworkErrorKind` | `"INSUFFICIENT_STOCK" \| "UNKNOWN_RESERVATION" \| "EMPTY_BATCH"` |
| `MissingItem` | Per-Item Shortfall auf failed Batch: requested vs available |

---

## 🚁 Drones

**Sources:** [`drones/candidates/types.ts`](./drones/candidates/types.ts), [`drones/candidates/candidate-builder.ts`](./drones/candidates/candidate-builder.ts)

| Type | Source | Description |
|------|--------|-------------|
| `DroneSelectionCandidate` | `candidates/types.ts` | Scored Task-Option: taskType, nodeId, deliveryTargetId, score, bonus-Breakdown |
| `CandidateBonuses` | `candidates/candidate-builder.ts` | Optional: role, sticky, urgency, demand, spread |

Drone-FSM- und Role-Typen leben in [`store/types.ts`](./store/types.ts) — siehe oben.

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

Im geprüften Ausschnitt existieren keine zirkulären Typ-Abhängigkeiten zwischen diesen Modulen.

---

## Typ-Konventionen

- **String-Aliases für IDs:** `RecipeId`, `JobId`, `WarehouseId`, `ReservationId` — alle reine `string`-Aliasse für Lesbarkeit, kein Branding.
- **Diskriminierte Unions** mit String-Literal-Discriminator: `JobStatus`, `DroneStatus`, `CraftingInventorySource`, `GameAction["type"]`.
- **Slice-Typen** sind separat exportiert (`CraftingQueueState`, `NetworkSlice`) und werden in `GameState` kompositioniert — nicht inline definiert.
- **Owner-Konvention:** Reservation-Owner für Crafting-Jobs verwenden `ownerKey === jobId`.
- **Frozen-Recipe-Pattern:** `CraftingJob` enthält ein eingefrorenes Snapshot-Recipe — Recipe-Edits ändern keine laufenden Jobs.

---

## Typ-Checklisten

### Neuen Drone-Task-Typ hinzufügen

1. [`store/types.ts`](./store/types.ts) — Wert zur `DroneTaskType`-Union ergänzen.
2. Neue `*-candidates.ts`-Datei unter [`drones/candidates/`](./drones/candidates/) anlegen.
3. [`drones/candidates/scoring/scoring-constants.ts`](./drones/candidates/scoring/scoring-constants.ts) — Scoring-Gewichte.
4. [`drones/selection/select-drone-task-bindings.ts`](./drones/selection/select-drone-task-bindings.ts) — Binding registrieren.

### Neuen Action-Typ hinzufügen

1. [`store/game-actions.ts`](./store/game-actions.ts) — Discriminated-Union-Branch ergänzen.
2. Cluster-Handler unter [`store/action-handlers/`](./store/action-handlers/) wählen oder anlegen; `HANDLED_ACTION_TYPES`-Set erweitern.
3. Falls Tick-getrieben: `setInterval` in [`entry/use-game-ticks.ts`](./entry/use-game-ticks.ts) registrieren.

### Neues `GameState`-Slice-Feld

1. Feld zu `GameState` in [`store/types.ts`](./store/types.ts) hinzufügen.
2. Initial-Wert in [`store/initial-state.ts`](./store/initial-state.ts).
3. Save-Migration in [`simulation/save-migrations.ts`](./simulation/save-migrations.ts) für Bestandsspeicher.
4. Persistenz-Status in `ARCHITECTURE.md` §State Map dokumentieren.

---

## Verweise

- [/SYSTEM_REGISTRY.md](../../SYSTEM_REGISTRY.md) — System-Routing, Pfade, Änderungsrezepte.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Runtime-Flow, State-Map mit Persistenz, Architekturentscheidungen.
