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
  checkRecipeAutomationPolicy,
  isRecipeAutomationPolicyEntryDefault,
} from "../../crafting/policies";
import { buildWorkbenchAutoCraftPlan } from "../../crafting/planner";
import { resolveCraftingSource } from "../../crafting/crafting-sources";
import { getZoneWarehouseIds } from "../../zones/production-zone-aggregation";
import type { CraftingInventorySource } from "../../crafting/types";
import { KEEP_STOCK_MAX_TARGET } from "../constants/keep-stock";
import type { GameAction } from "../game-actions";
import type { CraftingSource, GameState } from "../types";
import { addErrorNotification } from "../utils/notifications";
import { getAssetOfType } from "../utils/asset-guards";
import type { CraftingContextState, BoundedContext } from "./types";

type CraftingSourceResolverState = Pick<
  GameState,
  | "assets"
  | "buildingZoneIds"
  | "productionZones"
  | "buildingSourceWarehouseIds"
  | "warehouseInventories"
>;

function resolveBuildingSource(
  state: CraftingSourceResolverState,
  buildingId: string | null,
): CraftingSource {
  if (!buildingId) return { kind: "global" };
  const zoneId = state.buildingZoneIds[buildingId];
  if (zoneId && state.productionZones[zoneId]) {
    const whIds = getZoneWarehouseIds(state as GameState, zoneId);
    if (whIds.length > 0) {
      return { kind: "zone", zoneId };
    }
  }
  const whId = state.buildingSourceWarehouseIds[buildingId] ?? null;
  return resolveCraftingSource(state as GameState, whId);
}

function toCraftingJobInventorySource(
  state: CraftingSourceResolverState,
  source: CraftingSource,
): CraftingInventorySource {
  if (source.kind === "global") {
    return { kind: "global" };
  }
  if (source.kind === "zone") {
    return {
      kind: "zone",
      zoneId: source.zoneId,
      warehouseIds: getZoneWarehouseIds(state as GameState, source.zoneId),
    };
  }
  return { kind: "warehouse", warehouseId: source.warehouseId };
}

function withCraftingErrorNotification(
  state: CraftingContextState,
  message: string,
): CraftingContextState {
  return {
    ...state,
    notifications: addErrorNotification(state.notifications, message),
  };
}

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
    case "CRAFT_REQUEST_WITH_PREREQUISITES": {
      const workbenchAsset = getAssetOfType(
        state,
        action.workbenchId,
        "workbench",
      );
      if (!workbenchAsset) {
        return withCraftingErrorNotification(
          state,
          `Werkbank "${action.workbenchId}" existiert nicht.`,
        );
      }
      if (state.constructionSites[workbenchAsset.id]) {
        return withCraftingErrorNotification(
          state,
          `Werkbank [${workbenchAsset.id}] ist noch im Bau.`,
        );
      }
      const recipePolicies = state.recipeAutomationPolicies ?? {};
      const autoCraftDecision = checkRecipeAutomationPolicy(
        recipePolicies,
        action.recipeId,
        "craftRequest",
      );
      if (!autoCraftDecision.allowed) {
        return withCraftingErrorNotification(state, autoCraftDecision.reason!);
      }
      const resolvedSource = resolveBuildingSource(state, action.workbenchId);
      if (resolvedSource.kind === "global") {
        return withCraftingErrorNotification(
          state,
          "Werkbank braucht ein physisches Lager als Quelle.",
        );
      }
      const inventorySource = toCraftingJobInventorySource(
        state,
        resolvedSource,
      );
      if (inventorySource.kind === "global") {
        return withCraftingErrorNotification(
          state,
          "Workbench braucht eine physische Quelle (Lagerhaus/Zone) für Auto-Craft.",
        );
      }
      const plan = buildWorkbenchAutoCraftPlan({
        recipeId: action.recipeId,
        amount: action.amount ?? 1,
        producerAssetId: action.workbenchId,
        source: inventorySource,
        warehouseInventories: state.warehouseInventories,
        serviceHubs: state.serviceHubs,
        network: state.network,
        assets: state.assets,
        existingJobs: state.crafting.jobs,
        canUseRecipe: (recipeId) =>
          checkRecipeAutomationPolicy(
            recipePolicies,
            recipeId,
            "plannerAutoCraft",
          ),
      });
      if (!plan.ok) {
        return withCraftingErrorNotification(state, plan.error.message);
      }
      let nextQueue = state.crafting;
      const plannedTotalCount = plan.steps.reduce(
        (sum, step) => sum + step.count,
        0,
      );
      let divergenceNotice: string | null = null;
      if (
        typeof action.expectedStepCount === "number" &&
        action.expectedStepCount !== plannedTotalCount
      ) {
        divergenceNotice = `Hinweis: Auto-Craft-Plan an aktuellen Bestand angepasst (${action.expectedStepCount} → ${plannedTotalCount} Schritte).`;
      }
      for (const step of plan.steps) {
        for (let i = 0; i < step.count; i++) {
          const enqueueResult = craftingEnqueueJob(nextQueue, {
            recipeId: step.recipeId,
            workbenchId: action.workbenchId,
            source: action.source,
            priority: action.priority,
            inventorySource,
            assets: state.assets,
          });
          if (!enqueueResult.ok) {
            return withCraftingErrorNotification(
              { ...state, crafting: enqueueResult.queue },
              enqueueResult.error.message,
            );
          }
          nextQueue = enqueueResult.queue;
        }
      }
      if (nextQueue === state.crafting) return state;
      return {
        ...state,
        crafting: nextQueue,
        notifications: divergenceNotice
          ? addErrorNotification(state.notifications, divergenceNotice)
          : state.notifications,
      };
    }

    case "JOB_ENQUEUE": {
      const workbenchAsset = getAssetOfType(
        state,
        action.workbenchId,
        "workbench",
      );
      if (!workbenchAsset) {
        const failed = craftingEnqueueJob(state.crafting, {
          recipeId: action.recipeId,
          workbenchId: action.workbenchId,
          source: action.source,
          priority: action.priority,
          inventorySource: { kind: "global" },
          assets: state.assets,
        });
        return failed.ok
          ? state
          : {
              ...state,
              crafting: failed.queue,
              notifications: addErrorNotification(
                state.notifications,
                failed.error.message,
              ),
            };
      }
      if (state.constructionSites[workbenchAsset.id]) {
        return withCraftingErrorNotification(
          state,
          `Werkbank [${workbenchAsset.id}] ist noch im Bau.`,
        );
      }
      if (action.source === "automation") {
        const decision = checkRecipeAutomationPolicy(
          state.recipeAutomationPolicies ?? {},
          action.recipeId,
          "jobEnqueueAutomation",
        );
        if (!decision.allowed) {
          return withCraftingErrorNotification(state, decision.reason!);
        }
      }
      const resolvedSource = resolveBuildingSource(state, action.workbenchId);
      if (resolvedSource.kind === "global") {
        return withCraftingErrorNotification(
          state,
          "Werkbank braucht ein physisches Lager als Quelle.",
        );
      }
      const r = craftingEnqueueJob(state.crafting, {
        recipeId: action.recipeId,
        workbenchId: action.workbenchId,
        source: action.source,
        priority: action.priority,
        inventorySource: toCraftingJobInventorySource(state, resolvedSource),
        assets: state.assets,
      });
      if (!r.ok) {
        return withCraftingErrorNotification(
          { ...state, crafting: r.queue },
          r.error.message,
        );
      }
      return { ...state, crafting: r.queue };
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
