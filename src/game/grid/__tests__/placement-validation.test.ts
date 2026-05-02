import { createInitialState } from "../../store/initial-state";
import {
  getBuildingPreviewDimensions,
  validateBuildingPlacementPreview,
} from "../placement-validation";

describe("validateBuildingPlacementPreview", () => {
  test("rejects buildings on non-playable island tiles", () => {
    const state = createInitialState("release");
    const activeBuildingType = "workbench";
    const dimensions = getBuildingPreviewDimensions(
      activeBuildingType,
      "south",
    );

    const waterResult = validateBuildingPlacementPreview({
      state,
      x: 0,
      y: 0,
      activeBuildingType,
      buildDirection: "south",
      bWidth: dimensions.bWidth,
      bHeight: dimensions.bHeight,
    });
    const sandResult = validateBuildingPlacementPreview({
      state,
      x: 3,
      y: 3,
      activeBuildingType,
      buildDirection: "south",
      bWidth: dimensions.bWidth,
      bHeight: dimensions.bHeight,
    });
    const grassResult = validateBuildingPlacementPreview({
      state,
      x: 9,
      y: 9,
      activeBuildingType,
      buildDirection: "south",
      bWidth: dimensions.bWidth,
      bHeight: dimensions.bHeight,
    });

    expect(waterResult.valid).toBe(false);
    expect(sandResult.valid).toBe(false);
    expect(grassResult.valid).toBe(true);
  });
});
