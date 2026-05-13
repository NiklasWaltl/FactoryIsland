import {
  cancelJob as craftingCancelJob,
  enqueueJob as craftingEnqueueJob,
  pauseJob as craftingPauseJob,
  moveJob as craftingMoveJob,
  setJobPriority as craftingSetJobPriority,
} from "../../crafting/queue";
import { releaseJobReservations } from "../../crafting/tick";
import {
  applyRecipeAutomationPolicyPatch,
  areRecipeAutomationPolicyEntriesEqual,
  isRecipeAutomationPolicyEntryDefault,
} from "../../crafting/policies";
import { KEEP_STOCK_MAX_TARGET } from "../constants/keep-stock";
import type { GameAction } from "../game-actions";
import { getAssetOfType } from "../utils/asset-guards";
import type { CraftingContextState, BoundedContext } from "./types";

export const CRAFTING_HANDLED_ACTION_TYPES = [
  "CRAFT_REQUEST_WITH_PREREQUISITES",
  "JOB_ENQUEUE",
  "JOB_CANCEL",
  "JOB_PAUSE",
  "JOB_MOVE",
  "JOB_SET_PRIORITY",
  "JOB_TICK",
  "SET_KEEP_STOCK_TARGET",
  "SET_RECIPE_AUTOMATION_POLICY",
] as const satisfies readonly GameAction["type"][];

type CraftingActionType = (typeof CRAFTING_HANDLED_ACTION_TYPES)[number];
type CraftingAction = Extract<GameAction, { type: CraftingActionType }>;

const CRAFTING_ACTION_TYPE_SET: ReadonlySet<GameAction["type"]> = new Set(
  CRAFTING_HANDLED_ACTION_TYPES,
);

function isCraftingAction(action: GameAction): action is CraftingAction {
  return CRAFTING_ACTION_TYPE_SET.has(action.type);
}

function reduceCrafting(
  state: CraftingContextState,
  action: CraftingAction,
): CraftingContextState {
  const actionType = action.type;

  switch (actionType) {
    case "CRAFT_REQUEST_WITH_PREREQUISITES":
      return state;

    case "JOB_ENQUEUE": {
      const failed = craftingEnqueueJob(state.crafting, {
        recipeId: action.recipeId,
        workbenchId: action.workbenchId,
        source: action.source,
        priority: action.priority,
        inventorySource: { kind: "global" },
        assets: {},
      });
      return failed.ok ? state : { ...state, crafting: failed.queue };
    }

    case "JOB_CANCEL": {
      const r = craftingCancelJob(state.crafting, action.jobId);
      if (!r.ok) {
        return { ...state, crafting: r.queue };
      }
      const jobBefore = { ...r.job, status: r.previousStatus };
      const nextNetwork = releaseJobReservations(state.network, jobBefore);
      return { ...state, crafting: r.queue, network: nextNetwork };
    }

    case "JOB_PAUSE": {
      const r = craftingPauseJob(state.crafting, action.payload.jobId);
      if (r.queue === state.crafting) return state;
      return { ...state, crafting: r.queue };
    }

    case "JOB_MOVE": {
      const r = craftingMoveJob(state.crafting, action.jobId, action.direction);
      if (r.queue === state.crafting) return state;
      return { ...state, crafting: r.queue };
    }

    case "JOB_SET_PRIORITY": {
      const r = craftingSetJobPriority(
        state.crafting,
        action.jobId,
        action.priority,
      );
      if (r.queue === state.crafting) return state;
      return { ...state, crafting: r.queue };
    }

    case "JOB_TICK":
      return state;

    case "SET_KEEP_STOCK_TARGET": {
      if (!getAssetOfType(state, action.workbenchId, "workbench")) return state;

      const clampedAmount = Math.max(
        0,
        Math.min(KEEP_STOCK_MAX_TARGET, Math.floor(action.amount)),
      );
      const nextTarget = {
        enabled: !!action.enabled && clampedAmount > 0,
        amount: clampedAmount,
      };

      const byWorkbench = state.keepStockByWorkbench ?? {};
      const recipeTargets = byWorkbench[action.workbenchId] ?? {};
      const currentTarget = recipeTargets[action.recipeId];

      if (
        currentTarget &&
        currentTarget.enabled === nextTarget.enabled &&
        currentTarget.amount === nextTarget.amount
      ) {
        return state;
      }

      if (!nextTarget.enabled && nextTarget.amount === 0) {
        if (!currentTarget) return state;
        const { [action.recipeId]: _removed, ...remainingRecipes } =
          recipeTargets;
        if (Object.keys(remainingRecipes).length === 0) {
          const {
            [action.workbenchId]: _removedWorkbench,
            ...remainingWorkbenches
          } = byWorkbench;
          return {
            ...state,
            keepStockByWorkbench: remainingWorkbenches,
          };
        }
        return {
          ...state,
          keepStockByWorkbench: {
            ...byWorkbench,
            [action.workbenchId]: remainingRecipes,
          },
        };
      }

      return {
        ...state,
        keepStockByWorkbench: {
          ...byWorkbench,
          [action.workbenchId]: {
            ...recipeTargets,
            [action.recipeId]: nextTarget,
          },
        },
      };
    }

    case "SET_RECIPE_AUTOMATION_POLICY": {
      const byRecipe = state.recipeAutomationPolicies ?? {};
      const currentEntry = byRecipe[action.recipeId];
      const nextEntry = applyRecipeAutomationPolicyPatch(
        currentEntry,
        action.patch,
      );

      if (areRecipeAutomationPolicyEntriesEqual(currentEntry, nextEntry)) {
        return state;
      }

      if (isRecipeAutomationPolicyEntryDefault(nextEntry)) {
        if (!currentEntry) return state;
        const { [action.recipeId]: _removed, ...remaining } = byRecipe;
        return {
          ...state,
          recipeAutomationPolicies: remaining,
        };
      }

      return {
        ...state,
        recipeAutomationPolicies: {
          ...byRecipe,
          [action.recipeId]: nextEntry,
        },
      };
    }

    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

export const craftingContext: BoundedContext<CraftingContextState> = {
  reduce(state, action) {
    if (!isCraftingAction(action)) return null;
    return reduceCrafting(state, action);
  },
  handledActionTypes: CRAFTING_HANDLED_ACTION_TYPES,
};
