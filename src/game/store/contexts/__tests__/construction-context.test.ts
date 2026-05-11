import type { GameAction } from "../../game-actions";
import type { ConstructionContextState } from "../types";
import {
  CONSTRUCTION_HANDLED_ACTION_TYPES,
  constructionContext,
} from "../construction-context";

function createConstructionState(): ConstructionContextState {
  return {
    constructionSites: {},
    assets: {},
  } satisfies ConstructionContextState;
}

describe("constructionContext", () => {
  describe("reduce", () => {
    it("returns null for unrelated actions", () => {
      const state = createConstructionState();
      const action = { type: "DRONE_TICK" } satisfies GameAction;

      expect(constructionContext.reduce(state, action)).toBeNull();
    });

    it("BUILD_PLACE_BUILDING keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createConstructionState();
      const action = {
        type: "BUILD_PLACE_BUILDING",
        x: 0,
        y: 0,
      } satisfies GameAction;

      expect(constructionContext.reduce(state, action)).toBe(state);
    });

    it("BUILD_PLACE_FLOOR_TILE keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createConstructionState();
      const action = {
        type: "BUILD_PLACE_FLOOR_TILE",
        x: 0,
        y: 0,
      } satisfies GameAction;

      expect(constructionContext.reduce(state, action)).toBe(state);
    });

    it("BUILD_REMOVE_ASSET keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createConstructionState();
      const action = {
        type: "BUILD_REMOVE_ASSET",
        assetId: "asset-1",
      } satisfies GameAction;

      expect(constructionContext.reduce(state, action)).toBe(state);
    });

    it("REQUEST_DECONSTRUCT_ASSET keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createConstructionState();
      const action = {
        type: "REQUEST_DECONSTRUCT_ASSET",
        assetId: "asset-1",
      } satisfies GameAction;

      expect(constructionContext.reduce(state, action)).toBe(state);
    });

    it("CANCEL_DECONSTRUCT_ASSET keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createConstructionState();
      const action = {
        type: "CANCEL_DECONSTRUCT_ASSET",
        assetId: "asset-1",
      } satisfies GameAction;

      expect(constructionContext.reduce(state, action)).toBe(state);
    });

    it("REMOVE_BUILDING keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createConstructionState();
      const action = {
        type: "REMOVE_BUILDING",
        buildingType: "workbench",
      } satisfies GameAction;

      expect(constructionContext.reduce(state, action)).toBe(state);
    });

    it("UPGRADE_HUB keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createConstructionState();
      const action = {
        type: "UPGRADE_HUB",
        hubId: "hub-1",
      } satisfies GameAction;

      expect(constructionContext.reduce(state, action)).toBe(state);
    });

    it("LOGISTICS_TICK keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createConstructionState();
      const action = { type: "LOGISTICS_TICK" } satisfies GameAction;

      expect(constructionContext.reduce(state, action)).toBe(state);
    });
  });

  describe("handledActionTypes", () => {
    it("contains no duplicates", () => {
      const uniqueTypes = new Set(constructionContext.handledActionTypes);

      expect(uniqueTypes.size).toBe(
        constructionContext.handledActionTypes.length,
      );
    });

    it("all listed types are valid GameAction type strings", () => {
      const validTypes =
        CONSTRUCTION_HANDLED_ACTION_TYPES satisfies readonly GameAction["type"][];

      expect(constructionContext.handledActionTypes).toEqual(validTypes);
    });
  });
});
