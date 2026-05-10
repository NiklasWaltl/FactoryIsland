import type {
  PlacedAsset,
  ServiceHubEntry,
  StarterDroneState,
} from "../../store/types";
import { createEmptyNetworkSlice } from "../../inventory/reservationTypes";
import { createEmptyCraftingQueue } from "../../crafting/types";
import { debugLog } from "../../debug/debugLogger";
import { STARTER_DRONE_ID } from "../../store/selectors/drone-selectors";
import { selectMigratedStarter } from "./helpers";
import type {
  SaveGameV10,
  SaveGameV11,
  SaveGameV12,
  SaveGameV13,
  SaveGameV14,
  SaveGameV15,
  SaveGameV16,
  SaveGameV17,
  SaveGameV18,
  SaveGameV19,
  SaveGameV20,
} from "./types";

export function migrateV10ToV11(save: SaveGameV10): SaveGameV11 {
  const droneHubId = selectMigratedStarter(save)?.hubId ?? null;
  const migratedHubs: Record<string, ServiceHubEntry> = {};
  for (const [id, entry] of Object.entries(save.serviceHubs ?? {})) {
    migratedHubs[id] = {
      ...entry,
      droneIds:
        (entry as any).droneIds ?? (droneHubId === id ? ["starter"] : []),
    };
  }
  return {
    ...save,
    version: 11,
    serviceHubs: migratedHubs,
  };
}

export function migrateV11ToV12(save: SaveGameV11): SaveGameV12 {
  const drones: Record<string, StarterDroneState> = {};
  const starter = selectMigratedStarter(save);
  if (starter) {
    const droneId = (starter as any).droneId ?? STARTER_DRONE_ID;
    drones[droneId] = {
      ...starter,
      droneId,
      craftingJobId: (starter as any).craftingJobId ?? null,
    } as StarterDroneState;
    if (!drones[STARTER_DRONE_ID]) {
      drones[STARTER_DRONE_ID] = {
        ...drones[droneId],
        droneId: STARTER_DRONE_ID,
      };
    }
  } else {
    drones[STARTER_DRONE_ID] = {
      status: "idle",
      tileX: 39, // standard 80×50 grid center — no layout context available at this migration version
      tileY: 24,
      targetNodeId: null,
      cargo: null,
      ticksRemaining: 0,
      hubId: null,
      currentTaskType: null,
      deliveryTargetId: null,
      craftingJobId: null,
      droneId: STARTER_DRONE_ID,
    };
  }
  return {
    ...save,
    version: 12,
    drones,
  };
}

export function migrateV12ToV13(save: SaveGameV12): SaveGameV13 {
  const drones: Record<string, StarterDroneState> = {};
  for (const [id, drone] of Object.entries(save.drones ?? {})) {
    drones[id] = {
      ...drone,
      droneId: (drone as any).droneId ?? id,
      craftingJobId: (drone as any).craftingJobId ?? null,
    } as StarterDroneState;
  }
  const selectedStarter = selectMigratedStarter(save);
  const starter = selectedStarter
    ? ({
        ...selectedStarter,
        craftingJobId: (selectedStarter as any).craftingJobId ?? null,
      } as StarterDroneState)
    : selectedStarter;
  if (!drones[STARTER_DRONE_ID] && starter) {
    drones[STARTER_DRONE_ID] = starter;
  }
  return {
    ...save,
    version: 13,
    drones,
  };
}

export function migrateV13ToV14(save: SaveGameV13): SaveGameV14 {
  debugLog.general("Migration v13->v14: old save -> empty reservations/jobs");
  return {
    ...save,
    version: 14,
    network: createEmptyNetworkSlice(),
    crafting: createEmptyCraftingQueue(),
  };
}

export function migrateV14ToV15(save: SaveGameV14): SaveGameV15 {
  return {
    ...save,
    version: 15,
    keepStockByWorkbench: {},
  };
}

export function migrateV15ToV16(save: SaveGameV15): SaveGameV16 {
  return {
    ...save,
    version: 16,
    recipeAutomationPolicies: {},
  };
}

export function migrateV16ToV17(save: SaveGameV16): SaveGameV17 {
  return {
    ...save,
    version: 17,
    conveyorUndergroundPeers: {},
  };
}

export function migrateV17ToV18(save: SaveGameV17): SaveGameV18 {
  return {
    ...save,
    version: 18,
    autoAssemblers: {},
  };
}

export function migrateV18ToV19(save: SaveGameV18): SaveGameV19 {
  const splitterRouteState: Record<string, { lastSide: "left" | "right" }> = {};
  for (const [id, asset] of Object.entries(save.assets ?? {})) {
    if ((asset as PlacedAsset).type === "conveyor_splitter") {
      splitterRouteState[id] = { lastSide: "left" };
    }
  }
  return {
    ...save,
    version: 19,
    splitterRouteState,
  };
}

export function migrateV19ToV20(save: SaveGameV19): SaveGameV20 {
  return {
    ...save,
    version: 20,
    splitterFilterState: {},
  };
}
