import type { GameAction } from "../game-actions";
import type { PlacedAsset } from "../types";
import type { BoundedContext, ConstructionContextState } from "./types";

function getNextDeconstructRequestSeq(
  assets: Readonly<Record<string, PlacedAsset>>,
): number {
  let maxSeq = 0;
  for (const asset of Object.values(assets)) {
    if (asset.status !== "deconstructing") continue;
    if ((asset.deconstructRequestSeq ?? 0) > maxSeq) {
      maxSeq = asset.deconstructRequestSeq ?? 0;
    }
  }
  return maxSeq + 1;
}

function markAssetAsDeconstructing(
  state: ConstructionContextState,
  assetId: string,
): ConstructionContextState {
  const targetAsset = state.assets[assetId];
  if (!targetAsset || targetAsset.status === "deconstructing") return state;
  const nextDeconstructRequestSeq = getNextDeconstructRequestSeq(state.assets);
  return {
    ...state,
    assets: {
      ...state.assets,
      [assetId]: {
        ...targetAsset,
        status: "deconstructing",
        deconstructRequestSeq: nextDeconstructRequestSeq,
      },
    },
  };
}

function clearAssetDeconstructingStatus(
  state: ConstructionContextState,
  assetId: string,
): ConstructionContextState {
  const targetAsset = state.assets[assetId];
  if (!targetAsset || targetAsset.status !== "deconstructing") return state;
  const {
    status: _status,
    deconstructRequestSeq: _deconstructRequestSeq,
    ...assetWithoutStatus
  } = targetAsset;
  return {
    ...state,
    assets: {
      ...state.assets,
      [assetId]: assetWithoutStatus,
    },
  };
}

export const CONSTRUCTION_HANDLED_ACTION_TYPES = [
  "BUILD_PLACE_BUILDING",
  "BUILD_PLACE_FLOOR_TILE",
  "BUILD_REMOVE_ASSET",
  "REQUEST_DECONSTRUCT_ASSET",
  "CANCEL_DECONSTRUCT_ASSET",
  "REMOVE_BUILDING",
  "UPGRADE_HUB",
] as const satisfies readonly GameAction["type"][];

type ConstructionActionType =
  (typeof CONSTRUCTION_HANDLED_ACTION_TYPES)[number];
type ConstructionAction = Extract<GameAction, { type: ConstructionActionType }>;

const CONSTRUCTION_ACTION_TYPE_SET: ReadonlySet<GameAction["type"]> = new Set(
  CONSTRUCTION_HANDLED_ACTION_TYPES,
);

function isConstructionAction(
  action: GameAction,
): action is ConstructionAction {
  return CONSTRUCTION_ACTION_TYPE_SET.has(action.type);
}

function reduceConstruction(
  state: ConstructionContextState,
  action: ConstructionAction,
): ConstructionContextState {
  const actionType = action.type;

  switch (actionType) {
    case "REQUEST_DECONSTRUCT_ASSET":
      return markAssetAsDeconstructing(state, action.assetId);

    case "CANCEL_DECONSTRUCT_ASSET":
      return clearAssetDeconstructingStatus(state, action.assetId);

    case "BUILD_PLACE_BUILDING":
    case "BUILD_PLACE_FLOOR_TILE":
    case "BUILD_REMOVE_ASSET":
    case "REMOVE_BUILDING":
    case "UPGRADE_HUB":
      // cross-slice: no-op in isolated context
      // Placement and removal need state.inventory, state.warehouseInventories,
      // state.serviceHubs, notifications and geometry validation; hub upgrade
      // mutates state.serviceHubs alongside constructionSites.
      return state;

    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

export const constructionContext: BoundedContext<ConstructionContextState> = {
  reduce(state, action) {
    if (!isConstructionAction(action)) return null;
    return reduceConstruction(state, action);
  },
  handledActionTypes: CONSTRUCTION_HANDLED_ACTION_TYPES,
};
