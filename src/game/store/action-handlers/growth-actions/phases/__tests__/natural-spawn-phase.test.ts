import { GRID_H, GRID_W } from "../../../../../constants/grid";
import { createInitialState } from "../../../../initial-state";
import { runNaturalSpawnPhase } from "../natural-spawn-phase";

describe("runNaturalSpawnPhase", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("Natural Spawn auf Wasser-Tile wird nicht platziert", () => {
    const state = {
      ...createInitialState("release"),
      tileMap: Array.from({ length: GRID_H }, () =>
        Array.from({ length: GRID_W }, () => "water" as const),
      ),
    };
    jest.spyOn(Math, "random").mockReturnValue(0);

    const next = runNaturalSpawnPhase({
      state,
      action: { type: "NATURAL_SPAWN" },
    });

    expect(
      Object.values(next.assets).some((asset) => asset.type === "sapling"),
    ).toBe(false);
    expect(next.cellMap["0,0"]).toBeUndefined();
  });
});
