import { getAutoSmelterIoCells } from "../../../store/asset-geometry";
import { createInitialState } from "../../../store/initial-state";
import { cellKey } from "../../../store/utils/cell-key";
import { directionOffset } from "../../../store/utils/direction";
import { buildSceneState } from "../../scene-builder/build-scene-state";
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

  it("keeps the second warehouse behind the auto-assembler output", () => {
    const assembler = debugSceneLayout.assets.find(
      (definition) => definition.type === "auto_assembler",
    );
    const warehouse = debugSceneLayout.assets.find(
      (definition) => definition.id === "warehouse-assembler-output",
    );

    expect(assembler).toMatchObject({ x: 65, y: 7, direction: "west" });
    expect(warehouse).toMatchObject({ x: 62, y: 7, direction: "east" });
  });

  it("routes the assembler output belt into the output warehouse", () => {
    const state = buildSceneState(debugSceneLayout, createInitialState("debug"));
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