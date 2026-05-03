import type { Module } from "../../../modules/module.types";
import {
  createInitialState,
  type GameState,
  type PlacedAsset,
} from "../../reducer";
import { getEquippedModule, getFreeModulesForType } from "../module-selectors";

function makeAutoMinerAsset(
  id: string,
  overrides: Partial<PlacedAsset> = {},
): PlacedAsset {
  return { id, type: "auto_miner", x: 4, y: 4, size: 1, ...overrides };
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
  assets: PlacedAsset[],
  modules: Module[],
): GameState {
  const base = createInitialState("release");
  return {
    ...base,
    assets: {
      ...base.assets,
      ...Object.fromEntries(assets.map((asset) => [asset.id, asset])),
    },
    moduleInventory: modules,
  };
}

describe("module selectors", () => {
  it("getEquippedModule returns null when no slot is set", () => {
    const state = withAssetsAndModules(
      [makeAutoMinerAsset("miner-1")],
      [makeModule({ id: "module-1" })],
    );

    expect(getEquippedModule(state, "miner-1")).toBeNull();
  });

  it("getEquippedModule returns the slotted module", () => {
    const module = makeModule({ id: "module-1", equippedTo: "miner-1" });
    const state = withAssetsAndModules(
      [makeAutoMinerAsset("miner-1", { moduleSlot: module.id })],
      [module],
    );

    expect(getEquippedModule(state, "miner-1")).toBe(module);
  });

  it("getFreeModulesForType filters out equipped modules", () => {
    const freeMiner = makeModule({ id: "free-miner" });
    const equippedMiner = makeModule({
      id: "equipped-miner",
      equippedTo: "miner-1",
    });
    const freeSmelter = makeModule({ id: "free-smelter", type: "smelter-boost" });
    const state = withAssetsAndModules([makeAutoMinerAsset("miner-1")], [
      freeMiner,
      equippedMiner,
      freeSmelter,
    ]);

    expect(getFreeModulesForType(state, "miner-boost")).toEqual([freeMiner]);
  });
});