import { getAutoSmelterIoCells } from "../../../store/asset-geometry";
import { createInitialState } from "../../../store/initial-state";
import { cellKey } from "../../../store/utils/cell-key";
import { directionOffset } from "../../../store/utils/direction";
import {
  getStartAreaBounds,
  isBoundsInsideBounds,
} from "../../../world/core-layout";
import {
  FIXED_RESOURCE_LAYOUT,
  getFixedResourceOriginByType,
  isFixedResourceAssetType,
} from "../../../world/fixed-resource-layout";
import { buildSceneState } from "../../scene-builder/build-scene-state";
import { BASE_START_IDS } from "../../../world/base-start-layout";
import { getSceneAssetDimensions } from "../../scene-builder/place-asset";
import { debugSceneLayout } from "../debug-scene.layout";

describe("debugSceneLayout", () => {
  it("uses unique resource and asset IDs", () => {
    const ids = [
      ...(debugSceneLayout.resources ?? []).map((definition) => definition.id),
      ...debugSceneLayout.assets.map((definition) => definition.id),
    ];

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not duplicate fixed deposit positions in scene resources", () => {
    const fixedResources = (debugSceneLayout.resources ?? []).filter(
      (definition) => isFixedResourceAssetType(definition.resourceType),
    );

    expect(fixedResources).toHaveLength(0);
  });

  it("inherits fixed deposits from the canonical layout", () => {
    const state = buildSceneState(
      debugSceneLayout,
      createInitialState("debug"),
    );

    for (const origin of FIXED_RESOURCE_LAYOUT) {
      expect(state.assets[origin.id]).toMatchObject({
        type: origin.type,
        x: origin.col,
        y: origin.row,
        fixed: true,
      });
    }
  });

  it("places the debug auto-miner on the canonical iron deposit", () => {
    const ironDeposit = getFixedResourceOriginByType("iron_deposit");
    const autoMiner = debugSceneLayout.assets.find(
      (definition) => definition.id === "auto-miner-iron",
    );

    expect(autoMiner).toMatchObject({
      x: ironDeposit.col,
      y: ironDeposit.row,
      resourceId: ironDeposit.id,
    });
  });

  it("builds starter objects from the central start layout", () => {
    const state = buildSceneState(
      debugSceneLayout,
      createInitialState("debug"),
    );
    const startArea = getStartAreaBounds(state.tileMap);

    expect(
      debugSceneLayout.assets.some(
        (asset) => asset.id === BASE_START_IDS.mapShop,
      ),
    ).toBe(false);
    expect(state.assets[BASE_START_IDS.mapShop]).toMatchObject({
      type: "map_shop",
      fixed: true,
    });
    expect(state.assets[BASE_START_IDS.serviceHub]).toMatchObject({
      type: "service_hub",
      fixed: true,
    });
    expect(state.assets[BASE_START_IDS.warehouse]).toMatchObject({
      type: "warehouse",
    });
    expect(state.drones.starter.hubId).toBe(BASE_START_IDS.serviceHub);

    for (const id of Object.values(BASE_START_IDS)) {
      const starterAsset = state.assets[id];
      const dimensions = getSceneAssetDimensions(starterAsset);
      expect(
        isBoundsInsideBounds(
          {
            row: starterAsset.y,
            col: starterAsset.x,
            width: dimensions.width,
            height: dimensions.height,
          },
          startArea,
        ),
      ).toBe(true);
    }
  });

  it("keeps the second warehouse behind the auto-assembler output", () => {
    const ironDeposit = getFixedResourceOriginByType("iron_deposit");
    const assembler = debugSceneLayout.assets.find(
      (definition) => definition.type === "auto_assembler",
    );
    const warehouse = debugSceneLayout.assets.find(
      (definition) => definition.id === "warehouse-assembler-output",
    );

    expect(assembler).toMatchObject({
      x: ironDeposit.col - 10,
      y: ironDeposit.row + 5,
      direction: "west",
    });
    expect(warehouse).toMatchObject({
      x: ironDeposit.col - 13,
      y: ironDeposit.row + 5,
      direction: "east",
    });
  });

  it("routes the assembler output belt into the output warehouse", () => {
    const state = buildSceneState(
      debugSceneLayout,
      createInitialState("debug"),
    );
    const assembler = state.assets["auto-assembler-debug"];
    const outputWarehouse = state.assets["warehouse-assembler-output"];
    const io = getAutoSmelterIoCells(assembler);
    const outputBeltId = state.cellMap[cellKey(io.output.x, io.output.y)];
    const outputBelt = state.assets[outputBeltId];
    const [dx, dy] = directionOffset(outputBelt.direction ?? "east");

    expect(outputBelt.type).toBe("conveyor");
    expect(state.cellMap[cellKey(outputBelt.x + dx, outputBelt.y + dy)]).toBe(
      outputWarehouse.id,
    );
  });

  it("has no overlapping one-cell scene assets", () => {
    const occupied = new Map<string, string>();

    for (const definition of debugSceneLayout.assets) {
      const dimensions = getSceneAssetDimensions(definition);
      if (dimensions.width !== 1 || dimensions.height !== 1) continue;

      const key = `${definition.x},${definition.y}`;
      const existing = occupied.get(key);
      expect(existing).toBeUndefined();
      occupied.set(key, definition.id);
    }
  });
});
