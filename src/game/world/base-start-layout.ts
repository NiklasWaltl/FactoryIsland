import type { AssetType, GameState } from "../store/types";
import { selectStarterDrone } from "../store/selectors/drone-selectors";
import {
  getStartAreaAnchor,
  getStartAreaBounds,
  isBoundsInsideBounds,
  type TileBounds,
} from "./core-layout";
import type { TileType } from "./tile-types";

export const BASE_START_IDS = {
  mapShop: "map-shop",
  serviceHub: "service-hub-proto",
  warehouse: "warehouse-starter",
} as const;

const BASE_START_OBJECT_SIZE_TILES = 2;

const BASE_START_OFFSETS = {
  mapShop: { row: -1, col: -1 },
  serviceHub: { row: -1, col: 2 },
  warehouse: { row: -3, col: -1 },
} as const;

export interface BaseStartObjectDefinition {
  readonly id: string;
  readonly type: AssetType;
  readonly x: number;
  readonly y: number;
  readonly size: 1 | 2;
  readonly width: 1 | 2;
  readonly height: 1 | 2;
  readonly fixed?: boolean;
  readonly droneIds?: readonly string[];
}

export interface BaseStartLayout {
  readonly assets: readonly BaseStartObjectDefinition[];
  readonly starterHubId: string;
}

export function createBaseStartLayout(tileMap: TileType[][]): BaseStartLayout {
  const anchor = getStartAreaAnchor(tileMap);
  const at = (offset: { readonly row: number; readonly col: number }) => ({
    x: anchor.col + offset.col,
    y: anchor.row + offset.row,
  });

  const mapShop = at(BASE_START_OFFSETS.mapShop);
  const hub = at(BASE_START_OFFSETS.serviceHub);
  const starterWarehouse = at(BASE_START_OFFSETS.warehouse);

  const layout: BaseStartLayout = {
    assets: [
      baseStartObject(
        BASE_START_IDS.mapShop,
        "map_shop",
        mapShop.x,
        mapShop.y,
        {
          fixed: true,
        },
      ),
      baseStartObject(BASE_START_IDS.serviceHub, "service_hub", hub.x, hub.y, {
        fixed: true,
        droneIds: ["starter"],
      }),
      baseStartObject(
        BASE_START_IDS.warehouse,
        "warehouse",
        starterWarehouse.x,
        starterWarehouse.y,
      ),
    ],
    starterHubId: BASE_START_IDS.serviceHub,
  };

  assertBaseStartLayoutInsideStartArea(layout.assets, tileMap);
  return layout;
}

export function hasRequiredBaseStartLayout(state: GameState): boolean {
  return (
    state.assets[BASE_START_IDS.mapShop]?.type === "map_shop" &&
    state.assets[BASE_START_IDS.serviceHub]?.type === "service_hub" &&
    state.assets[BASE_START_IDS.warehouse]?.type === "warehouse" &&
    !!state.warehouseInventories[BASE_START_IDS.warehouse] &&
    !!state.serviceHubs[BASE_START_IDS.serviceHub] &&
    selectStarterDrone(state)?.hubId === BASE_START_IDS.serviceHub &&
    state.drones.starter?.hubId === BASE_START_IDS.serviceHub
  );
}

export function assertRequiredBaseStartLayout(state: GameState): void {
  if (!hasRequiredBaseStartLayout(state)) {
    throw new Error(
      "Fresh game state missing required base start layout objects.",
    );
  }
}

export function assertBaseStartLayoutInsideStartArea(
  assets: readonly BaseStartObjectDefinition[],
  tileMap: TileType[][],
): void {
  const startArea = getStartAreaBounds(tileMap);
  for (const definition of assets) {
    assertAssetFootprintInsideStartArea(definition, startArea);
  }
}

function baseStartObject(
  id: string,
  type: AssetType,
  x: number,
  y: number,
  options: Pick<BaseStartObjectDefinition, "fixed" | "droneIds"> = {},
): BaseStartObjectDefinition {
  return {
    id,
    type,
    x,
    y,
    size: BASE_START_OBJECT_SIZE_TILES,
    width: BASE_START_OBJECT_SIZE_TILES,
    height: BASE_START_OBJECT_SIZE_TILES,
    ...options,
  };
}

function assertAssetFootprintInsideStartArea(
  definition: BaseStartObjectDefinition,
  startArea: TileBounds,
): void {
  const footprint: TileBounds = {
    row: definition.y,
    col: definition.x,
    width: definition.width,
    height: definition.height,
  };

  if (isBoundsInsideBounds(footprint, startArea)) return;

  for (
    let row = footprint.row;
    row < footprint.row + footprint.height;
    row += 1
  ) {
    for (
      let col = footprint.col;
      col < footprint.col + footprint.width;
      col += 1
    ) {
      if (
        row < startArea.row ||
        row >= startArea.row + startArea.height ||
        col < startArea.col ||
        col >= startArea.col + startArea.width
      ) {
        throw new Error(
          `Starter layout object placed outside start area at row ${row} col ${col}`,
        );
      }
    }
  }
}
