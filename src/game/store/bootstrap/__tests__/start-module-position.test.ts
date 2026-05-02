import { GRID_H, GRID_W } from "../../../constants/grid";
import { generateIslandTileMap } from "../../../world/island-generator";
import {
  BASE_START_IDS,
  createBaseStartLayout,
} from "../../../world/base-start-layout";
import { getStartAreaAnchor } from "../../../world/core-layout";
import { createInitialState } from "../../initial-state";
import type { GameState, PlacedAsset } from "../../types";
import { getStartModulePosition } from "../start-module-position";

describe("getStartModulePosition", () => {
  it("uses the materialized base-start map shop when present", () => {
    const state = createInitialState("release");
    const mapShop = state.assets[BASE_START_IDS.mapShop];

    const position = getStartModulePosition(state);

    expect(position).toEqual({ x: mapShop.x, y: mapShop.y });
  });

  it("falls back to the start-area anchor when the map shop asset is missing", () => {
    const state = createInitialState("release");
    const layout = createBaseStartLayout(state.tileMap);
    const expectedAnchor = getStartAreaAnchor(state.tileMap);

    const assetsWithoutMapShop: Record<string, PlacedAsset> = { ...state.assets };
    delete assetsWithoutMapShop[BASE_START_IDS.mapShop];

    const position = getStartModulePosition({
      assets: assetsWithoutMapShop,
      tileMap: state.tileMap,
    });

    expect(position).toEqual({ x: expectedAnchor.col, y: expectedAnchor.row });

    // Sanity: the layout's mapShop is offset from the anchor, so the fallback
    // is genuinely a different position than the materialized asset would give.
    const layoutMapShop = layout.assets.find(
      (asset) => asset.id === BASE_START_IDS.mapShop,
    );
    expect(layoutMapShop).toBeDefined();
    expect(position).not.toEqual({ x: layoutMapShop!.x, y: layoutMapShop!.y });
  });

  it("falls back to grid-center literal {x:39,y:24} when neither asset nor tileMap are usable", () => {
    const tileMap = generateIslandTileMap(GRID_H, GRID_W);
    const tinyUnplayableMap = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => "water" as const),
    );

    expect(
      getStartModulePosition({ assets: {}, tileMap: tinyUnplayableMap }),
    ).toEqual({ x: 39, y: 24 });

    expect(
      getStartModulePosition({
        assets: {},
        tileMap: [] as unknown as GameState["tileMap"],
      }),
    ).toEqual({ x: 39, y: 24 });

    // Sanity: a real tileMap on its own does NOT fall through to the literal.
    const anchor = getStartAreaAnchor(tileMap);
    expect(getStartModulePosition({ assets: {}, tileMap })).toEqual({
      x: anchor.col,
      y: anchor.row,
    });
  });
});
