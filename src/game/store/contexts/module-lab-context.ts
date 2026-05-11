import type { Module } from "../../modules/module.types";
import {
  getModuleLabRecipe,
  getRecipeFragmentCost,
} from "../../constants/moduleLabConstants";
import type { GameAction } from "../game-actions";
import type { ModuleLabJob } from "../types";
import { normalizeModuleFragmentCount } from "../helpers/module-fragments";
import { makeModuleId } from "../utils/make-id";
import type { BoundedContext, ModuleLabContextState } from "./types";

export const MODULE_LAB_HANDLED_ACTION_TYPES = [
  "START_MODULE_CRAFT",
  "MODULE_LAB_TICK",
  "COLLECT_MODULE",
  "PLACE_MODULE",
  "REMOVE_MODULE",
] as const satisfies readonly GameAction["type"][];

type ModuleLabActionType = (typeof MODULE_LAB_HANDLED_ACTION_TYPES)[number];
type ModuleLabAction = Extract<GameAction, { type: ModuleLabActionType }>;

const MODULE_LAB_ACTION_TYPE_SET: ReadonlySet<GameAction["type"]> = new Set(
  MODULE_LAB_HANDLED_ACTION_TYPES,
);

function isModuleLabAction(action: GameAction): action is ModuleLabAction {
  return MODULE_LAB_ACTION_TYPE_SET.has(action.type);
}

function startModuleCraft(
  state: ModuleLabContextState,
  recipeId: string,
  now: number,
): ModuleLabContextState {
  if (state.moduleLabJob !== null) return state;

  const recipe = getModuleLabRecipe(recipeId);
  if (!recipe) return state;

  const cost = getRecipeFragmentCost(recipe);
  const fragments = normalizeModuleFragmentCount(state.moduleFragments);
  if (fragments < cost) return state;

  const job: ModuleLabJob = {
    recipeId: recipe.id,
    moduleType: recipe.outputModuleType,
    tier: recipe.outputTier,
    fragmentsRequired: cost,
    startedAt: now,
    durationMs: recipe.durationMs,
    status: "crafting",
  };

  return {
    ...state,
    moduleFragments: fragments - cost,
    moduleLabJob: job,
  };
}

function collectModule(
  state: ModuleLabContextState,
  now: number,
  rand: () => number,
): ModuleLabContextState {
  const job = state.moduleLabJob;
  if (!job) return state;
  if (job.startedAt + job.durationMs > now) return state;
  if (job.status !== "done") return state;

  const newModule: Module = {
    id: makeModuleId("mod", now, rand),
    type: job.moduleType,
    tier: job.tier,
    equippedTo: null,
  };

  return {
    ...state,
    moduleLabJob: null,
    moduleInventory: [...state.moduleInventory, newModule],
  };
}

function reduceModuleLab(
  state: ModuleLabContextState,
  action: ModuleLabAction,
): ModuleLabContextState {
  const actionType = action.type;

  switch (actionType) {
    case "START_MODULE_CRAFT":
      return startModuleCraft(state, action.recipeId, Date.now());

    case "COLLECT_MODULE":
      return collectModule(state, Date.now(), Math.random);

    case "MODULE_LAB_TICK":
    case "PLACE_MODULE":
    case "REMOVE_MODULE":
      // cross-slice: no-op in isolated context
      // The tick gates on state.assets[moduleLab]?.status; placement and
      // removal mutate state.assets and notifications.
      return state;

    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

export const moduleLabContext: BoundedContext<ModuleLabContextState> = {
  reduce(state, action) {
    if (!isModuleLabAction(action)) return null;
    return reduceModuleLab(state, action);
  },
  handledActionTypes: MODULE_LAB_HANDLED_ACTION_TYPES,
};
