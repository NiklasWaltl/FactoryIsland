// ============================================================
// CP4: module_lab reducer invariants
// ------------------------------------------------------------
// All illegal transitions must leave state unchanged (no-op).
// ============================================================

import {
  gameReducer,
  createInitialState,
} from "../reducer";
import type { Module } from "../../modules/module.types";
import { MODULE_FRAGMENT_RECIPES } from "../../constants/moduleLabConstants";
import type { GameAction } from "../game-actions";
import type { GameState, PlacedAsset } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tick(state: GameState, action: GameAction): GameState {
  return gameReducer(state, action);
}

function withFragments(state: GameState, count: number): GameState {
  return { ...state, moduleFragments: count };
}

function makeAsset(id: string, type: PlacedAsset["type"]): PlacedAsset {
  return { id, type, x: 7, y: 7, size: 1 };
}

function makeModule(module: Partial<Module> & Pick<Module, "id">): Module {
  return {
    type: "miner-boost",
    tier: 1,
    equippedTo: null,
    ...module,
  };
}

function withAssetsAndModules(
  state: GameState,
  assets: PlacedAsset[],
  modules: Module[],
): GameState {
  return {
    ...state,
    assets: {
      ...state.assets,
      ...Object.fromEntries(assets.map((asset) => [asset.id, asset])),
    },
    cellMap: {
      ...state.cellMap,
      ...Object.fromEntries(assets.map((asset) => [`${asset.x},${asset.y}`, asset.id])),
    },
    moduleInventory: modules,
  };
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

  it("PLACE_MODULE: no-op when target building already has a module", () => {
    const state = withAssetsAndModules(
      createInitialState("release"),
      [makeAsset("miner-1", "auto_miner")],
      [
        makeModule({ id: "module-1", equippedTo: "miner-1" }),
        makeModule({ id: "module-2" }),
      ],
    );

    const after = tick(state, {
      type: "PLACE_MODULE",
      moduleId: "module-2",
      buildingId: "miner-1",
    });

    expect(after.moduleInventory).toBe(state.moduleInventory);
    expect(after.notifications).toHaveLength(state.notifications.length + 1);
    expect(after.notifications.at(-1)?.displayName).toBe(
      "Gebäude hat bereits ein Modul eingesetzt",
    );
  });

  it("PLACE_MODULE: no-op when module type is incompatible with target building", () => {
    const state = withAssetsAndModules(
      createInitialState("release"),
      [makeAsset("miner-1", "auto_miner")],
      [makeModule({ id: "module-1", type: "smelter-boost" })],
    );

    const after = tick(state, {
      type: "PLACE_MODULE",
      moduleId: "module-1",
      buildingId: "miner-1",
    });

    expect(after.moduleInventory).toBe(state.moduleInventory);
    expect(after.notifications).toHaveLength(state.notifications.length + 1);
    expect(after.notifications.at(-1)?.displayName).toBe(
      "Dieses Modul passt nicht zu diesem Gebäude",
    );
  });

  it("PLACE_MODULE: no-op when target asset does not exist", () => {
    const state = withAssetsAndModules(createInitialState("release"), [], [
      makeModule({ id: "module-1" }),
    ]);

    const after = tick(state, {
      type: "PLACE_MODULE",
      moduleId: "module-1",
      buildingId: "missing-asset",
    });

    expect(after).toBe(state);
  });

  it("PLACE_MODULE: equips a compatible module and leaves one module on the asset", () => {
    const state = withAssetsAndModules(
      createInitialState("release"),
      [makeAsset("miner-1", "auto_miner")],
      [makeModule({ id: "module-1" }), makeModule({ id: "module-2" })],
    );

    const after = tick(state, {
      type: "PLACE_MODULE",
      moduleId: "module-1",
      buildingId: "miner-1",
    });

    expect(after.moduleInventory.find((m) => m.id === "module-1")?.equippedTo).toBe(
      "miner-1",
    );
    expect(after.moduleInventory.filter((m) => m.equippedTo === "miner-1")).toHaveLength(
      1,
    );
  });

  it("REMOVE_MODULE: no-op when module is not equipped", () => {
    const state = withAssetsAndModules(createInitialState("release"), [], [
      makeModule({ id: "module-1" }),
    ]);

    const after = tick(state, { type: "REMOVE_MODULE", moduleId: "module-1" });

    expect(after).toBe(state);
  });

  it("REMOVE_MODULE: no-op when optional assetId does not match", () => {
    const state = withAssetsAndModules(
      createInitialState("release"),
      [makeAsset("miner-1", "auto_miner")],
      [makeModule({ id: "module-1", equippedTo: "miner-1" })],
    );

    const after = tick(state, {
      type: "REMOVE_MODULE",
      moduleId: "module-1",
      assetId: "miner-2",
    } as GameAction);

    expect(after).toBe(state);
  });

  it("BUILD_REMOVE_ASSET clears equipped modules pointing at the removed building", () => {
    const state = withAssetsAndModules(
      createInitialState("release"),
      [makeAsset("miner-1", "auto_miner")],
      [
        makeModule({ id: "module-1", equippedTo: "miner-1" }),
        makeModule({ id: "module-2", equippedTo: "miner-1" }),
      ],
    );
    const removableState = { ...state, buildMode: true };

    const after = tick(removableState, {
      type: "BUILD_REMOVE_ASSET",
      assetId: "miner-1",
    });

    expect(after.assets["miner-1"]).toBeUndefined();
    expect(after.moduleInventory).toEqual([
      { ...state.moduleInventory[0], equippedTo: null },
      { ...state.moduleInventory[1], equippedTo: null },
    ]);
  });
});
