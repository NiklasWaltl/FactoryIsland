import type {
  CollectionNode,
  GeneratorState,
  HubTier,
  PlacedAsset,
  ServiceHubEntry,
  StarterDroneState,
} from "../../store/types";
import { createEmptyHubInventory } from "../../buildings/service-hub/hub-upgrade-workflow";
import { createDefaultHubTargetStock } from "../../store/constants/hub/hub-target-stock";
import { requireMigratedStarter } from "./helpers";
import type {
  SaveGameV1,
  SaveGameV2,
  SaveGameV3,
  SaveGameV4,
  SaveGameV5,
  SaveGameV6,
  SaveGameV7,
  SaveGameV8,
  SaveGameV9,
  SaveGameV10,
} from "./types";

export function migrateV1ToV2(save: SaveGameV1): SaveGameV2 {
  const oldGen: GeneratorState = save.generator ?? {
    fuel: 0,
    progress: 0,
    running: false,
  };
  const generators: Record<string, GeneratorState> = {};
  let first = true;
  for (const [id, asset] of Object.entries(save.assets ?? {})) {
    if ((asset as PlacedAsset).type === "generator") {
      generators[id] = first
        ? { ...oldGen }
        : { fuel: 0, progress: 0, running: false };
      first = false;
    }
  }
  const { generator: _dropped, ...rest } = save as any;
  return { ...rest, version: 2, generators } as SaveGameV2;
}

export function migrateV2ToV3(save: SaveGameV2): SaveGameV3 {
  return { ...save, version: 3, collectionNodes: {} };
}

export function migrateV3ToV4(save: SaveGameV3): SaveGameV4 {
  const starterDrone: StarterDroneState = {
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
    droneId: "starter",
  };
  return { ...save, version: 4, starterDrone };
}

export function migrateV4ToV5(save: SaveGameV4): SaveGameV5 {
  const starter = requireMigratedStarter(save);
  return {
    ...save,
    version: 5,
    starterDrone: { ...starter, hubId: null },
  };
}

export function migrateV5ToV6(save: SaveGameV5): SaveGameV6 {
  const serviceHubs: Record<string, ServiceHubEntry> = {};
  for (const [id, asset] of Object.entries(save.assets)) {
    if (asset.type === "service_hub") {
      serviceHubs[id] = {
        inventory: createEmptyHubInventory(),
        targetStock: createDefaultHubTargetStock(),
        tier: 2,
        droneIds: [],
      };
    }
  }
  return {
    ...save,
    version: 6,
    serviceHubs,
  };
}

export function migrateV6ToV7(save: SaveGameV6): SaveGameV7 {
  const starter = requireMigratedStarter(save);
  return {
    ...save,
    version: 7,
    constructionSites: {},
    starterDrone: {
      ...starter,
      currentTaskType: null,
      deliveryTargetId: null,
    },
  };
}

export function migrateV7ToV8(save: SaveGameV7): SaveGameV8 {
  const starter = requireMigratedStarter(save);
  const clearedNodes: Record<string, CollectionNode> = {};
  for (const [id, node] of Object.entries(save.collectionNodes ?? {})) {
    clearedNodes[id] = { ...node, reservedByDroneId: null };
  }
  return {
    ...save,
    version: 8,
    collectionNodes: clearedNodes,
    starterDrone: {
      ...starter,
      droneId: "starter",
    },
  };
}

export function migrateV8ToV9(save: SaveGameV8): SaveGameV9 {
  const migratedHubs: Record<string, ServiceHubEntry> = {};
  for (const [id, entry] of Object.entries(save.serviceHubs ?? {})) {
    migratedHubs[id] = {
      ...entry,
      targetStock: (entry as any).targetStock ?? createDefaultHubTargetStock(),
    };
  }
  return {
    ...save,
    version: 9,
    serviceHubs: migratedHubs,
  };
}

export function migrateV9ToV10(save: SaveGameV9): SaveGameV10 {
  const migratedHubs: Record<string, ServiceHubEntry> = {};
  for (const [id, entry] of Object.entries(save.serviceHubs ?? {})) {
    migratedHubs[id] = {
      ...entry,
      tier: ((entry as any).tier as HubTier) ?? 2,
    };
  }
  return {
    ...save,
    version: 10,
    serviceHubs: migratedHubs,
  };
}
