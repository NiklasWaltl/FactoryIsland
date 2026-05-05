// ============================================================
// APPLY BASE START LAYOUT
// ------------------------------------------------------------
// Materializes the layout produced by `createBaseStartLayout` into a concrete
// `GameState`. Lives in the store/bootstrap layer because the world/layout
// module owns coordinates, bounds and IDs only — applying those onto runtime
// state (assets, hubs, warehouses, drones) is a bootstrap concern.
// ============================================================

import { createEmptyHubInventory } from "../../buildings/service-hub/hub-upgrade-workflow";
import {
  BASE_START_IDS,
  type BaseStartObjectDefinition,
  assertBaseStartLayoutInsideStartArea,
  assertRequiredBaseStartLayout,
  createBaseStartLayout,
  hasRequiredBaseStartLayout,
} from "../../world/base-start-layout";
import { createDefaultProtoHubTargetStock } from "../constants/hub/hub-target-stock";
import { createEmptyInventory } from "../inventory-ops";
import type { GameState, PlacedAsset, StarterDroneState } from "../types";
import { cellKey } from "../utils/cell-key";
import { selectStarterDrone } from "../../drones/utils/drone-state-helpers";

export function applyBaseStartLayout(state: GameState): GameState {
  if (hasRequiredBaseStartLayout(state)) return state;
  assertNoPartialBaseStartLayout(state);

  const layout = createBaseStartLayout(state.tileMap);
  const assets = { ...state.assets };
  const cellMap = { ...state.cellMap };

  for (const definition of layout.assets) {
    const asset = toPlacedAsset(definition);
    assertBaseStartCellsFree(state, cellMap, asset);
    assets[asset.id] = asset;
    forEachBaseStartCell(asset, (x, y) => {
      cellMap[cellKey(x, y)] = asset.id;
    });
  }

  const hubAsset = assets[layout.starterDroneHubId];
  if (!hubAsset) {
    throw new Error("Base start layout was resolved but not applied to initial runtime state.");
  }

  const starterDrone = createDockedStarterDrone(
    selectStarterDrone(state),
    layout.starterDroneHubId,
    hubAsset.x,
    hubAsset.y,
  );

  const next: GameState = {
    ...state,
    assets,
    cellMap,
    warehouseInventories: {
      ...state.warehouseInventories,
      [BASE_START_IDS.warehouse]: createEmptyInventory(),
    },
    serviceHubs: {
      ...state.serviceHubs,
      [BASE_START_IDS.serviceHub]: {
        tier: 1,
        inventory: createEmptyHubInventory(),
        droneIds: [starterDrone.droneId],
        targetStock: createDefaultProtoHubTargetStock(),
      },
    },
    starterDrone,
    drones: {
      ...state.drones,
      [starterDrone.droneId]: starterDrone,
    },
  };

  const withWarehouseCounts = {
    ...next,
    warehousesPurchased: Object.values(next.assets).filter(
      (asset) => asset.type === "warehouse",
    ).length,
    warehousesPlaced: Object.values(next.assets).filter(
      (asset) => asset.type === "warehouse",
    ).length,
  };

  assertRequiredBaseStartLayout(withWarehouseCounts);
  return withWarehouseCounts;
}

function assertNoPartialBaseStartLayout(state: GameState): void {
  const existingIds = Object.values(BASE_START_IDS).filter((id) => state.assets[id]);
  if (existingIds.length === 0) return;
  throw new Error(
    `Base start layout was resolved but not applied to initial runtime state: partial objects ${existingIds.join(", ")}`,
  );
}

function toPlacedAsset(definition: BaseStartObjectDefinition): PlacedAsset {
  return {
    id: definition.id,
    type: definition.type,
    x: definition.x,
    y: definition.y,
    size: definition.size,
    width: definition.width,
    height: definition.height,
    fixed: definition.fixed,
  };
}

function assertBaseStartCellsFree(
  state: GameState,
  cellMap: GameState["cellMap"],
  asset: PlacedAsset,
): void {
  forEachBaseStartCell(asset, (x, y) => {
    const occupiedBy = cellMap[cellKey(x, y)];
    if (!occupiedBy) return;
    throw new Error(
      `Base start layout object '${asset.id}' overlaps '${occupiedBy}' at row ${y} col ${x}.`,
    );
  });

  assertBaseStartLayoutInsideStartArea(
    [
      {
        id: asset.id,
        type: asset.type,
        x: asset.x,
        y: asset.y,
        size: asset.size,
        width: asset.width ?? asset.size,
        height: asset.height ?? asset.size,
        fixed: asset.fixed,
      },
    ],
    state.tileMap,
  );
}

function createDockedStarterDrone(
  starterDrone: StarterDroneState | undefined,
  hubId: string,
  tileX: number,
  tileY: number,
): StarterDroneState {
  return {
    ...(starterDrone ?? {}),
    hubId,
    tileX,
    tileY,
    status: "idle",
    targetNodeId: null,
    cargo: null,
    ticksRemaining: 0,
    currentTaskType: null,
    deliveryTargetId: null,
    craftingJobId: null,
    droneId: starterDrone?.droneId ?? "starter",
  };
}

function forEachBaseStartCell(
  asset: Pick<PlacedAsset, "x" | "y" | "size" | "width" | "height">,
  visit: (x: number, y: number) => void,
): void {
  const width = asset.width ?? asset.size;
  const height = asset.height ?? asset.size;
  for (let dx = 0; dx < width; dx += 1) {
    for (let dy = 0; dy < height; dy += 1) {
      visit(asset.x + dx, asset.y + dy);
    }
  }
}
