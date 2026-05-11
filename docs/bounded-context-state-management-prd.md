---
title: "Factory Island Bounded Context State Management PRD"
date: 2026-05-10
author: GitHub Copilot
---

## 1. Executive Summary

Factory Island currently routes nearly every state transition through one central action union and one central dispatch chain. This PRD defines a refactor from that monolithic reducer shape into 15 bounded context modules under `src/game/store/contexts/`, each with explicit state ownership, explicit handled action types, and compile-time exhaustive action handling.

The architectural shift is from a single shared hotspot to a composed reducer model: `game-actions.ts` remains the canonical compatibility action surface during migration, while context modules become the owned implementation units for crafting, drones, inventory, warehouse, power, construction, machines, zones, ship, and UI.

Business value is practical for a game codebase: fewer merge conflicts, smaller review surfaces, clearer ownership for feature work, safer action handling, and better room for parallel development without making tick performance worse.

Success criteria: Factory Island state updates are composed from 15 bounded contexts with exhaustive TypeScript handling, all current reducer imports still work, and `tick-phase-stress.test.ts` shows no more than `<= 5ms` or `<= 5%` regression versus the recorded baseline.

## 2. Current State Analysis

Current canonical files:

| Concern                    | Current File                              | Current Role                                                                                                                        |
| -------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Root action union          | `src/game/store/game-actions.ts`          | Owns the `GameAction` discriminated union, including UI, build, machine, crafting, network, drone, ship, module, and debug actions. |
| Reducer dispatch chain     | `src/game/store/game-reducer-dispatch.ts` | Owns the central early-return chain over action-handler clusters and still contains the inline `ENERGY_NET_TICK` case.              |
| Public reducer entry point | `src/game/store/reducer.ts`               | Keeps `gameReducer`, `gameReducerWithInvariants`, `createInitialState`, and public re-exports stable for UI, tests, and tooling.    |

Older non-store path references are stale in the current repository. The current paths under `src/game/store/` are authoritative.

Today, `game-reducer-dispatch.ts` already delegates to several handler clusters, including crafting queue, zones, UI, building placement, machine actions, warehouse/hotbar actions, research, module lab, drones, logistics tick, and ship. That extraction reduced the size of the original reducer, but it did not remove the two central hotspots: the action union and dispatch composition still force coordination across unrelated systems.

Primary pain points:

| Pain Point                          | Current Impact                                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Central action union coupling       | Any new action touches `game-actions.ts`, causing unrelated teams/features to collide in the same file.                                       |
| Central dispatch-chain coordination | Every new handler must be ordered correctly in `game-reducer-dispatch.ts`, even when the domain is otherwise independent.                     |
| Mixed handler conventions           | Some clusters use `HANDLED_ACTION_TYPES`, some switch directly, and some use custom guards. Exhaustiveness is not uniformly enforced.         |
| Logistics bundling                  | Auto-miner, conveyor, auto-smelter, and auto-assembler logic are still phases of one `LOGISTICS_TICK` handler, so ownership is hard to split. |
| Inventory/crafting overlap          | `NETWORK_*` reservation actions currently live inside `crafting-queue-actions`, even though the reservation slice is an inventory concern.    |
| Routing-cache invalidation risk     | Contexts that affect logistics routing must invalidate `routingIndexCache` consistently. Today that rule is spread across handlers.           |
| Test ownership ambiguity            | Reducer tests cover behavior, but the owning system is not always obvious from the action name or test location.                              |
| Parallel development overhead       | Multiple features often need the same action/reducer files, so code review and merge sequencing become bottlenecks.                           |

## 3. Target Architecture

Target architecture introduces `src/game/store/contexts/` as the new reducer ownership boundary. Each bounded context is responsible for a cohesive slice of `GameState`, a typed set of current actions, a documented target action prefix, unit tests, and rollback-isolated implementation.

Important caveat: target prefixes such as `CRAFTING_*`, `INVENTORY_*`, `POWER_*`, and `CONVEYOR_*` do not exist yet. They are target naming conventions for the bounded-context phase, not current repo action names. During migration, current action names and target prefixes must be documented side by side.

### 3.1 Context Map

| Context        | File                                                | State Ownership                                                                                                                                                               | Current Actions                                                                                                                                                                                                     | Target Prefix                                |
| -------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Crafting       | `src/game/store/contexts/crafting-context.ts`       | `crafting`, `keepStockByWorkbench`, `recipeAutomationPolicies`                                                                                                                | `CRAFT_REQUEST_WITH_PREREQUISITES`, `JOB_ENQUEUE`, `JOB_CANCEL`, `JOB_MOVE`, `JOB_SET_PRIORITY`, `JOB_TICK`, `SET_KEEP_STOCK_TARGET`, `SET_RECIPE_AUTOMATION_POLICY`                                                | `CRAFTING_*` and future `crafting.*` aliases |
| Drones         | `src/game/store/contexts/drones-context.ts`         | `drones`; drone-owned task effects touch `collectionNodes`, `constructionSites`, `crafting`, `inventory`, `warehouseInventories`, and `serviceHubs` through integration seams | `DRONE_TICK`, `DRONE_SET_ROLE`, `ASSIGN_DRONE_TO_HUB`                                                                                                                                                               | `DRONE_*` and future `drones.*` aliases      |
| Inventory      | `src/game/store/contexts/inventory-context.ts`      | `inventory`, `network`, and physical-stock commit seams into `warehouseInventories` and `serviceHubs`                                                                         | `NETWORK_RESERVE_BATCH`, `NETWORK_COMMIT_RESERVATION`, `NETWORK_COMMIT_BY_OWNER`, `NETWORK_CANCEL_RESERVATION`, `NETWORK_CANCEL_BY_OWNER`                                                                           | `INVENTORY_*`                                |
| Warehouse      | `src/game/store/contexts/warehouse-context.ts`      | `warehouseInventories`, selected warehouse UI identity, warehouse/hotbar transfer state                                                                                       | `EQUIP_BUILDING_FROM_WAREHOUSE`, `EQUIP_FROM_WAREHOUSE`, `TRANSFER_TO_WAREHOUSE`, `TRANSFER_FROM_WAREHOUSE`, `REMOVE_FROM_HOTBAR`                                                                                   | `WAREHOUSE_*`                                |
| Power          | `src/game/store/contexts/power-context.ts`          | `battery`, `generators`, `connectedAssetIds`, `poweredMachineIds`, `machinePowerRatio`, `cablesPlaced`, `powerPolesPlaced`, `energyDebugOverlay`                              | `GENERATOR_ADD_FUEL`, `GENERATOR_REQUEST_REFILL`, `GENERATOR_START`, `GENERATOR_STOP`, `GENERATOR_TICK`, `ENERGY_NET_TICK`, `REMOVE_POWER_POLE`, `SET_MACHINE_PRIORITY`, `SET_MACHINE_BOOST`, `TOGGLE_ENERGY_DEBUG` | `POWER_*`                                    |
| Construction   | `src/game/store/contexts/construction-context.ts`   | `constructionSites` plus construction-related `assets`, `cellMap`, source maps, hub upgrade state, and notifications                                                          | `BUILD_PLACE_BUILDING`, `REQUEST_DECONSTRUCT_ASSET`, `CANCEL_DECONSTRUCT_ASSET`, `BUILD_REMOVE_ASSET`, `UPGRADE_HUB`                                                                                                | `CONSTRUCTION_*`                             |
| Auto Miner     | `src/game/store/contexts/auto-miner-context.ts`     | `autoMiners`, miner logistics output, miner boost/config seams                                                                                                                | Current `LOGISTICS_TICK` auto-miner phase; placement initialization in `BUILD_PLACE_BUILDING`; boost via `SET_MACHINE_BOOST`                                                                                        | `AUTO_MINER_*`                               |
| Auto Smelter   | `src/game/store/contexts/auto-smelter-context.ts`   | `autoSmelters`, smelter recipe/config, belt I/O, smelter boost seams                                                                                                          | `AUTO_SMELTER_SET_RECIPE`; current `LOGISTICS_TICK` auto-smelter phase; boost via `SET_MACHINE_BOOST`                                                                                                               | `AUTO_SMELTER_*`                             |
| Auto Assembler | `src/game/store/contexts/auto-assembler-context.ts` | `autoAssemblers`, assembler recipe/config, belt I/O                                                                                                                           | `AUTO_ASSEMBLER_SET_RECIPE`; current `LOGISTICS_TICK` auto-assembler phase                                                                                                                                          | `AUTO_ASSEMBLER_*`                           |
| Module Lab     | `src/game/store/contexts/module-lab-context.ts`     | `moduleLabJob`, `moduleFragments`, `moduleInventory`, and `assets` module-slot mirror                                                                                         | `START_MODULE_CRAFT`, `MODULE_LAB_TICK`, `COLLECT_MODULE`, `PLACE_MODULE`, `REMOVE_MODULE`, `COLLECT_FRAGMENT`                                                                                                      | `MODULE_LAB_*`                               |
| Research Lab   | `src/game/store/contexts/research-lab-context.ts`   | `unlockedBuildings`, research cost consumption from `inventory`, and `notifications`                                                                                          | `RESEARCH_BUILDING`                                                                                                                                                                                                 | `RESEARCH_*`                                 |
| Conveyor       | `src/game/store/contexts/conveyor-context.ts`       | `conveyors`, `conveyorUndergroundPeers`, `splitterRouteState`, `splitterFilterState`, `routingIndexCache`, conveyor placement/removal seams                                   | Current `LOGISTICS_TICK` conveyor phase; `SET_SPLITTER_FILTER`; conveyor branches of `BUILD_PLACE_BUILDING` and `BUILD_REMOVE_ASSET`                                                                                | `CONVEYOR_*`                                 |
| Zone           | `src/game/store/contexts/zone-context.ts`           | `productionZones`, `buildingZoneIds`, `buildingSourceWarehouseIds`; target may expose derived zone inventory views and collection-node decisions                              | `CREATE_ZONE`, `DELETE_ZONE`, `SET_BUILDING_ZONE`                                                                                                                                                                   | `ZONE_*`                                     |
| Ship           | `src/game/store/contexts/ship-context.ts`           | `ship`, dock warehouse cargo interactions, reward writes to `inventory`, `warehouseInventories`, `moduleInventory`, and `moduleFragments`                                     | `SHIP_TICK`, `SHIP_DOCK`, `SHIP_DEPART`, `SHIP_RETURN`, ship-adjacent `BUY_FRAGMENT`                                                                                                                                | `SHIP_*`                                     |
| UI             | `src/game/store/contexts/ui-context.ts`             | `openPanel`, selected panel IDs, `hotbarSlots`, `activeSlot`, build-mode selection, `notifications`, `autoDeliveryLog`, `lastTickError`                                       | `SET_ACTIVE_SLOT`, `TOGGLE_PANEL`, `CLOSE_PANEL`, `TOGGLE_ENERGY_DEBUG`, `EXPIRE_NOTIFICATIONS`, `ADD_ERROR_NOTIFICATION`, `TOGGLE_BUILD_MODE`, `SELECT_BUILD_BUILDING`, `SELECT_BUILD_FLOOR_TILE`                  | `UI_*`                                       |

Zone caveat: zone inventories are currently derived from `warehouseInventories` through zone aggregation helpers. Owning zone inventory as a direct context surface would be a deliberate migration choice, not current reality.

Collection-node caveat: `collectionNodes` are currently world/drop-drone state used by manual harvesting and drone pickup flows. Moving collection-node ownership into `zone-context.ts` would also be a deliberate migration choice, not current reality.

### 3.2 TypeScript Specification

The following code is intended for `src/game/store/contexts/types.ts`. It uses only current exported store types and existing `GameState` fields.

```typescript
import type { GameAction } from "../game-actions";
import type { GameState } from "../types";

export type GameActionType = GameAction["type"];

export interface BoundedContext<State> {
  reduce(state: State, action: GameAction): State | null;
  readonly handledActionTypes: readonly GameActionType[];
}

export type CraftingContextState = Pick<
  GameState,
  "crafting" | "keepStockByWorkbench" | "recipeAutomationPolicies"
>;

export type DronesContextState = Pick<
  GameState,
  | "drones"
  | "collectionNodes"
  | "constructionSites"
  | "crafting"
  | "inventory"
  | "warehouseInventories"
  | "serviceHubs"
  | "assets"
>;

export type InventoryContextState = Pick<
  GameState,
  "inventory" | "network" | "warehouseInventories" | "serviceHubs"
>;

export type WarehouseContextState = Pick<
  GameState,
  | "warehouseInventories"
  | "selectedWarehouseId"
  | "hotbarSlots"
  | "activeSlot"
  | "inventory"
>;

export type PowerContextState = Pick<
  GameState,
  | "battery"
  | "generators"
  | "connectedAssetIds"
  | "poweredMachineIds"
  | "machinePowerRatio"
  | "cablesPlaced"
  | "powerPolesPlaced"
  | "energyDebugOverlay"
  | "assets"
>;

export type ConstructionContextState = Pick<
  GameState,
  | "constructionSites"
  | "assets"
  | "cellMap"
  | "inventory"
  | "warehouseInventories"
  | "serviceHubs"
  | "connectedAssetIds"
  | "buildingSourceWarehouseIds"
  | "buildingZoneIds"
  | "notifications"
>;

export type AutoMinerContextState = Pick<
  GameState,
  | "autoMiners"
  | "assets"
  | "inventory"
  | "warehouseInventories"
  | "conveyors"
  | "autoDeliveryLog"
  | "machinePowerRatio"
  | "connectedAssetIds"
  | "poweredMachineIds"
>;

export type AutoSmelterContextState = Pick<
  GameState,
  | "autoSmelters"
  | "assets"
  | "conveyors"
  | "inventory"
  | "warehouseInventories"
  | "notifications"
  | "machinePowerRatio"
  | "poweredMachineIds"
>;

export type AutoAssemblerContextState = Pick<
  GameState,
  | "autoAssemblers"
  | "assets"
  | "conveyors"
  | "machinePowerRatio"
  | "poweredMachineIds"
>;

export type ModuleLabContextState = Pick<
  GameState,
  | "moduleLabJob"
  | "moduleFragments"
  | "moduleInventory"
  | "assets"
  | "notifications"
>;

export type ResearchLabContextState = Pick<
  GameState,
  "unlockedBuildings" | "inventory" | "notifications"
>;

export type ConveyorContextState = Pick<
  GameState,
  | "conveyors"
  | "conveyorUndergroundPeers"
  | "splitterRouteState"
  | "splitterFilterState"
  | "routingIndexCache"
  | "assets"
  | "cellMap"
  | "warehouseInventories"
  | "inventory"
>;

export type ZoneContextState = Pick<
  GameState,
  | "productionZones"
  | "buildingZoneIds"
  | "buildingSourceWarehouseIds"
  | "warehouseInventories"
  | "collectionNodes"
>;

export type ShipContextState = Pick<
  GameState,
  | "ship"
  | "warehouseInventories"
  | "inventory"
  | "moduleInventory"
  | "moduleFragments"
  | "notifications"
>;

export type UiContextState = Pick<
  GameState,
  | "openPanel"
  | "selectedWarehouseId"
  | "selectedPowerPoleId"
  | "selectedAutoMinerId"
  | "selectedAutoSmelterId"
  | "selectedAutoAssemblerId"
  | "selectedGeneratorId"
  | "selectedServiceHubId"
  | "selectedCraftingBuildingId"
  | "selectedSplitterId"
  | "hotbarSlots"
  | "activeSlot"
  | "buildMode"
  | "selectedBuildingType"
  | "selectedFloorTile"
  | "notifications"
  | "energyDebugOverlay"
  | "autoDeliveryLog"
  | "lastTickError"
>;

export interface ContextRegistry {
  crafting: BoundedContext<CraftingContextState>;
  drones: BoundedContext<DronesContextState>;
  inventory: BoundedContext<InventoryContextState>;
  warehouse: BoundedContext<WarehouseContextState>;
  power: BoundedContext<PowerContextState>;
  construction: BoundedContext<ConstructionContextState>;
  autoMiner: BoundedContext<AutoMinerContextState>;
  autoSmelter: BoundedContext<AutoSmelterContextState>;
  autoAssembler: BoundedContext<AutoAssemblerContextState>;
  moduleLab: BoundedContext<ModuleLabContextState>;
  researchLab: BoundedContext<ResearchLabContextState>;
  conveyor: BoundedContext<ConveyorContextState>;
  zone: BoundedContext<ZoneContextState>;
  ship: BoundedContext<ShipContextState>;
  ui: BoundedContext<UiContextState>;
}

export type ContextName = keyof ContextRegistry;

export const CONTEXT_ORDER = [
  "power",
  "inventory",
  "warehouse",
  "zone",
  "construction",
  "crafting",
  "drones",
  "autoMiner",
  "conveyor",
  "autoSmelter",
  "autoAssembler",
  "moduleLab",
  "researchLab",
  "ship",
  "ui",
] as const satisfies readonly ContextName[];
```

Action naming comparison:

| Current Pattern                                         | Target Pattern                                                     | Status                            |
| ------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------- |
| `JOB_*`, `CRAFT_REQUEST_WITH_PREREQUISITES`             | `CRAFTING_*` or `crafting.*`                                       | Target prefix does not exist yet. |
| `NETWORK_*`                                             | `INVENTORY_*`                                                      | Target prefix does not exist yet. |
| `GENERATOR_*`, `ENERGY_NET_TICK`                        | `POWER_*`                                                          | Target prefix does not exist yet. |
| `BUILD_*`, `REQUEST_DECONSTRUCT_ASSET`, `UPGRADE_HUB`   | `CONSTRUCTION_*`                                                   | Target prefix does not exist yet. |
| `LOGISTICS_TICK` phase ownership                        | `AUTO_MINER_*`, `CONVEYOR_*`, `AUTO_SMELTER_*`, `AUTO_ASSEMBLER_*` | Target split does not exist yet.  |
| `TOGGLE_PANEL`, `SET_ACTIVE_SLOT`, build-mode selectors | `UI_*`                                                             | Target prefix does not exist yet. |

### 3.3 Exhaustive Handling Pattern

Do not switch directly over full `GameAction` in a context reducer. First narrow to the context-owned action union, then switch exhaustively over that narrowed union.

The following example is compilable against current `GameAction` and `GameState` exports.

```typescript
import type { GameAction } from "../game-actions";
import type { CraftingContextState } from "./types";

type CraftingActionType =
  | "CRAFT_REQUEST_WITH_PREREQUISITES"
  | "JOB_ENQUEUE"
  | "JOB_CANCEL"
  | "JOB_MOVE"
  | "JOB_SET_PRIORITY"
  | "JOB_TICK"
  | "SET_KEEP_STOCK_TARGET"
  | "SET_RECIPE_AUTOMATION_POLICY";

type CraftingAction = Extract<GameAction, { type: CraftingActionType }>;

const CRAFTING_ACTION_TYPES = [
  "CRAFT_REQUEST_WITH_PREREQUISITES",
  "JOB_ENQUEUE",
  "JOB_CANCEL",
  "JOB_MOVE",
  "JOB_SET_PRIORITY",
  "JOB_TICK",
  "SET_KEEP_STOCK_TARGET",
  "SET_RECIPE_AUTOMATION_POLICY",
] as const satisfies readonly CraftingActionType[];

function isCraftingAction(action: GameAction): action is CraftingAction {
  return (CRAFTING_ACTION_TYPES as readonly string[]).includes(action.type);
}

export function reduceCrafting(
  state: CraftingContextState,
  action: GameAction,
): CraftingContextState | null {
  if (!isCraftingAction(action)) return null;
  return reduceCraftingAction(state, action);
}

function reduceCraftingAction(
  state: CraftingContextState,
  action: CraftingAction,
): CraftingContextState {
  switch (action.type) {
    case "CRAFT_REQUEST_WITH_PREREQUISITES":
    case "JOB_ENQUEUE":
    case "JOB_CANCEL":
    case "JOB_MOVE":
    case "JOB_SET_PRIORITY":
    case "JOB_TICK":
    case "SET_KEEP_STOCK_TARGET":
    case "SET_RECIPE_AUTOMATION_POLICY":
      return state;

    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
```

This pattern gives each context a public `GameAction`-compatible reducer while preserving compile-time failure when a context-owned action is added but not handled.

## 4. Implementation Blueprint

### Phase 1: Foundation (Week 1)

1. Create `src/game/store/contexts/`.
2. Add `src/game/store/contexts/types.ts` with `BoundedContext`, state aliases, `ContextRegistry`, `ContextName`, and `CONTEXT_ORDER`.
3. Add `src/game/store/contexts/contexts.test.ts` as the umbrella test file for the first migration slice. If the file becomes too large, split later by context, but keep this initial file as the migration checklist anchor.
4. Migrate the smallest isolated target first. Recommended first candidate: `auto-miner-context.ts`, because it has one primary state map (`autoMiners`) but currently lives inside `LOGISTICS_TICK`, making ownership value visible early.
5. Keep `game-actions.ts`, `game-reducer-dispatch.ts`, and `reducer.ts` behavior unchanged during Phase 1.
6. Record the initial `tick-phase-stress.test.ts` baseline before the first behavioral change.

Phase 1 exit criteria:

- `src/game/store/contexts/types.ts` compiles.
- One context module exists and is covered by unit tests.
- Old reducer imports still work.
- No cross-context imports exist between new context modules.

### Phase 2: Core Contexts (Week 2)

1. Migrate high-coupling contexts: `crafting-context.ts`, `drones-context.ts`, and `inventory-context.ts`.
2. Split `NETWORK_*` actions out of crafting ownership into inventory ownership while keeping current `GameAction` names stable.
3. Add full unit coverage for each migrated context with a coverage target of `>= 80%` per context.
4. Add `docs/ownership-matrix.md` with current action names, target prefixes, state fields, owner context, tests, and integration seams.
5. Keep cross-context communication at composition boundaries only. A context may depend on shared selectors/helpers, but it must not import another context module.

Phase 2 exit criteria:

- Crafting, drones, and inventory contexts own their narrowed action unions.
- Existing crafting tests, drone tests, inventory tests, and reducer tests remain green.
- `docs/ownership-matrix.md` is accurate enough for new action routing decisions.

### Phase 3: Integration (Week 3)

1. Implement `createGameReducer()` as the reducer composition root for all 15 contexts.
2. Rewire `game-reducer-dispatch.ts` to delegate to the composed context reducer while preserving the exported `dispatchAction` contract temporarily.
3. Keep `reducer.ts` imports stable. `gameReducer`, `gameReducerWithInvariants`, `createInitialState`, and public re-exports remain import-compatible.
4. Add integration tests for multi-context flows: drone pickup to inventory, crafting reservation to warehouse commit, ship reward to module inventory, and conveyor to smelter/assembler handoff.
5. Mark `game-actions.ts` and `game-reducer-dispatch.ts` as deprecated once the context reducer is the primary implementation path.
6. Compare `tick-phase-stress.test.ts` results before and after composition. The accepted budget is `<= 5ms` or `<= 5%` regression versus the baseline, whichever is easier to interpret for the measured environment.

Phase 3 exit criteria:

- Context registry drives reducer composition.
- All existing behavior remains import-compatible through `src/game/store/reducer.ts`.
- Old hotspot files remain functional but deprecated.
- Performance remains within budget.

## 5. Migration Strategy

### Backward Compatibility

`src/game/store/game-actions.ts` and `src/game/store/game-reducer-dispatch.ts` stay temporarily functional. The migration must not require UI, tests, Phaser bridge code, or persistence code to update imports in the same PR.

`src/game/store/reducer.ts` remains the stable public entry point. Existing imports from `../store/reducer` must continue to resolve `gameReducer`, `gameReducerWithInvariants`, `createInitialState`, and exported domain helpers.

When Phase 3 makes context composition primary, add `@deprecated` JSDoc to the old hotspot files and exported compatibility functions. The JSDoc must link readers to `src/game/store/contexts/` and `docs/ownership-matrix.md`.

Deprecation note shape:

```text
/**
 * @deprecated Use bounded context reducers under `src/game/store/contexts/`.
 * See `docs/ownership-matrix.md` for action ownership and migration guidance.
 */
```

### Rollback Plan

Rollback if any of these occur:

- `yarn tsc --project tsconfig.factory.json --noEmit` fails because context/action types diverge.
- `yarn test` fails in existing reducer, crafting, drone, ship, or logistics behavior.
- `tick-phase-stress.test.ts` reports a regression outside the accepted `<= 5ms` or `<= 5%` budget versus baseline.
- A migrated context requires cross-context imports to function.
- Save/load compatibility becomes unclear for persisted `GameState` fields.

Rollback method:

1. Revert the migration commit that wired a context into composition.
2. Keep untouched context files isolated if they are not imported by the active reducer path.
3. Restore `game-reducer-dispatch.ts` as the primary implementation path.
4. Re-run `yarn tsc --project tsconfig.factory.json --noEmit` and `yarn test`.
5. Re-run the stress baseline before attempting the migration again.

Risk mitigation:

- Migrate one context at a time.
- Keep context modules rollback-isolated: no imports from one context module into another context module.
- Shared pure helpers may live outside `contexts/`, but ownership must remain documented.
- Save-related state changes remain subject to the existing initial-state, save-codec, and save-migration checklist.
- Any routing-affecting context must document when it invalidates `routingIndexCache`.

## 6. Testing Strategy

### Unit Tests Per Context

Each context gets focused unit tests around its narrowed action union. The starting point is `src/game/store/contexts/contexts.test.ts`, using one `describe('<context-name>-context', () => { ... })` block per migrated context. If the file becomes noisy, split into per-context test files after the first three contexts are stable.

Recommended patterns:

- Use fixture factories based on `createInitialState('release')` from `src/game/store/reducer.ts`.
- Build context slices with `Pick<GameState, ...>` so tests prove the context boundary is real.
- Construct actions with `satisfies GameAction` to keep payloads honest.
- Assert isolation: an action owned by one context returns `null` from unrelated contexts.
- Assert unchanged state identity when a handled action is a no-op.
- Assert the context's `handledActionTypes` covers every owned action type.

Existing test references to reuse:

| Area                   | Existing Test Files                                                                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reducer/store behavior | `src/game/store/__tests__/warehouse-logic.test.ts`, `src/game/store/__tests__/research.test.ts`, `src/game/store/__tests__/production-zones.test.ts`                                    |
| Crafting               | `src/game/crafting/__tests__/tick.test.ts`, `src/game/crafting/__tests__/queue.test.ts`, `src/game/crafting/__tests__/tickPhases.test.ts`                                               |
| Drones                 | `src/game/drones/__tests__/starter-drone-regressions.test.ts`, `src/game/drones/__tests__/starter-drone-movement.test.ts`, `src/game/drones/__tests__/starter-drone-assignment.test.ts` |
| Ship                   | `src/game/ship/__tests__/ship-lifecycle.test.ts`, `src/game/ship/__tests__/ship-e2e.test.ts`, `src/game/ship/__tests__/dock-logistics.test.ts`                                          |
| Performance            | `src/game/store/__tests__/tick-phase-stress.test.ts`                                                                                                                                    |

### Integration Tests

Add integration tests after each high-coupling context migration:

- Drone picks up a collection node and deposits into a physical inventory.
- Player queues a crafting job, inventory reservations are created, and the job advances through `JOB_TICK`.
- Keep-stock refills a workbench after inventory changes.
- Conveyor transfers an item to auto-smelter input and then to auto-assembler input.
- Ship departs with dock cargo and rewards coins, resources, module fragments, or complete modules.
- Zone assignment changes source resolution without directly persisting zone inventory.

### Performance Tests

Use `src/game/store/__tests__/tick-phase-stress.test.ts` as the baseline harness.

Performance process:

1. Run the current baseline on the same machine before wiring the first context into reducer composition.
2. Record total elapsed time and slowest phase for the same seeded large-state scenario.
3. Run the same stress test after each context group migration.
4. Accept only if regression is `<= 5ms` or `<= 5%` versus baseline.
5. If variance is high, repeat locally and use the median of three runs before deciding.

## 7. Acceptance Criteria

| Criteria                                   | Yarn Command                                        | Pass Condition                                                                                                             |
| ------------------------------------------ | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| TypeScript strict check is green           | `yarn tsc --project tsconfig.factory.json --noEmit` | No type errors, no context/action drift, and no new `as any` in context reducers.                                          |
| Exhaustive handling exists in all contexts | `yarn tsc --project tsconfig.factory.json --noEmit` | Each context has a narrowed action union and `_exhaustive: never` in the private exhaustive reducer.                       |
| Existing tests are green                   | `yarn test`                                         | All current reducer, crafting, drone, ship, inventory, logistics, and UI tests pass.                                       |
| New unit tests reach coverage target       | `yarn test --coverage`                              | Each migrated context has `>= 80%` statement coverage or an approved documented exception.                                 |
| Lint is green                              | `yarn lint`                                         | No new lint errors from context files, tests, or docs-adjacent TypeScript.                                                 |
| Production build is green                  | `yarn build`                                        | TypeScript build and Vite build both complete successfully.                                                                |
| Tick performance is within budget          | `yarn test`                                         | `tick-phase-stress.test.ts` reports no more than `<= 5ms` or `<= 5%` regression versus baseline.                           |
| Ownership matrix is documented             | Manual review                                       | `docs/ownership-matrix.md` exists and maps every current action name to exactly one target context.                        |
| Legacy files are deprecated but functional | Manual review plus `yarn test`                      | `game-actions.ts` and `game-reducer-dispatch.ts` keep compatibility exports and include `@deprecated` JSDoc after Phase 3. |
| Public reducer imports are preserved       | `yarn tsc --project tsconfig.factory.json --noEmit` | Existing imports from `src/game/store/reducer.ts` continue to type-check without caller changes.                           |

## 8. Glossary

| Term                  | Definition                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bounded Context       | A state-management module with explicit ownership over a cohesive domain slice, action set, tests, and integration seams.                              |
| Context Registry      | The typed map of all 15 bounded contexts used by reducer composition.                                                                                  |
| Exhaustive Checking   | A TypeScript pattern where every action in a narrowed union must be handled, enforced by assigning the default branch to `never`.                      |
| Narrowed Union        | A subset of `GameAction` created with `Extract<GameAction, { type: ... }>` for one context's owned actions.                                            |
| Ownership Matrix      | A document mapping current action names, target prefixes, state fields, owning context, tests, and migration notes.                                    |
| Compatibility Wrapper | A temporary old file or function that keeps existing imports working while delegating to the new context implementation.                               |
| Integration Seam      | A deliberate boundary where one context's behavior affects another context's state through reducer composition, not direct context-to-context imports. |
| Tick Regression       | A measurable slowdown in the periodic simulation reducers, compared against `tick-phase-stress.test.ts` baseline output.                               |

## 9. References

| Reference                                                     | Purpose                                                                                                                 |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/game/store/types.ts`                                     | Authoritative `GameState` shape and state-field names for all context aliases.                                          |
| `src/game/store/game-actions.ts`                              | Current canonical `GameAction` union and current action names.                                                          |
| `src/game/store/game-reducer-dispatch.ts`                     | Current central dispatch-chain hotspot and migration target.                                                            |
| `src/game/store/reducer.ts`                                   | Public reducer entry point that must preserve import compatibility.                                                     |
| `src/game/entry/use-game-ticks.ts`                            | Tick orchestration, frequency, and ordering constraints.                                                                |
| `src/game/store/__tests__/tick-phase-stress.test.ts`          | Current performance baseline harness for tick reducer phases.                                                           |
| `src/game/crafting/__tests__/tick.test.ts`                    | Crafting reducer/test fixture style.                                                                                    |
| `src/game/drones/__tests__/starter-drone-regressions.test.ts` | Drone workflow and regression coverage style.                                                                           |
| `src/game/ship/__tests__/ship-e2e.test.ts`                    | Ship integration workflow coverage style.                                                                               |
| Domain-Driven Design bounded context material                 | Optional background for the ownership model; implementation should still follow current Factory Island code boundaries. |

## 10. Next Steps

1. Review and approve the 15-context ownership map.
2. Capture the current `tick-phase-stress.test.ts` baseline on the development machine.
3. Create `src/game/store/contexts/` and add `types.ts` from the TypeScript specification.
4. Add `src/game/store/contexts/contexts.test.ts` with the first context's isolation tests.
5. Migrate `auto-miner-context.ts` first, keeping `game-reducer-dispatch.ts` functional.
6. Create `docs/ownership-matrix.md` before migrating the core crafting, drones, and inventory contexts.
7. Re-run `yarn tsc --project tsconfig.factory.json --noEmit`, `yarn test`, `yarn test --coverage`, `yarn lint`, and `yarn build` at the phase gates.

## 11. Phase 3 Cutover Status

Shadow mode active as of 2026-05-11.

`gameReducer` in `src/game/store/reducer.ts` continues to delegate to
`dispatchAction` (legacy path) and returns its output unchanged. In DEV builds
only, `applyContextReducers` runs in parallel on the pre-action state and
`shadowDiff` compares the slices below against the legacy result, logging any
mismatch via `console.warn`. Production builds skip the diff entirely.

### Slices in shadow comparison

| Slice                                                                                                                   | Context        | Status                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------ |
| crafting / keepStockByWorkbench / recipeAutomationPolicies                                                              | crafting       | Shadow active. `SET_KEEP_STOCK_TARGET` drops the workbench-asset gate (cross-slice).                         |
| drones                                                                                                                  | drones         | Shadow active. `DRONE_TICK` and `ASSIGN_DRONE_TO_HUB` are cross-slice no-ops.                                |
| inventory / network                                                                                                     | inventory      | Shadow active.                                                                                               |
| autoMiners                                                                                                              | auto-miner     | Shadow active. `LOGISTICS_TICK` is a cross-slice no-op.                                                      |
| autoSmelters                                                                                                            | auto-smelter   | Shadow active. `LOGISTICS_TICK` is a cross-slice no-op; recipe set drops construction gate.                  |
| autoAssemblers                                                                                                          | auto-assembler | Shadow active. `LOGISTICS_TICK` is a cross-slice no-op; recipe set drops construction gate.                  |
| unlockedBuildings                                                                                                       | research-lab   | Shadow active. `RESEARCH_BUILDING` is a cross-slice no-op.                                                   |
| moduleLabJob / moduleFragments / moduleInventory                                                                        | module-lab     | Shadow active. `MODULE_LAB_TICK`, `PLACE_MODULE`, `REMOVE_MODULE` are cross-slice no-ops.                    |
| ship                                                                                                                    | ship           | Shadow active. `SHIP_TICK`, `SHIP_DEPART`, `SHIP_RETURN` are cross-slice no-ops.                             |
| productionZones / buildingZoneIds / buildingSourceWarehouseIds                                                          | zone           | Shadow active. `SET_BUILDING_ZONE` / `SET_BUILDING_SOURCE` drop asset/warehouse gates.                       |
| openPanel / notifications / buildMode / hotbarSlots / activeSlot / energyDebugOverlay / lastTickError / selected-\* ids | ui             | Shadow active. `TOGGLE_BUILD_MODE` drops the cross-slice `selectedBuildingType` / `selectedFloorTile` reset. |

### Full no-op contexts (not in shadow comparison)

`warehouse`, `power`, `construction`, `conveyor` — every action they handle
requires wider `GameState` than the slice owns (inventory, assets,
notifications, etc.), so their reducers return the input slice unchanged. They
remain registered in `applyContextReducers` to document ownership but they
cannot diverge from legacy.

### Known divergences (documented, not bugs)

The contexts above drop a handful of cross-slice safety gates because the
isolated slice does not own the relevant fields. The live game is unaffected —
shadow mode only logs warnings, the legacy result is what runs.

- `SET_KEEP_STOCK_TARGET` for an unknown workbench id (no `state.assets` in slice).
- `SET_BUILDING_ZONE` / `SET_BUILDING_SOURCE` for unknown buildings or warehouses.
- `AUTO_SMELTER_SET_RECIPE` / `AUTO_ASSEMBLER_SET_RECIPE` while the target is under construction.
- `SET_SPLITTER_FILTER` for non-splitter or unknown asset ids.
- `TOGGLE_BUILD_MODE` does not reset `selectedBuildingType` / `selectedFloorTile` (outside the UI slice).

### Next step

Monitor the browser console for `[BoundedContext shadow]` warnings during
gameplay. When zero unexpected warnings accumulate over a full play session,
proceed to Phase 4: remove the legacy dispatch and make `applyContextReducers`
the sole reducer.
