import {
  CURRENT_SAVE_VERSION,
  deserializeState,
  migrateSave,
  serializeState,
  type SaveGameLatest,
} from "../save";
import {
  createInitialState,
  gameReducer,
  type GameAction,
  type GameState,
  type PlacedAsset,
} from "../../store/reducer";
import type { Module } from "../../modules/module.types";

function tick(state: GameState, action: GameAction): GameState {
  return gameReducer(state, action);
}

function makeAutoMinerAsset(id: string): PlacedAsset {
  return { id, type: "auto_miner", x: 10, y: 10, size: 1 };
}

function makeModule(module: Partial<Module> & Pick<Module, "id">): Module {
  return {
    type: "miner-boost",
    tier: 1,
    equippedTo: null,
    ...module,
  };
}

function makeV27Save(): unknown {
  const current = serializeState(
    createInitialState("release"),
  ) as unknown as Record<string, unknown>;
  const currentAssets = current.assets as Record<string, PlacedAsset>;
  const assetsWithoutSlots = Object.fromEntries(
    Object.entries(currentAssets).map(([id, asset]) => {
      const { moduleSlot: _moduleSlot, ...assetWithoutSlot } = asset;
      return [id, assetWithoutSlot];
    }),
  );

  return {
    ...current,
    version: 27,
    assets: assetsWithoutSlots,
  };
}

describe("Save v27 → v28 moduleSlot migration", () => {
  it("sets moduleSlot:null on all existing assets", () => {
    const migrated = migrateSave(makeV27Save()) as SaveGameLatest;

    expect(migrated).not.toBeNull();
    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
    expect(CURRENT_SAVE_VERSION).toBe(31);
    for (const asset of Object.values(migrated.assets)) {
      expect(asset).toHaveProperty("moduleSlot", null);
    }
  });

  it("preserves an equipped module slot across serialize/deserialize", () => {
    const minerId = "miner-1";
    const moduleId = "module-1";
    const base = createInitialState("release");
    const state: GameState = {
      ...base,
      assets: {
        ...base.assets,
        [minerId]: makeAutoMinerAsset(minerId),
      },
      autoMiners: {
        ...base.autoMiners,
        [minerId]: {
          depositId: "iron-deposit-1",
          resource: "iron",
          progress: 0,
        },
      },
      moduleInventory: [makeModule({ id: moduleId })],
    };

    const equipped = tick(state, {
      type: "PLACE_MODULE",
      moduleId,
      assetId: minerId,
    });
    expect(equipped.assets[minerId].moduleSlot).toBe(moduleId);

    const saved = serializeState(equipped);
    const loaded = deserializeState(saved);

    expect(loaded.assets[minerId].moduleSlot).toBe(moduleId);
    expect(
      loaded.moduleInventory.find((module) => module.id === moduleId)
        ?.equippedTo,
    ).toBe(minerId);
  });
});
