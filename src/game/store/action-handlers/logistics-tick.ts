// ============================================================
// LOGISTICS_TICK action handler
// ------------------------------------------------------------
// Extracted from reducer.ts. Encapsulates the LOGISTICS_TICK
// orchestration as four internal phases:
//   1. Auto-miner production + output routing.
//   2. Conveyor movement + transport matching/handoff.
//   3. Auto-smelter belt input, processing, output flush, status.
//   4. Auto-assembler belt input, processing, and output.
//
// Phase 0 (snapshot) and Phase 6 (commit) are handled in the
// orchestrator. Phases share a mutable `LogisticsTickContext`
// holding the lazy "newXxxL" working sets, the local helpers
// (tryStoreInWarehouse / getLiveLogisticsState / applySourceInventory
// / getSourceCapacity / getMachinePowerRatio) and the `changed`
// flag — preserving 1:1 behavior with the original case body.
//
// Reducer-internal helpers and constants are injected as deps to
// avoid value-import cycles with reducer.ts.
// ============================================================

import type { GameState } from "../types";
import { buildConveyorRoutingIndex } from "../decisions/conveyor-decisions";
import {
  type LogisticsTickIoDeps,
  type LogisticsTickContext,
} from "./logistics-tick/context";
import { runAutoMinerPhase } from "./logistics-tick/phases/auto-miner";
import { runConveyorPhase } from "./logistics-tick/phases/conveyor";
import { runAutoSmelterPhase } from "./logistics-tick/phases/auto-smelter";
import { runAutoAssemblerPhase } from "./logistics-tick/phases/auto-assembler";

export type { LogisticsTickIoDeps } from "./logistics-tick/context";

// ------------------------------------------------------------
// Phase 2 is extracted in ./logistics-tick/phases/auto-miner.ts.
// ------------------------------------------------------------

// ------------------------------------------------------------
// Phase 3 is extracted in ./logistics-tick/phases/conveyor.ts.
// ------------------------------------------------------------

// ------------------------------------------------------------
// Phase 4 is extracted in ./logistics-tick/phases/auto-smelter.ts.
// ------------------------------------------------------------

// ------------------------------------------------------------
// Orchestrator entry point.
// ------------------------------------------------------------
export function handleLogisticsTickAction(
  state: GameState,
  deps: LogisticsTickIoDeps,
): GameState {
  // Phase 0: Snapshot powered machines and initialize mutable working set.
  const conveyorRoutingIndex = buildConveyorRoutingIndex(state);
  const ctx: LogisticsTickContext = {
    state,
    deps,
    poweredSet: new Set(state.poweredMachineIds ?? []),
    newAutoMinersL: state.autoMiners,
    newConveyorsL: state.conveyors,
    newInvL: state.inventory,
    newWarehouseInventoriesL: state.warehouseInventories,
    newSmithyL: state.smithy,
    newNotifsL: state.notifications,
    newAutoDeliveryLogL: state.autoDeliveryLog,
    newAutoSmeltersL: state.autoSmelters,
    newAutoAssemblersL: state.autoAssemblers,
    changed: false,
  };

  // TICK ORDER (canonical, do not reorder):
  // 1. runAutoMinerPhase   -> produces items onto belts.
  // 2. runConveyorPhase    -> moves/reroutes items (includes splitter filter lookup).
  // 3. runAutoSmelterPhase -> pulls from belt input and processes.
  // 4. runAutoAssemblerPhase -> pulls from belt input and processes.
  //
  // Why this order must stay fixed:
  // - Miner before conveyor: freshly produced items can move in the same LOGISTICS_TICK.
  // - Conveyor before smelter/assembler: items arriving on input belts can be consumed in the same tick.
  // Phase 2: Auto-miner production and output routing.
  runAutoMinerPhase(ctx);
  // Phase 3: Conveyor movement, transport matching, and destination handoff.
  runConveyorPhase(ctx, conveyorRoutingIndex);
  // Phase 4: Auto-smelter belt input, processing, and output flush/status update.
  runAutoSmelterPhase(ctx);
  // Phase 5: Auto-assembler (belt-only I/O, fixed V1 recipes).
  runAutoAssemblerPhase(ctx);

  // Phase 6: Commit accumulated logistics mutations (or no-op).
  if (!ctx.changed) return state;
  return {
    ...state,
    inventory: ctx.newInvL,
    warehouseInventories: ctx.newWarehouseInventoriesL,
    smithy: ctx.newSmithyL,
    autoMiners: ctx.newAutoMinersL,
    autoSmelters: ctx.newAutoSmeltersL,
    autoAssemblers: ctx.newAutoAssemblersL,
    conveyors: ctx.newConveyorsL,
    notifications: ctx.newNotifsL,
    autoDeliveryLog: ctx.newAutoDeliveryLogL,
  };
}
