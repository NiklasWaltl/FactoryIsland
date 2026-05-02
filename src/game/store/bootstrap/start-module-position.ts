// ============================================================
// START MODULE POSITION
// ------------------------------------------------------------
// Encapsulates the "where does the start module sit?" lookup so that callers
// stop reaching for the legacy `MAP_SHOP_POS` constant directly.
//
// Resolution priority:
//   1. The materialized base-start map-shop asset (BASE_START_IDS.mapShop)
//   2. The current tileMap's start-area anchor, when a tileMap is available
//   3. The legacy MAP_SHOP_POS as a last-resort fallback
// ============================================================

import { BASE_START_IDS } from "../../world/base-start-layout";
import { getStartAreaAnchor } from "../../world/core-layout";
import type { TileType } from "../../world/tile-types";
import { MAP_SHOP_POS } from "../constants/map/map-layout";
import type { GameState } from "../types";

export interface StartModulePosition {
  readonly x: number;
  readonly y: number;
}

export function getStartModulePosition(
  state: Pick<GameState, "assets" | "tileMap">,
): StartModulePosition {
  const mapShop = state.assets?.[BASE_START_IDS.mapShop];
  if (mapShop) {
    return { x: mapShop.x, y: mapShop.y };
  }

  const anchor = tryStartAreaAnchor(state.tileMap);
  if (anchor) {
    return { x: anchor.col, y: anchor.row };
  }

  return { x: MAP_SHOP_POS.x, y: MAP_SHOP_POS.y };
}

function tryStartAreaAnchor(
  tileMap: TileType[][] | undefined,
): { row: number; col: number } | null {
  if (!tileMap || tileMap.length === 0 || (tileMap[0]?.length ?? 0) === 0) {
    return null;
  }
  try {
    return getStartAreaAnchor(tileMap);
  } catch {
    return null;
  }
}
