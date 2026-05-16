// ============================================================
// Live-switch wrapper tests for DRONE_TICK + LOGISTICS_TICK + JOB_TICK
// (Option B migration, 2026-05-16 / 2026-05-17).
// ------------------------------------------------------------
// Covers the three BASE_TICK orchestrator tick actions that are now
// claimed by applyLiveContextReducers via DRONE_TICK_LIVE_DEPS /
// LOGISTICS_TICK_LIVE_DEPS / inline JOB_TICK wrapper. Verifies:
//   - the live switch claims each action (non-null return)
//   - happy/empty paths preserve the legacy contract
//   - deps are forwarded verbatim (spy tests against the underlying
//     cluster handlers, mirroring how the live wrappers call them)
// Deep tick coverage stays in the per-phase tests under
// action-handlers/logistics-tick/, the drone-execution tests and
// crafting/__tests__/tick.test.ts.
// ============================================================

import { createInitialState } from "../../initial-state";
import { applyLiveContextReducers } from "../create-game-reducer";
import { handleDroneTickAction } from "../../action-handlers/drone-tick-actions";
import {
  handleLogisticsTickAction,
  type LogisticsTickIoDeps,
} from "../../action-handlers/logistics-tick";
import type { GameAction } from "../../game-actions";
import type { GameState, Inventory, PlacedAsset } from "../../types";

function baseState(): GameState {
  return createInitialState("release");
}

// ============================================================
// DRONE_TICK — live-switch wrapper
// ============================================================

describe("applyLiveContextReducers — DRONE_TICK", () => {
  it("claims the action (returns non-null state) instead of falling through", () => {
    const s = baseState();
    const action: GameAction = { type: "DRONE_TICK" };

    const result = applyLiveContextReducers(s, action);

    expect(result).not.toBeNull();
  });

  it("happy path: non-empty drones map produces a valid drones slice", () => {
    const s = baseState();
    // createInitialState seeds drones["starter"]; sanity-check the precondition.
    expect(Object.keys(s.drones).length).toBeGreaterThan(0);
    const action: GameAction = { type: "DRONE_TICK" };

    const next = applyLiveContextReducers(s, action)!;

    // An idle drone with no task remains structurally identical post-tick
    // (applyDroneUpdate short-circuits when no field changes), so the
    // slice reference may equal `s.drones`. The contract we verify here
    // is: the live wrapper returns a fully-populated state with all
    // pre-existing drones still present and tracked under their ids.
    for (const droneId of Object.keys(s.drones)) {
      expect(next.drones[droneId]).toBeDefined();
      expect(next.drones[droneId].droneId).toBe(droneId);
    }
  });

  it("empty drones: returns the input state reference unchanged", () => {
    const s: GameState = { ...baseState(), drones: {} };
    const action: GameAction = { type: "DRONE_TICK" };

    const next = applyLiveContextReducers(s, action);

    // runDroneTickPhase loops over Object.keys(state.drones); empty map
    // means zero iterations, so handleDroneTickAction returns the exact
    // input reference. The live wrapper's `?? state` defensive branch is
    // unreachable here — the cluster handler claims DRONE_TICK directly.
    expect(next).toBe(s);
  });

  it("forwards tickOneDrone via deps: called once per drone in state.drones", () => {
    const s = baseState();
    const droneIds = Object.keys(s.drones);
    expect(droneIds.length).toBeGreaterThan(0);

    // Identity spy: mirrors the live wrapper's contract (deps are passed
    // straight through to handleDroneTickAction). Returning the input
    // state keeps every iteration a no-op and lets us count calls.
    const tickOneDrone = jest.fn(
      (state: GameState, _droneId: string): GameState => state,
    );
    const action: GameAction = { type: "DRONE_TICK" };

    handleDroneTickAction(s, action, { tickOneDrone });

    expect(tickOneDrone).toHaveBeenCalledTimes(droneIds.length);
    for (const droneId of droneIds) {
      expect(tickOneDrone).toHaveBeenCalledWith(expect.any(Object), droneId);
    }
  });
});

// ============================================================
// LOGISTICS_TICK — live-switch wrapper
// ============================================================

describe("applyLiveContextReducers — LOGISTICS_TICK", () => {
  it("claims the action (returns non-null state) instead of falling through", () => {
    const s = baseState();
    const action: GameAction = { type: "LOGISTICS_TICK" };

    const result = applyLiveContextReducers(s, action);

    expect(result).not.toBeNull();
  });

  it("empty world: returns a fresh state object with routingIndexCache set", () => {
    const s = baseState();
    const action: GameAction = { type: "LOGISTICS_TICK" };

    const next = applyLiveContextReducers(s, action)!;

    // handleLogisticsTickAction always recomputes routingIndexCache in
    // Phase 0 (getOrBuildRoutingIndex), so the return is always a
    // new object — never `toBe(s)` — even when no slice mutated.
    expect(next).not.toBe(s);
    expect(next.routingIndexCache).toBeDefined();
    // No conveyors / miners / smelters → slices stay reference-equal.
    expect(next.conveyors).toBe(s.conveyors);
    expect(next.autoMiners).toBe(s.autoMiners);
    expect(next.autoSmelters).toBe(s.autoSmelters);
    expect(next.autoAssemblers).toBe(s.autoAssemblers);
    expect(next.inventory).toBe(s.inventory);
  });

  it("happy path: routingIndexCache reference is set (built or reused) after tick", () => {
    const s = baseState();
    const action: GameAction = { type: "LOGISTICS_TICK" };

    const next = applyLiveContextReducers(s, action)!;

    // The cache may be reused from the pre-tick state if no cache
    // invalidation occurred, but the post-tick state must always have a
    // routingIndexCache populated by getOrBuildRoutingIndex.
    expect(next.routingIndexCache).not.toBeNull();
    expect(next.routingIndexCache).not.toBeUndefined();
  });

  it("forwards deps verbatim: addNotification + addAutoDelivery spies are wired through", () => {
    const s = baseState();
    const addNotification = jest.fn(
      (notifications: GameState["notifications"]) => notifications,
    );
    const addAutoDelivery = jest.fn((log: GameState["autoDeliveryLog"]) => log);
    const spyDeps: LogisticsTickIoDeps = {
      addNotification,
      addAutoDelivery,
    };

    const result = handleLogisticsTickAction(s, spyDeps);

    // No conveyors / miners in the seed world → triggers never fire,
    // so both spies stay at zero calls. The test value is that the
    // handler accepts the spy-deps object verbatim and runs to
    // completion without touching them, mirroring how the live wrapper
    // hands LOGISTICS_TICK_LIVE_DEPS into the same call site.
    expect(addNotification).not.toHaveBeenCalled();
    expect(addAutoDelivery).not.toHaveBeenCalled();
    expect(result.routingIndexCache).toBeDefined();
  });
});

// ============================================================
// JOB_TICK — live-switch wrapper (Option B, 2026-05-17)
// ============================================================
//
// The wrapper calls applyPlanningTriggers + applyExecutionTick inline
// (mirrors runJobTickPhase in queue-management-phase.ts:106-117). We
// verify contract-level behaviour here; the deep tick lifecycle lives
// in crafting/__tests__/tick.test.ts.

const JOB_TICK_WB = "wb-live-job-tick";
const JOB_TICK_WH = "wh-live-job-tick";

function jobTickWorldWithWorkbench(opts: { wood?: number } = {}): GameState {
  const base = createInitialState("release");
  const woodAmount = opts.wood ?? 0;

  const wb: PlacedAsset = {
    id: JOB_TICK_WB,
    type: "workbench",
    x: 0,
    y: 0,
    size: 1,
  };
  const wh: PlacedAsset = {
    id: JOB_TICK_WH,
    type: "warehouse",
    x: 5,
    y: 5,
    size: 2,
  };
  const newAssets: Record<string, PlacedAsset> = {
    ...base.assets,
    [wb.id]: wb,
    [wh.id]: wh,
  };
  const wInv: Inventory = { ...base.inventory, wood: woodAmount };

  return {
    ...base,
    assets: newAssets,
    warehouseInventories: { [JOB_TICK_WH]: wInv },
    inventory: { ...base.inventory },
    buildingSourceWarehouseIds: { [JOB_TICK_WB]: JOB_TICK_WH },
  };
}

describe("applyLiveContextReducers — JOB_TICK", () => {
  it("claims the action (returns non-null state) instead of falling through", () => {
    const s = baseState();
    const action: GameAction = { type: "JOB_TICK" };

    const result = applyLiveContextReducers(s, action);

    expect(result).not.toBeNull();
  });

  it("happy path: queued job progresses to reserved after one tick", () => {
    // Mirrors the tick.test.ts single-job lifecycle precondition: an
    // empty workbench, a stocked warehouse, and a freshly enqueued job
    // must advance from `queued` → `reserved` in one JOB_TICK pass.
    let s = jobTickWorldWithWorkbench({ wood: 5 });
    s = applyLiveContextReducers(s, {
      type: "JOB_ENQUEUE",
      recipeId: "wood_pickaxe",
      workbenchId: JOB_TICK_WB,
      source: "player",
    })!;
    expect(s.crafting.jobs).toHaveLength(1);
    expect(s.crafting.jobs[0].status).toBe("queued");

    const next = applyLiveContextReducers(s, { type: "JOB_TICK" })!;

    expect(next.crafting.jobs[0].status).toBe("reserved");
    expect(next.network.reservations).toHaveLength(1);
  });

  it("empty queue: returns the input state reference unchanged", () => {
    const s = baseState();
    expect(s.crafting.jobs).toEqual([]);
    const action: GameAction = { type: "JOB_TICK" };

    const next = applyLiveContextReducers(s, action);

    // No planning trigger fires (no keep-stock targets in the seed
    // world), tickCraftingJobs short-circuits on an empty jobs list —
    // both phases return the input state reference, so the wrapper
    // hands `state` back via invalidateIfCraftingChanged's identity
    // branch (crafting === crafting).
    expect(next).toBe(s);
  });

  it("under-construction workbench: reserved job is held back from crafting", () => {
    // applyExecutionTick filters ready workbenches via
    // !deps.isUnderConstruction (tickPhases.ts:73-79), and
    // phase-promote-reserved.ts:62-65 keeps reserved jobs blocked
    // when their workbench is not in readyWorkbenchIds. JOB_ENQUEUE
    // itself rejects under-construction workbenches
    // (crafting-context.ts:239), so we enqueue against the finished
    // workbench first, run one tick (queued → reserved), then inject
    // the construction site and tick again — the reserved job must
    // NOT advance to `crafting`.
    let s = jobTickWorldWithWorkbench({ wood: 5 });
    s = applyLiveContextReducers(s, {
      type: "JOB_ENQUEUE",
      recipeId: "wood_pickaxe",
      workbenchId: JOB_TICK_WB,
      source: "player",
    })!;
    s = applyLiveContextReducers(s, { type: "JOB_TICK" })!;
    expect(s.crafting.jobs[0].status).toBe("reserved");

    s = {
      ...s,
      constructionSites: {
        ...s.constructionSites,
        [JOB_TICK_WB]: { buildingType: "workbench", remaining: { wood: 1 } },
      },
    };

    const next = applyLiveContextReducers(s, { type: "JOB_TICK" })!;

    expect(next.crafting.jobs[0].status).toBe("reserved");
  });

  it("network slice parity: every reservation references a live job after tick", () => {
    // The reservation slice must stay consistent with the crafting
    // slice: each entry in state.network.reservations should map back
    // to a job that still exists (no orphan reservations after the
    // tick wrapper runs).
    let s = jobTickWorldWithWorkbench({ wood: 5 });
    s = applyLiveContextReducers(s, {
      type: "JOB_ENQUEUE",
      recipeId: "wood_pickaxe",
      workbenchId: JOB_TICK_WB,
      source: "player",
    })!;

    const next = applyLiveContextReducers(s, { type: "JOB_TICK" })!;

    const jobIds = new Set(next.crafting.jobs.map((job) => job.id));
    for (const reservation of next.network.reservations) {
      if (reservation.ownerKind !== "crafting_job") continue;
      expect(jobIds.has(reservation.ownerId)).toBe(true);
    }
  });
});
