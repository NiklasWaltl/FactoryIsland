// ============================================================
// Factory Island - Game State & Logic
// ============================================================

import {
  GENERATOR_MAX_FUEL,
  getBuildingInputConfig,
  WAREHOUSE_CAPACITY,
} from "./constants/buildings/index";
import { CONVEYOR_TILE_CAPACITY } from "./conveyor/constants";
import {
  getManualAssemblerRecipe,
  getWorkbenchRecipe,
  getSmeltingRecipe,
  SMELTING_RECIPES,
} from "../simulation/recipes";
import {
  cancelJob as craftingCancelJob,
  enqueueJob as craftingEnqueueJob,
  createEmptyCraftingQueue,
  moveJob as craftingMoveJob,
  setJobPriority as craftingSetJobPriority,
} from "../crafting/queue";
import { buildWorkbenchAutoCraftPlan } from "../crafting/planner";
import { applyKeepStockRefills } from "../crafting/workflows/keepStockWorkflow";
import {
  applyPlanningTriggers,
  applyExecutionTick,
} from "../crafting/tickPhases";
import {
  applyRecipeAutomationPolicyPatch,
  areRecipeAutomationPolicyEntriesEqual,
  checkRecipeAutomationPolicy,
  isRecipeAutomationPolicyEntryDefault,
  type RecipeAutomationPolicyPatch,
} from "../crafting/policies";
import { routeOutput } from "../crafting/output";
import { applyZoneDelta } from "../zones/production-zone-mutation";
import { finalizeHubTier2Upgrade } from "../buildings/service-hub/hub-upgrade-workflow";
import { droneTravelTicks } from "../drones/movement/drone-movement";
import { syncDrones } from "../drones/utils/drone-state-helpers";
import { addErrorNotification, addNotification } from "./utils/notifications";
import { decideHubDispatchExecutionAction } from "./workflows/hub-dispatch-execution";
import { dispatchAction } from "./game-reducer-dispatch";
import {
  decideInitialWarehousePlacement,
  deriveDebugBootstrapLayout,
} from "./helpers/initialState";
import {
  decideAutoSmelterTickEntryEligibility,
  decideAutoSmelterInputBeltEligibility,
  decideAutoSmelterNonPendingStatus,
  decideAutoSmelterOutputTarget,
  decideAutoSmelterPendingOutputStatus,
  decideAutoSmelterStartProcessingEligibility,
} from "./decisions/smelter-decisions";
import { consumeAutoSmelterPendingOutput } from "./helpers/smelter-mutations";
import {
  decideConveyorTickEligibility,
  decideConveyorTargetSelection,
} from "./decisions/conveyor-decisions";
import {
  decideAutoMinerOutputTarget,
  decideAutoMinerTickEligibility,
} from "./decisions/auto-miner-decisions";
import type { CraftingInventorySource } from "../crafting/types";

// GameState used internally for gameReducer function signatures.
// All other type re-exports moved to ./reducer-public-api.
import type { GameState } from "./types";

// ============================================================
// CONSTANTS
// ============================================================

// Floor tile constants live in ./constants/map/floor.

// Timing constants live in ./constants/timing/timing.
import {
  DRONE_TICK_MS,
  LOGISTICS_TICK_MS,
  NATURAL_SPAWN_CAP,
  NATURAL_SPAWN_CHANCE,
  SAPLING_GROW_MS,
} from "./constants/timing/timing";

// Auto-delivery log limits live in ./constants/auto/auto-delivery.
import {
  AUTO_DELIVERY_BATCH_WINDOW_MS,
  AUTO_DELIVERY_LOG_MAX,
} from "./constants/auto/auto-delivery";

// Drone/logistics constants live in ./constants/drone/drone-config.
import {
  AUTO_MINER_PRODUCE_TICKS,
  DRONE_COLLECT_TICKS,
  DRONE_DEPOSIT_TICKS,
  DRONE_SPEED_TILES_PER_TICK,
} from "./constants/drone/drone-config";

// Energy/auto-smelter coupled constants live in ./constants/energy-smelter.
import {
  AUTO_SMELTER_IDLE_DRAIN_PER_PERIOD,
  AUTO_SMELTER_PROCESSING_DRAIN_PER_PERIOD,
  ENERGY_NET_TICK_MS,
} from "./constants/energy/energy-smelter";

// Generator constants live in ./constants/generator.
import {
  GENERATOR_ENERGY_PER_TICK,
  GENERATOR_TICK_MS,
  GENERATOR_TICKS_PER_WOOD,
} from "./constants/energy/generator";

// Workbench/Smithy timing constants live in ./constants/timing/workbench-timing.
import {
  MANUAL_ASSEMBLER_PROCESS_MS,
  MANUAL_ASSEMBLER_TICK_MS,
  SMITHY_PROCESS_MS,
  SMITHY_TICK_MS,
} from "./constants/timing/workbench-timing";

// Service hub upgrade cost lives in ./constants/hub-upgrade-cost.
import { HUB_UPGRADE_COST } from "./constants/hub/hub-upgrade-cost";

// Map shop offer constants live in ./constants/ui/shop.

// Action-handler dependency-injection containers live in ./action-handler-deps
// and are wired into the dispatch chain in ./game-reducer-dispatch.

import { devAssertInventoryNonNegative } from "./helpers/misc-helpers";

import { clampMachinePriority } from "./helpers/machine-priority";
import {
  COLLECTABLE_KEYS,
  fullCostAsRemaining,
  consumeBuildResources,
} from "./inventory-ops";

// ---- Auto-Miner / Conveyor ----
// ---- Crafting job queue ----
// ---- Starter Drone ----
// Drone constants and helper functions were extracted to:
// - ./constants/drone/drone-config
// - ./constants/drone/drone-assignment-caps
// - ./helpers/drone-helpers

// costIsFullyCollectable, fullCostAsRemaining, COLLECTABLE_KEYS extracted to ./inventory-ops

// Need-slot resolvers live in drones/selection/helpers/need-slot-resolvers.ts
// and are imported directly by their consumers (drones/selection/*,
// drones/candidates/*, drones/execution/*).

// Helpers extracted to ./helpers/reducer-helpers.
import {
  getWarehouseCapacity,
  logCraftingSelectionComparison,
  addAutoDelivery,
  tickOneDrone,
  getKeepStockByWorkbench,
  getRecipeAutomationPolicies,
} from "./helpers/reducer-helpers";

// ============================================================
// INVENTORY WRAPPERS
// V1: operate on the global `state.inventory` pool.
// Future versions may aggregate per-warehouse inventories.
// ============================================================

// consumeBuildResources extracted to ./inventory-ops

// ============================================================
// CRAFTING SOURCE POLICY
//
// `CraftingSource` / `WorkbenchSource` are declared in ./types and
// re-exported via ./reducer-public-api. Determines where a crafting device
// reads/writes resources.
// ============================================================

// ============================================================
// PRODUCTION ZONE HELPERS
// ============================================================

// ============================================================
// SOURCE STATUS VIEW-MODEL
// Pure derivation for UI transparency — no side effects.
// Re-exported via ./reducer-public-api (see end of file).
// ============================================================

// ============================================================
// HELPERS
// ============================================================

// _smelterRecipesLogged moved into action-handlers/logistics-tick.ts together with the smelter phase.
// makeId lives in ./make-id (extracted so handler modules can value-import it
// directly without an ESM cycle through this file). Re-exported via
// ./reducer-public-api for backward compatibility with `from "../store/reducer"`.

// removeAsset extracted to ./asset-mutation

// ============================================================
// CONNECTIVITY
// ============================================================

// ============================================================
// INITIAL STATE
// ============================================================

export { createInitialState } from "./initial-state";

// ============================================================
// ACTIONS
// ============================================================

import type { GameAction } from "./game-actions";
export type { GameAction };

// ============================================================
// REDUCER
// ============================================================

// Crafting-Job-Status-, Source-Vergleichs- und Cap-Helfer leben in
// ../crafting/jobStatus und werden oben importiert.
// Die Keep-in-stock-Refill-Orchestrierung liegt in
// ../crafting/workflows/keepStockWorkflow (applyKeepStockRefills).
//
// Die Action-Handler-Deps-Container leben in ./action-handler-deps und
// werden oben importiert.

// ============================================================
// DISPATCHER
// ------------------------------------------------------------
// The dispatch chain itself lives in ./game-reducer-dispatch.
// `gameReducer` here is a thin entry-point so that tooling, tests
// and external consumers keep importing it from "../store/reducer".
// ============================================================
export function gameReducer(state: GameState, action: GameAction): GameState {
  return dispatchAction(state, action);
}

/** Wraps the core reducer with dev-mode invariant assertions. */
export function gameReducerWithInvariants(state: GameState, action: GameAction): GameState {
  const next = gameReducer(state, action);
  if (import.meta.env.DEV && next !== state) {
    devAssertInventoryNonNegative("state.inventory", next.inventory);
    for (const [whId, whInv] of Object.entries(next.warehouseInventories)) {
      devAssertInventoryNonNegative(`warehouseInventories[${whId}]`, whInv);
    }
  }
  return next;
}



// Public API barrel: pure `export ... from` lines extracted to ./reducer-public-api.
// Placed at end-of-file so explicit local exports above take precedence in CJS init order.
export * from "./reducer-public-api";
