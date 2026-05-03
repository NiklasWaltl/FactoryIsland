// ============================================================
// CP4: module_lab reducer invariants
// ------------------------------------------------------------
// All illegal transitions must leave state unchanged (no-op).
// ============================================================

import {
  gameReducer,
  createInitialState,
  type GameAction,
  type GameState,
} from "../reducer";
import { MODULE_FRAGMENT_RECIPES } from "../../constants/moduleLabConstants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tick(state: GameState, action: GameAction): GameState {
  return gameReducer(state, action);
}

function withFragments(state: GameState, count: number): GameState {
  return { ...state, moduleFragments: count };
}

const tier1 = MODULE_FRAGMENT_RECIPES.find((r) => r.id === "module_tier1")!;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("module_lab reducer invariants", () => {
  it("START_CRAFT: no-op when fragments < required", () => {
    // tier1 costs 3 fragments; give only 2
    const state = withFragments(createInitialState("release"), 2);
    const after = tick(state, {
      type: "START_MODULE_CRAFT",
      recipeId: tier1.id,
    });

    expect(after).toBe(state); // same reference — unchanged
    expect(after.moduleLabJob).toBeNull();
    expect(after.moduleFragments).toBe(2);
  });

  it("START_CRAFT: no-op when activeJob !== null", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(10_000_000);

    try {
      let state = withFragments(createInitialState("release"), 20);
      state = tick(state, { type: "START_MODULE_CRAFT", recipeId: tier1.id });
      const firstJob = state.moduleLabJob;
      const fragmentsAfterFirst = state.moduleFragments;

      const after = tick(state, {
        type: "START_MODULE_CRAFT",
        recipeId: tier1.id,
      });

      expect(after).toBe(state); // unchanged
      expect(after.moduleLabJob).toBe(firstJob); // same job object
      expect(after.moduleFragments).toBe(fragmentsAfterFirst); // no extra cost
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("COLLECT_CRAFT: no-op when activeJob === null", () => {
    const state = createInitialState("release");
    expect(state.moduleLabJob).toBeNull();

    const after = tick(state, { type: "COLLECT_MODULE" });
    expect(after).toBe(state);
  });

  it("COLLECT_CRAFT: no-op when completesAt > Date.now()", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(11_000_000);

    try {
      let state = withFragments(createInitialState("release"), 10);
      state = tick(state, { type: "START_MODULE_CRAFT", recipeId: tier1.id });

      // Job is in "crafting" status and completesAt is in the future
      expect(state.moduleLabJob?.status).toBe("crafting");
      const completesAt =
        state.moduleLabJob!.startedAt + state.moduleLabJob!.durationMs;
      expect(completesAt).toBeGreaterThan(Date.now());

      const after = tick(state, { type: "COLLECT_MODULE" });
      expect(after).toBe(state); // no-op
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("COLLECT_CRAFT: no-op on second call after first collect", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(12_000_000);

    try {
      let state = withFragments(createInitialState("release"), 10);
      state = tick(state, { type: "START_MODULE_CRAFT", recipeId: tier1.id });

      fakeNow.mockReturnValue(12_000_000 + tier1.durationMs + 1);
      state = tick(state, { type: "MODULE_LAB_TICK" });
      state = tick(state, { type: "COLLECT_MODULE" }); // first collect

      expect(state.moduleLabJob).toBeNull();
      expect(state.moduleInventory.length).toBe(1);

      const afterSecond = tick(state, { type: "COLLECT_MODULE" }); // second collect
      expect(afterSecond).toBe(state); // no-op
      expect(afterSecond.moduleInventory.length).toBe(1);
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("COLLECT_CRAFT: no-op after state rehydration if already collected", () => {
    // After collection, moduleLabJob is null. Re-serialising and reloading
    // preserves null, so COLLECT_MODULE on rehydrated state is a no-op.
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(13_000_000);

    try {
      let state = withFragments(createInitialState("release"), 10);
      state = tick(state, { type: "START_MODULE_CRAFT", recipeId: tier1.id });

      fakeNow.mockReturnValue(13_000_000 + tier1.durationMs + 1);
      state = tick(state, { type: "MODULE_LAB_TICK" });
      state = tick(state, { type: "COLLECT_MODULE" });

      // Simulate rehydration: moduleLabJob must remain null
      const rehydrated: GameState = {
        ...state,
        moduleLabJob: state.moduleLabJob, // null after collection
      };
      expect(rehydrated.moduleLabJob).toBeNull();

      const afterCollect = tick(rehydrated, { type: "COLLECT_MODULE" });
      expect(afterCollect).toBe(rehydrated); // no-op, returns same reference
    } finally {
      fakeNow.mockRestore();
    }
  });
});
