import type { GameAction } from "../../game-actions";
import type { GameState, PlacedAsset } from "../../types";
import type { BuildingPlacementIoDeps } from "./shared";
import { decideRemoveAssetEligibility } from "./remove-asset";

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
  state: GameState,
  assetId: string,
): GameState {
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
  state: GameState,
  assetId: string,
): GameState {
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

export function handleRequestDeconstructAssetAction(
  state: GameState,
  action: Extract<GameAction, { type: "REQUEST_DECONSTRUCT_ASSET" }>,
  deps: BuildingPlacementIoDeps,
): GameState {
  const activeHotbarSlot = state.hotbarSlots[state.activeSlot];
  const removeEligibilityDecision = decideRemoveAssetEligibility({
    buildMode: state.buildMode,
    activeHotbarToolKind: activeHotbarSlot?.toolKind,
    assets: state.assets,
    assetId: action.assetId,
  });
  if (removeEligibilityDecision.kind === "blocked") return state;

  const targetAsset = removeEligibilityDecision.targetAsset;
  if (targetAsset.status === "deconstructing") return state;

  deps.debugLog.building(
    `[BuildMode] Requested deconstruct for ${targetAsset.type} at (${targetAsset.x},${targetAsset.y})`,
  );

  return markAssetAsDeconstructing(state, targetAsset.id);
}

export function handleCancelDeconstructAssetAction(
  state: GameState,
  action: Extract<GameAction, { type: "CANCEL_DECONSTRUCT_ASSET" }>,
  deps: BuildingPlacementIoDeps,
): GameState {
  const targetAsset = state.assets[action.assetId];
  if (!targetAsset || targetAsset.status !== "deconstructing") return state;

  const activeHotbarSlot = state.hotbarSlots[state.activeSlot];
  const removeEligibilityDecision = decideRemoveAssetEligibility({
    buildMode: state.buildMode,
    activeHotbarToolKind: activeHotbarSlot?.toolKind,
    assets: state.assets,
    assetId: action.assetId,
  });
  if (removeEligibilityDecision.kind === "blocked") return state;

  deps.debugLog.building(
    `[BuildMode] Cancelled deconstruct for ${targetAsset.type} at (${targetAsset.x},${targetAsset.y})`,
  );

  return clearAssetDeconstructingStatus(state, targetAsset.id);
}
