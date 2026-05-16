import { debugLog } from "../../debug/debugLogger";
import {
  applyCraftingSourceInventory,
  getCraftingSourceInventory,
  resolveCraftingSource,
} from "../../crafting/crafting-sources";
import { getZoneWarehouseIds } from "../../zones/production-zone-aggregation";
import { GENERATOR_TICKS_PER_WOOD } from "../constants/energy/generator";
import { GENERATOR_MAX_FUEL } from "../constants/buildings/index";
import { DEFAULT_MACHINE_PRIORITY } from "../constants/energy/energy-balance";
import { consumeResources } from "../helpers/reducer-helpers";
import {
  clampMachinePriority,
  isBoostSupportedType,
  isEnergyConsumerType,
} from "../helpers/machine-priority";
import { addErrorNotification } from "../utils/notifications";
import type { GameAction } from "../game-actions";
import type { CraftingSource, GameState, PlacedAsset } from "../types";
import type { BoundedContext, PowerContextState } from "./types";

// Local slice-typed mirror of store/building-source.ts. Same precedent as
// crafting-context.ts:35-49 — keeps the bounded context honest about which
// slices it actually reads from PowerContextState.
type BuildingSourceResolverState = Pick<
  GameState,
  | "assets"
  | "buildingZoneIds"
  | "productionZones"
  | "buildingSourceWarehouseIds"
  | "warehouseInventories"
>;

function resolveBuildingSource(
  state: BuildingSourceResolverState,
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

export const POWER_HANDLED_ACTION_TYPES = [
  "GENERATOR_ADD_FUEL",
  "GENERATOR_REQUEST_REFILL",
  "GENERATOR_START",
  "GENERATOR_STOP",
  "GENERATOR_TICK",
  "ENERGY_NET_TICK",
  "REMOVE_POWER_POLE",
  "SET_MACHINE_PRIORITY",
  "SET_MACHINE_BOOST",
] as const satisfies readonly GameAction["type"][];

type PowerActionType = (typeof POWER_HANDLED_ACTION_TYPES)[number];
type PowerAction = Extract<GameAction, { type: PowerActionType }>;

const POWER_ACTION_TYPE_SET: ReadonlySet<GameAction["type"]> = new Set(
  POWER_HANDLED_ACTION_TYPES,
);

function isPowerAction(action: GameAction): action is PowerAction {
  return POWER_ACTION_TYPE_SET.has(action.type);
}

// Mirrors action-handlers/machine-config.ts:36-51 (patchMachineAsset). Local
// copy keeps the bounded context free of an action-handlers/ import.
function patchAsset(
  state: PowerContextState,
  assetId: string,
  patch: Partial<PlacedAsset>,
): PowerContextState {
  return {
    ...state,
    assets: {
      ...state.assets,
      [assetId]: { ...state.assets[assetId], ...patch },
    },
  };
}

function reducePower(
  state: PowerContextState,
  action: PowerAction,
): PowerContextState {
  const actionType = action.type;

  switch (actionType) {
    case "GENERATOR_START": {
      // Mirrors action-handlers/machine-actions/phases/generator-toggle-phase.ts:18-31.
      const genId = state.selectedGeneratorId;
      if (!genId) return state;
      if (state.constructionSites[genId]) return state;
      const gen = state.generators[genId];
      if (!gen || gen.running || gen.fuel <= 0) return state;
      debugLog.building(`Generator ${genId}: started`);
      return {
        ...state,
        generators: {
          ...state.generators,
          [genId]: { ...gen, running: true },
        },
      };
    }

    case "GENERATOR_STOP": {
      // Mirrors action-handlers/machine-actions/phases/generator-toggle-phase.ts:34-53.
      const genId = state.selectedGeneratorId;
      if (!genId) return state;
      const gen = state.generators[genId];
      if (!gen) return state;
      debugLog.building(`Generator ${genId}: stopped`);
      const fuelAfterStop =
        gen.progress > 0 ? Math.max(0, gen.fuel - 1) : gen.fuel;
      return {
        ...state,
        generators: {
          ...state.generators,
          [genId]: {
            ...gen,
            running: false,
            progress: 0,
            fuel: fuelAfterStop,
          },
        },
      };
    }

    case "REMOVE_POWER_POLE":
      // Mirrors action-handlers/maintenance-actions/phases/remove-power-pole-phase.ts:13.
      // Power poles are removed exclusively via BUILD_REMOVE_ASSET in Build Mode;
      // this action is intentionally a no-op in the legacy path as well.
      return state;

    case "GENERATOR_REQUEST_REFILL": {
      // Mirrors action-handlers/machine-actions/phases/generator-fuel-phase.ts:59-92.
      const genId = state.selectedGeneratorId;
      if (!genId || !state.generators[genId]) return state;
      if (state.constructionSites[genId]) return state;
      const gen = state.generators[genId];
      const currentReq = gen.requestedRefill ?? 0;
      const headroom = Math.max(0, GENERATOR_MAX_FUEL - gen.fuel - currentReq);
      const desired =
        action.amount === "max"
          ? headroom
          : Math.max(0, Math.floor(action.amount));
      const add = Math.min(desired, headroom);
      if (add <= 0) {
        return {
          ...state,
          notifications: addErrorNotification(
            state.notifications,
            currentReq > 0
              ? `Generator ${genId}: bereits ${currentReq} Holz angefordert`
              : `Generator ${genId}: Speicher voll`,
          ),
        };
      }
      debugLog.building(
        `Generator ${genId}: refill request +${add} (open ${currentReq} → ${currentReq + add})`,
      );
      return {
        ...state,
        generators: {
          ...state.generators,
          [genId]: { ...gen, requestedRefill: currentReq + add },
        },
      };
    }

    case "GENERATOR_TICK": {
      // Mirrors action-handlers/machine-actions/phases/generator-tick-phase.ts.
      const newGenerators = { ...state.generators };
      let changed = false;
      for (const id of Object.keys(newGenerators)) {
        if (state.assets[id]?.status === "deconstructing") continue;
        if (state.constructionSites[id]) continue;
        const g = newGenerators[id];
        if (!g.running || g.fuel <= 0) {
          if (g.running) {
            newGenerators[id] = { ...g, running: false };
            changed = true;
          }
          continue;
        }
        const newProgress = g.progress + 1 / GENERATOR_TICKS_PER_WOOD;
        if (newProgress >= 1) {
          const newFuel = g.fuel - 1;
          newGenerators[id] = {
            ...g,
            fuel: newFuel,
            progress: 0,
            running: newFuel > 0,
          };
        } else {
          newGenerators[id] = { ...g, progress: newProgress };
        }
        changed = true;
      }
      if (!changed) return state;
      return { ...state, generators: newGenerators };
    }

    case "GENERATOR_ADD_FUEL": {
      // Mirrors action-handlers/machine-actions/phases/generator-fuel-phase.ts:28-57.
      const genId = state.selectedGeneratorId;
      if (!genId || !state.generators[genId]) return state;
      if (state.constructionSites[genId]) return state;
      const source = resolveBuildingSource(state, genId);
      const sourceInv = getCraftingSourceInventory(state as GameState, source);
      const gen = state.generators[genId];
      const space = Math.max(0, GENERATOR_MAX_FUEL - gen.fuel);
      const amt = Math.min(
        action.amount,
        (sourceInv.wood as number) ?? 0,
        space,
      );
      if (amt <= 0) return state;
      debugLog.building(
        `Generator ${genId}: added ${amt} wood as fuel (${gen.fuel} → ${gen.fuel + amt}/${GENERATOR_MAX_FUEL})`,
      );
      return {
        ...state,
        ...applyCraftingSourceInventory(
          state as GameState,
          source,
          consumeResources(sourceInv, { wood: amt }),
        ),
        generators: {
          ...state.generators,
          [genId]: { ...gen, fuel: gen.fuel + amt },
        },
      };
    }

    case "ENERGY_NET_TICK":
      // Handled directly in the live-switch wrapper
      // (contexts/create-game-reducer.ts → runEnergyNetTick), so this
      // context never owns the transition. The case is kept here only to
      // satisfy POWER_HANDLED_ACTION_TYPES exhaustiveness. ENERGY_NET_TICK
      // reads ~8 slices (assets, cellMap, connectedAssetIds, autoSmelters,
      // autoAssemblers, constructionSites, generators, battery) and a
      // mirrored slice would have to widen PowerContextState beyond what
      // any other Power action needs — hence the wrapper.
      return state;

    case "SET_MACHINE_PRIORITY": {
      // Mirrors action-handlers/machine-config.ts:58-71.
      const asset = state.assets[action.assetId];
      if (!asset) return state;
      if (!isEnergyConsumerType(asset.type)) return state;
      const nextPriority = clampMachinePriority(action.priority);
      if ((asset.priority ?? DEFAULT_MACHINE_PRIORITY) === nextPriority) {
        return state;
      }
      return patchAsset(state, action.assetId, { priority: nextPriority });
    }

    case "SET_MACHINE_BOOST": {
      // Mirrors action-handlers/machine-config.ts:73-83. Hard restriction:
      // boost (tier-1 overclocking) is only valid for auto_miner /
      // auto_smelter — other asset types are rejected upstream.
      const asset = state.assets[action.assetId];
      if (!asset) return state;
      if (!isBoostSupportedType(asset.type)) return state;
      const nextBoost = !!action.boosted;
      if ((asset.boosted ?? false) === nextBoost) return state;
      return patchAsset(state, action.assetId, { boosted: nextBoost });
    }

    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

export const powerContext: BoundedContext<PowerContextState> = {
  reduce(state, action) {
    if (!isPowerAction(action)) return null;
    return reducePower(state, action);
  },
  handledActionTypes: POWER_HANDLED_ACTION_TYPES,
};
