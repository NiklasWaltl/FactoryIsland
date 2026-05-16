import type { GameAction } from "../../game-actions";
import type { PlacedAsset } from "../../types";
import type { ConstructionContextState } from "../types";
import {
  CONSTRUCTION_HANDLED_ACTION_TYPES,
  constructionContext,
} from "../construction-context";

function createConstructionState(
  overrides: Partial<ConstructionContextState> = {},
): ConstructionContextState {
  return {
    constructionSites: {},
    assets: {},
    ...overrides,
  } satisfies ConstructionContextState;
}

function makeAsset(
  overrides: Partial<PlacedAsset> & Pick<PlacedAsset, "id" | "type">,
): PlacedAsset {
  return {
    x: 0,
    y: 0,
    size: 1,
    ...overrides,
  } as PlacedAsset;
}

function expectHandled(
  result: ConstructionContextState | null,
): ConstructionContextState {
  expect(result).not.toBeNull();
  if (result === null) throw new Error("Expected construction action handled");
  return result;
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

    it("REQUEST_DECONSTRUCT_ASSET marks the asset as deconstructing and stamps the next sequence", () => {
      const state = createConstructionState({
        assets: { "asset-1": makeAsset({ id: "asset-1", type: "workbench" }) },
      });
      const action = {
        type: "REQUEST_DECONSTRUCT_ASSET",
        assetId: "asset-1",
      } satisfies GameAction;

      const next = expectHandled(constructionContext.reduce(state, action));

      expect(next.assets["asset-1"]?.status).toBe("deconstructing");
      expect(next.assets["asset-1"]?.deconstructRequestSeq).toBe(1);
    });

    it("REQUEST_DECONSTRUCT_ASSET assigns a strictly increasing sequence when other assets are already deconstructing", () => {
      const state = createConstructionState({
        assets: {
          "asset-1": makeAsset({
            id: "asset-1",
            type: "workbench",
            status: "deconstructing",
            deconstructRequestSeq: 7,
          }),
          "asset-2": makeAsset({ id: "asset-2", type: "workbench" }),
        },
      });
      const action = {
        type: "REQUEST_DECONSTRUCT_ASSET",
        assetId: "asset-2",
      } satisfies GameAction;

      const next = expectHandled(constructionContext.reduce(state, action));

      expect(next.assets["asset-2"]?.deconstructRequestSeq).toBe(8);
    });

    it("REQUEST_DECONSTRUCT_ASSET is a no-op when the asset is missing", () => {
      const state = createConstructionState();
      const action = {
        type: "REQUEST_DECONSTRUCT_ASSET",
        assetId: "missing",
      } satisfies GameAction;

      expect(constructionContext.reduce(state, action)).toBe(state);
    });

    it("REQUEST_DECONSTRUCT_ASSET is a no-op when the asset is already deconstructing", () => {
      const state = createConstructionState({
        assets: {
          "asset-1": makeAsset({
            id: "asset-1",
            type: "workbench",
            status: "deconstructing",
            deconstructRequestSeq: 3,
          }),
        },
      });
      const action = {
        type: "REQUEST_DECONSTRUCT_ASSET",
        assetId: "asset-1",
      } satisfies GameAction;

      expect(constructionContext.reduce(state, action)).toBe(state);
    });

    it("CANCEL_DECONSTRUCT_ASSET clears status and deconstructRequestSeq", () => {
      const state = createConstructionState({
        assets: {
          "asset-1": makeAsset({
            id: "asset-1",
            type: "workbench",
            status: "deconstructing",
            deconstructRequestSeq: 4,
          }),
        },
      });
      const action = {
        type: "CANCEL_DECONSTRUCT_ASSET",
        assetId: "asset-1",
      } satisfies GameAction;

      const next = expectHandled(constructionContext.reduce(state, action));

      expect(next.assets["asset-1"]?.status).toBeUndefined();
      expect(next.assets["asset-1"]?.deconstructRequestSeq).toBeUndefined();
    });

    it("CANCEL_DECONSTRUCT_ASSET is a no-op when no deconstruct is in flight", () => {
      const state = createConstructionState({
        assets: { "asset-1": makeAsset({ id: "asset-1", type: "workbench" }) },
      });
      const action = {
        type: "CANCEL_DECONSTRUCT_ASSET",
        assetId: "asset-1",
      } satisfies GameAction;

      expect(constructionContext.reduce(state, action)).toBe(state);
    });

    it("CANCEL_DECONSTRUCT_ASSET is a no-op when the asset is missing", () => {
      const state = createConstructionState();
      const action = {
        type: "CANCEL_DECONSTRUCT_ASSET",
        assetId: "missing",
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
