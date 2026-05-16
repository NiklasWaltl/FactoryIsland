import type { Module, ModuleType } from "../../modules/module.types";
import {
  MODULE_COMPATIBLE_BUILDINGS,
  getModuleLabRecipe,
  getRecipeFragmentCost,
} from "../../constants/moduleLabConstants";
import type { GameAction } from "../game-actions";
import type { AssetType, ModuleLabJob } from "../types";
import { normalizeModuleFragmentCount } from "../helpers/module-fragments";
import { addErrorNotification } from "../utils/notifications";
import { makeModuleId } from "../utils/make-id";
import type { BoundedContext, ModuleLabContextState } from "./types";

function isModuleCompatibleWithAsset(
  moduleType: ModuleType,
  assetType: AssetType,
): boolean {
  return MODULE_COMPATIBLE_BUILDINGS[moduleType].includes(assetType);
}

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

function moduleLabTick(
  state: ModuleLabContextState,
  now: number,
): ModuleLabContextState {
  const job = state.moduleLabJob;
  if (!job || job.status !== "crafting") return state;
  const moduleLab = Object.values(state.assets).find(
    (asset) => asset.type === "module_lab",
  );
  if (moduleLab?.status === "deconstructing") return state;
  if (now < job.startedAt + job.durationMs) return state;
  return {
    ...state,
    moduleLabJob: { ...job, status: "done" },
  };
}

function placeModule(
  state: ModuleLabContextState,
  moduleId: string,
  assetId: string,
): ModuleLabContextState {
  const inventory = state.moduleInventory;
  const target = inventory.find((m) => m.id === moduleId);
  if (!target) return state;
  if (target.equippedTo !== null) return state;

  const asset = state.assets[assetId];
  if (!asset) return state;
  if (asset.moduleSlot || inventory.some((m) => m.equippedTo === assetId)) {
    return {
      ...state,
      notifications: addErrorNotification(
        state.notifications,
        "Gebäude hat bereits ein Modul eingesetzt",
      ),
    };
  }
  if (!isModuleCompatibleWithAsset(target.type, asset.type)) {
    return {
      ...state,
      notifications: addErrorNotification(
        state.notifications,
        "Dieses Modul passt nicht zu diesem Gebäude",
      ),
    };
  }

  return {
    ...state,
    moduleInventory: inventory.map((m) =>
      m.id === moduleId ? { ...m, equippedTo: assetId } : m,
    ),
    assets: {
      ...state.assets,
      [assetId]: { ...asset, moduleSlot: moduleId },
    },
  };
}

function removeModule(
  state: ModuleLabContextState,
  moduleId: string,
  assetId?: string,
): ModuleLabContextState {
  const inventory = state.moduleInventory;
  const target = inventory.find((m) => m.id === moduleId);
  if (!target) return state;
  if (target.equippedTo === null) return state;
  if (assetId !== undefined && target.equippedTo !== assetId) return state;

  const equippedAssetId = target.equippedTo;
  const equippedAsset = state.assets[equippedAssetId];

  return {
    ...state,
    moduleInventory: inventory.map((m) =>
      m.id === moduleId ? { ...m, equippedTo: null } : m,
    ),
    assets: equippedAsset
      ? {
          ...state.assets,
          [equippedAssetId]: { ...equippedAsset, moduleSlot: null },
        }
      : state.assets,
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
      return moduleLabTick(state, Date.now());

    case "PLACE_MODULE": {
      // Mirrors action-handlers/module-lab-actions.ts:184-187 — PLACE_MODULE
      // ships with both `assetId` and a legacy `buildingId` alias on the
      // action payload. Resolve the alias before delegating.
      const targetAssetId = action.assetId ?? action.buildingId;
      return targetAssetId
        ? placeModule(state, action.moduleId, targetAssetId)
        : state;
    }

    case "REMOVE_MODULE":
      return removeModule(state, action.moduleId, action.assetId);

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
