// ============================================================
// Module Lab action handler
// ------------------------------------------------------------
// Handles the fragment-crafting lifecycle at the Module Lab:
//   START_MODULE_CRAFT  - spend fragments, open a job
//   MODULE_LAB_TICK     - flip the job to "done" once durationMs has elapsed
//   COLLECT_MODULE      - move the finished module into moduleInventory
//   PLACE_MODULE        - assign module → asset (equippedTo + asset.moduleSlot)
//   REMOVE_MODULE       - clear module.equippedTo
// ============================================================

import type { GameAction } from "../game-actions";
import type { GameState, ModuleLabJob } from "../types";
import type { Module } from "../../modules/module.types";
import {
  getModuleLabRecipe,
  getRecipeFragmentCost,
} from "../../constants/moduleLabConstants";
import { normalizeModuleFragmentCount } from "../helpers/module-fragments";
import { addErrorNotification } from "../utils/notifications";
import { isModuleCompatibleWithAsset } from "./module-compat";

function generateModuleId(): string {
  // Sufficient for in-game ids; uniqueness is per-save and unconstrained by NFT addresses.
  return `mod-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function startModuleCraft(state: GameState, recipeId: string): GameState {
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
    startedAt: Date.now(),
    durationMs: recipe.durationMs,
    status: "crafting",
  };

  return {
    ...state,
    moduleFragments: fragments - cost,
    moduleLabJob: job,
  };
}

function moduleLabTick(state: GameState): GameState {
  const job = state.moduleLabJob;
  if (!job || job.status !== "crafting") return state;
  const moduleLab = Object.values(state.assets).find(
    (asset) => asset.type === "module_lab",
  );
  if (moduleLab?.status === "deconstructing") return state;

  if (Date.now() < job.startedAt + job.durationMs) return state;

  return {
    ...state,
    moduleLabJob: { ...job, status: "done" },
  };
}

function collectModule(state: GameState): GameState {
  const job = state.moduleLabJob;
  if (!job) return state;
  // Belt-and-suspenders: don't collect if the wall-clock says the job isn't done yet,
  // even if somehow status slipped through as "done" due to a deserialization quirk.
  if (job.startedAt + job.durationMs > Date.now()) return state;
  if (job.status !== "done") return state;

  const newModule: Module = {
    id: generateModuleId(),
    type: job.moduleType,
    tier: job.tier,
    equippedTo: null,
  };

  return {
    ...state,
    moduleLabJob: null,
    moduleInventory: [...(state.moduleInventory ?? []), newModule],
  };
}

function placeModule(
  state: GameState,
  moduleId: string,
  assetId: string,
): GameState {
  const inventory = state.moduleInventory ?? [];
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
  state: GameState,
  moduleId: string,
  assetId?: string,
): GameState {
  const inventory = state.moduleInventory ?? [];
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

export function handleModuleLabAction(
  state: GameState,
  action: GameAction,
): GameState | null {
  switch (action.type) {
    case "START_MODULE_CRAFT":
      return startModuleCraft(state, action.recipeId);
    case "MODULE_LAB_TICK":
      return moduleLabTick(state);
    case "COLLECT_MODULE":
      return collectModule(state);
    case "PLACE_MODULE": {
      const assetId = action.assetId ?? action.buildingId;
      return assetId ? placeModule(state, action.moduleId, assetId) : state;
    }
    case "REMOVE_MODULE":
      return removeModule(state, action.moduleId, action.assetId);
    default:
      return null;
  }
}
