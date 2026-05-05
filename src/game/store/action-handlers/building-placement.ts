import type { GameAction } from "../game-actions";
import {
  type BuildingPlacementIoDeps,
  isBuildingPlacementAction,
} from "./building-placement/shared";
import { handlePlaceBuildingAction } from "./building-placement/place-building";
import {
  handleCancelDeconstructAssetAction,
  handleRequestDeconstructAssetAction,
} from "./building-placement/request-deconstruct";
import { handleRemoveAssetAction } from "./building-placement/remove-asset";
import type { GameState } from "../types";

export { isBuildingPlacementAction };
export type { BuildingPlacementIoDeps };

export function handleBuildingPlacementAction(
  state: GameState,
  action: GameAction,
  deps: BuildingPlacementIoDeps,
): GameState | null {
  switch (action.type) {
    case "BUILD_PLACE_BUILDING":
      return handlePlaceBuildingAction(state, action, deps);
    case "REQUEST_DECONSTRUCT_ASSET":
      return handleRequestDeconstructAssetAction(state, action, deps);
    case "CANCEL_DECONSTRUCT_ASSET":
      return handleCancelDeconstructAssetAction(state, action, deps);
    case "BUILD_REMOVE_ASSET":
      return handleRemoveAssetAction(state, action, deps);
    default:
      return null;
  }
}
