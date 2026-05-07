import { createInitialState } from "../../store/initial-state";
import {
  BASE_START_IDS,
  hasRequiredBaseStartLayout,
} from "../../world/base-start-layout";
import { applyDevScene, SCENES } from "../scene-factory";
import { DEV_SCENE_IDS, DEV_SCENE_OPTIONS } from "../scene-types";
import { setDevAutoUnlockBuildingsEnabled } from "../../debug/debugConfig";

describe("scene-factory", () => {
  it("has a scene mapping for every DevSceneId", () => {
    expect(Object.keys(SCENES).sort()).toEqual([...DEV_SCENE_IDS].sort());
  });

  it("builds the debug scene through the central mapping", () => {
    const state = applyDevScene(createInitialState("debug"), "debug");
    const assetTypes = Object.values(state.assets).map((asset) => asset.type);

    expect(assetTypes).toContain("auto_assembler");
    expect(assetTypes).toContain("conveyor_splitter");
    expect(state.autoAssemblers["auto-assembler-debug"].selectedRecipe).toBe(
      "metal_plate",
    );
    expect(hasRequiredBaseStartLayout(state)).toBe(true);
  });

  it("builds an empty scene through the central mapping", () => {
    const state = applyDevScene(createInitialState("debug"), "empty");

    expect(Object.keys(state.assets)).toHaveLength(0);
    expect(Object.keys(state.cellMap)).toHaveLength(0);
    expect(Object.keys(state.warehouseInventories)).toHaveLength(0);
  });

  it("has a scene mapping for every visible scene option", () => {
    for (const sceneId of DEV_SCENE_OPTIONS) {
      expect(SCENES[sceneId]).toBeDefined();
    }
  });

  it("builds technical scene ids through their registered layouts", () => {
    const logistics = applyDevScene(createInitialState("debug"), "logistics");
    const power = applyDevScene(createInitialState("debug"), "power");
    const assembler = applyDevScene(createInitialState("debug"), "assembler");

    expect(logistics.assets["logistics-warehouse-in"]?.type).toBe("warehouse");
    expect(logistics.assets[BASE_START_IDS.serviceHub]?.type).toBe(
      "service_hub",
    );
    expect(power.assets).toEqual({});
    expect(assembler.assets["auto-assembler-debug"]?.type).toBe(
      "auto_assembler",
    );
  });

  it("can build every registered DevSceneId", () => {
    for (const sceneId of DEV_SCENE_IDS) {
      expect(() =>
        applyDevScene(createInitialState("debug"), sceneId),
      ).not.toThrow();
    }
  });

  describe("DEV auto-unlock toggle", () => {
    // In Jest, IS_DEV is hard-replaced with `false` (see
    // test/importMetaTransformer.js), so isDevAutoUnlockBuildingsEnabled()
    // is always false here regardless of the flag. That means buildSceneState
    // takes the OFF branch, which is exactly the path we need to verify:
    // the scene must NOT inflate `unlockedBuildings` past the baseState.
    afterEach(() => {
      setDevAutoUnlockBuildingsEnabled(true);
    });

    it("falls back to baseState.unlockedBuildings when DEV auto-unlock is off", () => {
      setDevAutoUnlockBuildingsEnabled(false);
      const baseState = createInitialState("debug");
      const state = applyDevScene(baseState, "debug");

      expect(state.unlockedBuildings).toEqual([...baseState.unlockedBuildings]);
      expect(state.unlockedBuildings).not.toContain("auto_assembler");
      expect(state.unlockedBuildings).not.toContain("module_lab");
    });

    it("setDevAutoUnlockBuildingsEnabled is a no-op outside DEV", () => {
      // Outside DEV the toggle must not flip the runtime flag — the getter
      // already gates on IS_DEV, but the setter must also refuse.
      setDevAutoUnlockBuildingsEnabled(true);
      const baseState = createInitialState("debug");
      const state = applyDevScene(baseState, "debug");

      // Same OFF behavior as above: no DEV inflation.
      expect(state.unlockedBuildings).toEqual([...baseState.unlockedBuildings]);
    });
  });
});
