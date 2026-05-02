import { createInitialState } from "../../store/initial-state";
import { BASE_START_IDS, hasRequiredBaseStartLayout } from "../../world/base-start-layout";
import { applyDevScene, SCENES } from "../scene-factory";
import { DEV_SCENE_IDS, DEV_SCENE_OPTIONS } from "../scene-types";

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
    expect(logistics.assets[BASE_START_IDS.serviceHub]?.type).toBe("service_hub");
    expect(power.assets).toEqual({});
    expect(assembler.assets["auto-assembler-debug"]?.type).toBe(
      "auto_assembler",
    );
  });

  it("can build every registered DevSceneId", () => {
    for (const sceneId of DEV_SCENE_IDS) {
      expect(() => applyDevScene(createInitialState("debug"), sceneId)).not.toThrow();
    }
  });
});