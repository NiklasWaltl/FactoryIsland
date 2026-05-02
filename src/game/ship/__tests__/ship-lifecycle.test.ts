// ============================================================
// Ship Quest Loop — Lifecycle & Reward Tests
// ============================================================

import { gameReducer, createInitialState } from "../../store/reducer";
import { DOCK_WAREHOUSE_ID } from "../../store/bootstrap/apply-dock-warehouse-layout";
import { computeQualityMultiplier } from "../../store/action-handlers/ship-actions";
import { drawReward } from "../reward-table";

// ---- helpers -------------------------------------------------------

function freshState() {
  return createInitialState("release");
}

function dispatch(state: ReturnType<typeof freshState>, ...actions: Parameters<typeof gameReducer>[1][]) {
  let s = state;
  for (const a of actions) {
    s = gameReducer(s, a);
  }
  return s;
}

// Force the ship into "docked" state by sending SHIP_DOCK
function dockedState() {
  return dispatch(freshState(), { type: "SHIP_DOCK" });
}

function withQuestCargo(state: ReturnType<typeof freshState>) {
  const quest = state.ship.activeQuest!;
  return {
    ...state,
    warehouseInventories: {
      ...state.warehouseInventories,
      [DOCK_WAREHOUSE_ID]: {
        ...state.warehouseInventories[DOCK_WAREHOUSE_ID],
        [quest.itemId]: quest.amount,
      },
    },
  };
}

// ---- Status transition tests ----------------------------------------

describe("ship status transitions", () => {
  it("starts in sailing status", () => {
    const state = freshState();
    expect(state.ship.status).toBe("sailing");
  });

  it("SHIP_DOCK → docked, nextQuest set", () => {
    const state = dispatch(freshState(), { type: "SHIP_DOCK" });
    expect(state.ship.status).toBe("docked");
    expect(state.ship.activeQuest).not.toBeNull();
    expect(state.ship.nextQuest).not.toBeNull();
  });

  it("SHIP_DOCK sets dockedAt and departsAt (+2 min)", () => {
    const before = Date.now();
    const state = dispatch(freshState(), { type: "SHIP_DOCK" });
    const after = Date.now();

    expect(state.ship.dockedAt).not.toBeNull();
    expect(state.ship.dockedAt!).toBeGreaterThanOrEqual(before);
    expect(state.ship.dockedAt!).toBeLessThanOrEqual(after);

    const DOCK_WAIT_MS = 2 * 60 * 1_000;
    expect(state.ship.departsAt).not.toBeNull();
    expect(state.ship.departsAt! - state.ship.dockedAt!).toBeCloseTo(DOCK_WAIT_MS, -2);
  });

  it("SHIP_DEPART → sailing, rewardPending true when cargo was delivered", () => {
    let state = dispatch(freshState(), { type: "SHIP_DOCK" });
    const quest = state.ship.activeQuest!;
    state = {
      ...state,
      warehouseInventories: {
        ...state.warehouseInventories,
        [DOCK_WAREHOUSE_ID]: {
          ...state.warehouseInventories[DOCK_WAREHOUSE_ID],
          [quest.itemId]: quest.amount,
        },
      },
    };
    state = dispatch(state, { type: "SHIP_DEPART" });
    expect(state.ship.status).toBe("sailing");
    expect(state.ship.rewardPending).toBe(true);
  });

  it("SHIP_RETURN → sailing, rewardPending false, lastReward set", () => {
    let state = dispatch(freshState(), { type: "SHIP_DOCK" });
    const quest = state.ship.activeQuest!;
    state = {
      ...state,
      warehouseInventories: {
        ...state.warehouseInventories,
        [DOCK_WAREHOUSE_ID]: {
          ...state.warehouseInventories[DOCK_WAREHOUSE_ID],
          [quest.itemId]: quest.amount,
        },
      },
    };
    state = dispatch(state, { type: "SHIP_DEPART" }, { type: "SHIP_RETURN" });
    expect(state.ship.status).toBe("sailing");
    expect(state.ship.rewardPending).toBe(false);
    expect(state.ship.lastReward).not.toBeNull();
  });

  it("full cycle: sailing → docked → sailing → sailing", () => {
    let state = freshState();
    expect(state.ship.status).toBe("sailing");

    state = dispatch(state, { type: "SHIP_DOCK" });
    expect(state.ship.status).toBe("docked");

    const quest = state.ship.activeQuest!;
    state = {
      ...state,
      warehouseInventories: {
        ...state.warehouseInventories,
        [DOCK_WAREHOUSE_ID]: {
          ...state.warehouseInventories[DOCK_WAREHOUSE_ID],
          [quest.itemId]: quest.amount,
        },
      },
    };

    state = dispatch(state, { type: "SHIP_DEPART" });
    expect(state.ship.status).toBe("sailing");
    expect(state.ship.rewardPending).toBe(true);

    state = dispatch(state, { type: "SHIP_RETURN" });
    expect(state.ship.status).toBe("sailing");
    expect(state.ship.rewardPending).toBe(false);
  });
});

// ---- nextQuest already set at SHIP_DOCK ----------------------------

describe("SHIP_DOCK quest preview", () => {
  it("nextQuest is set at the same time as activeQuest", () => {
    const state = dispatch(freshState(), { type: "SHIP_DOCK" });
    expect(state.ship.nextQuest).not.toBeNull();
    expect(state.ship.nextQuest).toMatchObject({ phase: 1 });
  });
});

// ---- Quality multiplier tests --------------------------------------

describe("computeQualityMultiplier", () => {
  it("exactly 100% → 1x", () => {
    expect(computeQualityMultiplier(10, 10)).toBe(1);
  });

  it("exactly 150% → 2x", () => {
    expect(computeQualityMultiplier(15, 10)).toBe(2);
  });

  it("exactly 200% → 3x", () => {
    expect(computeQualityMultiplier(20, 10)).toBe(3);
  });

  it("above 200% → 3x", () => {
    expect(computeQualityMultiplier(99, 10)).toBe(3);
  });

  it("below 100% → 1x (partial delivery)", () => {
    expect(computeQualityMultiplier(5, 10)).toBe(1);
  });

  it("zero required → 0x (no-quest guard)", () => {
    expect(computeQualityMultiplier(0, 0)).toBe(0);
  });

  it("between 100% and 150% → 1x", () => {
    expect(computeQualityMultiplier(12, 10)).toBe(1);
  });

  it("between 150% and 200% → 2x", () => {
    expect(computeQualityMultiplier(18, 10)).toBe(2);
  });
});

// ---- Dock warehouse cleared on SHIP_DEPART -------------------------

describe("SHIP_DEPART clears dock warehouse", () => {
  it("dock warehouse inventory is empty after departure", () => {
    // Put items in dock warehouse
    let state = dispatch(freshState(), { type: "SHIP_DOCK" });
    // Manually put some items in the dock warehouse inventory
    state = {
      ...state,
      warehouseInventories: {
        ...state.warehouseInventories,
        [DOCK_WAREHOUSE_ID]: {
          ...state.warehouseInventories[DOCK_WAREHOUSE_ID],
          wood: 20,
          stone: 10,
        },
      },
    };

    state = dispatch(state, { type: "SHIP_DEPART" });

    const inv = state.warehouseInventories[DOCK_WAREHOUSE_ID];
    expect(inv.wood ?? 0).toBe(0);
    expect(inv.stone ?? 0).toBe(0);
    expect(inv.coins ?? 0).toBe(0);
  });
});

// ---- pendingMultiplier stored at SHIP_DEPART, used at SHIP_RETURN --

describe("pendingMultiplier flow", () => {
  it("pendingMultiplier=3 when dock inventory is >=200% of quest", () => {
    let state = dispatch(freshState(), { type: "SHIP_DOCK" });
    const quest = state.ship.activeQuest!;

    state = {
      ...state,
      warehouseInventories: {
        ...state.warehouseInventories,
        [DOCK_WAREHOUSE_ID]: {
          ...state.warehouseInventories[DOCK_WAREHOUSE_ID],
          [quest.itemId]: quest.amount * 2,
        },
      },
    };

    state = dispatch(state, { type: "SHIP_DEPART" });
    expect(state.ship.pendingMultiplier).toBe(3);
  });

  it("pendingMultiplier=2 when dock inventory is >=150% of quest", () => {
    let state = dispatch(freshState(), { type: "SHIP_DOCK" });
    const quest = state.ship.activeQuest!;

    state = {
      ...state,
      warehouseInventories: {
        ...state.warehouseInventories,
        [DOCK_WAREHOUSE_ID]: {
          ...state.warehouseInventories[DOCK_WAREHOUSE_ID],
          [quest.itemId]: Math.ceil(quest.amount * 1.5),
        },
      },
    };

    state = dispatch(state, { type: "SHIP_DEPART" });
    expect(state.ship.pendingMultiplier).toBe(2);
  });
});

// ---- drawReward distribution test (1000 draws) ---------------------

describe("drawReward distribution over 1000 draws", () => {
  const DRAWS = 1_000;

  function runDraws(multiplier: 1 | 2 | 3, phase: number) {
    const counts: Record<string, number> = {};
    for (let i = 0; i < DRAWS; i++) {
      const reward = drawReward(multiplier, phase);
      counts[reward.kind] = (counts[reward.kind] ?? 0) + 1;
    }
    return counts;
  }

  it("all 5 reward categories appear", () => {
    const counts = runDraws(1, 1);
    expect(counts["coins"]).toBeDefined();
    expect(counts["basic_resource"]).toBeDefined();
    expect(counts["rare_resource"]).toBeDefined();
    expect(counts["module_fragment"]).toBeDefined();
    expect(counts["complete_module"]).toBeDefined();
  });

  it("no category exceeds 70%", () => {
    const counts = runDraws(1, 1);
    for (const [kind, count] of Object.entries(counts)) {
      expect(count / DRAWS).toBeLessThan(0.70),
        `${kind} appeared ${count}/${DRAWS} times (>${0.70 * 100}%)`;
    }
  });

  it("no category is below 1%", () => {
    const counts = runDraws(1, 1);
    const CATEGORIES = ["coins", "basic_resource", "rare_resource", "module_fragment", "complete_module"];
    for (const kind of CATEGORIES) {
      const count = counts[kind] ?? 0;
      expect(count / DRAWS).toBeGreaterThanOrEqual(0.01),
        `${kind} appeared ${count}/${DRAWS} times (<1%)`;
    }
  });
});

// ---- shipsSinceLastFragment counter --------------------------------

describe("shipsSinceLastFragment counter", () => {
  it("increments on SHIP_DEPART", () => {
    const state = dispatch(freshState(), { type: "SHIP_DOCK" }, { type: "SHIP_DEPART" });
    expect(state.ship.shipsSinceLastFragment).toBe(1);
  });

  it("resets to 0 on fragment drop (module_fragment)", () => {
    // Force a fragment reward by injecting a state where the reward will be a fragment
    // We do this by mocking Math.random to trigger the fragment bucket
    const origRandom = Math.random;
    // Fragment sits at weight 90–98 (bucket starts at 90, ends at 98)
    // Roll 0.935 * 100 = 93.5 → hits module_fragment bucket
    Math.random = () => 0.935;
    try {
      let state = withQuestCargo(dispatch(freshState(), { type: "SHIP_DOCK" }));
      state = dispatch(state, { type: "SHIP_DEPART" });
      expect(state.ship.shipsSinceLastFragment).toBe(1);

      state = dispatch(state, { type: "SHIP_RETURN" });
      expect(state.ship.lastReward?.kind).toBe("module_fragment");
      expect(state.ship.shipsSinceLastFragment).toBe(0);
    } finally {
      Math.random = origRandom;
    }
  });

  it("does NOT reset to 0 on coins drop", () => {
    const origRandom = Math.random;
    // Roll 0.25 → hits coins bucket (0–50)
    Math.random = () => 0.25;
    try {
      let state = withQuestCargo(dispatch(freshState(), { type: "SHIP_DOCK" }));
      state = dispatch(state, { type: "SHIP_DEPART" });
      state = dispatch(state, { type: "SHIP_RETURN" });
      expect(state.ship.lastReward?.kind).toBe("coins");
      expect(state.ship.shipsSinceLastFragment).toBeGreaterThan(0);
    } finally {
      Math.random = origRandom;
    }
  });

  it("resets to 0 on complete_module drop", () => {
    const origRandom = Math.random;
    // complete_module is at weight 98–100. Roll 0.99 → 99 → complete_module
    Math.random = () => 0.99;
    try {
      let state = withQuestCargo(dispatch(freshState(), { type: "SHIP_DOCK" }));
      state = dispatch(state, { type: "SHIP_DEPART" });
      state = dispatch(state, { type: "SHIP_RETURN" });
      expect(state.ship.lastReward?.kind).toBe("complete_module");
      expect(state.ship.shipsSinceLastFragment).toBe(0);
    } finally {
      Math.random = origRandom;
    }
  });
});
