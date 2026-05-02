import { decideAutoMinerPlacementEligibility } from "../decisions/build-auto-miner-placement-eligibility";
import { generateIslandTileMap } from "../../world/island-generator";

const tileMap = generateIslandTileMap(20, 20);

describe("decideAutoMinerPlacementEligibility", () => {
  test("returns eligible for a valid unclaimed deposit", () => {
    const decision = decideAutoMinerPlacementEligibility({
      x: 10,
      y: 10,
      tileMap,
      cellMap: { "10,10": "dep-1" },
      assets: {
        "dep-1": {
          id: "dep-1",
          type: "iron_deposit",
          x: 10,
          y: 10,
          size: 2,
          fixed: true,
        },
      },
      autoMiners: {},
      depositTypes: new Set([
        "stone_deposit",
        "iron_deposit",
        "copper_deposit",
      ]),
    });

    expect(decision).toEqual({ kind: "eligible" });
  });

  test("returns blocked when deposit already has an auto-miner", () => {
    const decision = decideAutoMinerPlacementEligibility({
      x: 10,
      y: 10,
      tileMap,
      cellMap: { "10,10": "dep-1" },
      assets: {
        "dep-1": {
          id: "dep-1",
          type: "iron_deposit",
          x: 10,
          y: 10,
          size: 2,
          fixed: true,
        },
      },
      autoMiners: {
        "miner-1": { depositId: "dep-1" },
      },
      depositTypes: new Set([
        "stone_deposit",
        "iron_deposit",
        "copper_deposit",
      ]),
    });

    expect(decision).toEqual({
      kind: "blocked",
      blockReason: "deposit_already_has_auto_miner",
    });
  });

  test("returns blocked when target tile is not playable", () => {
    const decision = decideAutoMinerPlacementEligibility({
      x: 0,
      y: 0,
      tileMap,
      cellMap: { "0,0": "dep-1" },
      assets: {
        "dep-1": {
          id: "dep-1",
          type: "iron_deposit",
          x: 0,
          y: 0,
          size: 2,
          fixed: true,
        },
      },
      autoMiners: {},
      depositTypes: new Set([
        "stone_deposit",
        "iron_deposit",
        "copper_deposit",
      ]),
    });

    expect(decision).toEqual({
      kind: "blocked",
      blockReason: "target_cell_not_playable",
    });
  });
});
