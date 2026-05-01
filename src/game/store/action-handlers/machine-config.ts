import type { GameAction } from "../game-actions";
import type { GameState, PlacedAsset } from "../types";
import { DEFAULT_MACHINE_PRIORITY } from "../constants/energy/energy-balance";
import {
  clampMachinePriority,
  isBoostSupportedType,
  isEnergyConsumerType,
} from "../helpers/machine-priority";
import {
  setSplitterFilter,
  getSplitterFilter,
} from "../slices/splitter-filter-state";

type MachineConfigTargetDecision =
  | { kind: "blocked" }
  | { kind: "eligible"; asset: PlacedAsset };

function decideMachineConfigTargetAsset(
  state: Pick<GameState, "assets">,
  assetId: string,
): MachineConfigTargetDecision {
  const asset = state.assets[assetId];
  if (!asset) return { kind: "blocked" };
  return { kind: "eligible", asset };
}

function resolveMachineConfigTargetAsset(
  state: Pick<GameState, "assets">,
  assetId: string,
): PlacedAsset | null {
  const targetDecision = decideMachineConfigTargetAsset(state, assetId);
  if (targetDecision.kind === "blocked") return null;
  return targetDecision.asset;
}

function patchMachineAsset(
  state: GameState,
  assetId: string,
  patch: Partial<PlacedAsset>,
): GameState {
  return {
    ...state,
    assets: {
      ...state.assets,
      [assetId]: {
        ...state.assets[assetId],
        ...patch,
      },
    },
  };
}

export function handleMachineConfigAction(
  state: GameState,
  action: GameAction,
): GameState | null {
  switch (action.type) {
    case "SET_MACHINE_PRIORITY": {
      const asset = resolveMachineConfigTargetAsset(state, action.assetId);
      if (!asset) return state;
      if (!isEnergyConsumerType(asset.type)) return state;

      const nextPriority = clampMachinePriority(action.priority);
      if ((asset.priority ?? DEFAULT_MACHINE_PRIORITY) === nextPriority) {
        return state;
      }

      return patchMachineAsset(state, action.assetId, {
        priority: nextPriority,
      });
    }

    case "SET_MACHINE_BOOST": {
      const asset = resolveMachineConfigTargetAsset(state, action.assetId);
      if (!asset) return state;
      // Harte Einschraenkung: Overclocking-Stufe 1 ist nur fuer auto_miner und auto_smelter.
      if (!isBoostSupportedType(asset.type)) return state;

      const nextBoost = !!action.boosted;
      if ((asset.boosted ?? false) === nextBoost) return state;

      return patchMachineAsset(state, action.assetId, { boosted: nextBoost });
    }

    case "SET_SPLITTER_FILTER": {
      const asset = resolveMachineConfigTargetAsset(state, action.splitterId);
      if (!asset || asset.type !== "conveyor_splitter") return state;
      if (
        getSplitterFilter(
          state.splitterFilterState,
          action.splitterId,
          action.side,
        ) === action.itemType
      ) {
        return state;
      }
      return {
        ...state,
        splitterFilterState: setSplitterFilter(
          state.splitterFilterState,
          action.splitterId,
          action.side,
          action.itemType,
        ),
      };
    }

    default:
      return null;
  }
}
