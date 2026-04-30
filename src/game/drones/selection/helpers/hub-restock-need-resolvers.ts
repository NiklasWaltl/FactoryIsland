import { MAX_DRONES_PER_HUB_RESTOCK_RESOURCE } from "../../../store/constants/drone/drone-assignment-caps";
import { DRONE_CAPACITY } from "../../../store/constants/drone/drone-config";
import type {
  CollectableItemType,
  GameState,
} from "../../../store/types";

function hasHubUpgradeConstructionSite(
  state: Pick<GameState, "constructionSites">,
  hubId: string,
): boolean {
  const site = state.constructionSites[hubId];
  return !!site && site.buildingType === "service_hub";
}

export function getInboundHubRestockAmount(
  state: Pick<GameState, "drones" | "collectionNodes">,
  hubId: string,
  itemType: CollectableItemType,
  excludeDroneId?: string,
): number {
  let total = 0;
  for (const drone of Object.values(state.drones)) {
    if (drone.droneId === excludeDroneId) continue;
    if (drone.hubId !== hubId) continue;
    if (drone.currentTaskType !== "hub_restock") continue;

    if (drone.cargo?.itemType === itemType) {
      total += drone.cargo.amount;
      continue;
    }

    if ((drone.status === "moving_to_collect" || drone.status === "collecting") && drone.targetNodeId) {
      const node = state.collectionNodes[drone.targetNodeId];
      if (node?.itemType === itemType && node.reservedByDroneId === drone.droneId) {
        total += Math.min(DRONE_CAPACITY, node.amount);
      }
    }
  }
  return total;
}

export function getInboundHubRestockDroneCount(
  state: Pick<GameState, "drones" | "collectionNodes">,
  hubId: string,
  itemType: CollectableItemType,
  excludeDroneId?: string,
): number {
  let total = 0;
  for (const drone of Object.values(state.drones)) {
    if (drone.droneId === excludeDroneId) continue;
    if (drone.hubId !== hubId) continue;
    if (drone.currentTaskType !== "hub_restock") continue;

    if (drone.cargo?.itemType === itemType) {
      total++;
      continue;
    }

    if ((drone.status === "moving_to_collect" || drone.status === "collecting") && drone.targetNodeId) {
      const node = state.collectionNodes[drone.targetNodeId];
      if (node?.itemType === itemType && node.reservedByDroneId === drone.droneId) {
        total++;
      }
    }
  }
  return total;
}

export function getRemainingHubRestockNeed(
  state: Pick<GameState, "drones" | "collectionNodes" | "serviceHubs" | "constructionSites">,
  hubId: string,
  itemType: CollectableItemType,
  excludeDroneId?: string,
): number {
  const hubEntry = state.serviceHubs[hubId];
  if (!hubEntry) return 0;
  const current = hubEntry.inventory[itemType] ?? 0;
  const target = hubEntry.targetStock[itemType] ?? 0;
  const upgradeNeed = hasHubUpgradeConstructionSite(state, hubId)
    ? 0
    : (hubEntry.pendingUpgrade?.[itemType] ?? 0);
  const effectiveTarget = target + upgradeNeed;
  const inbound = getInboundHubRestockAmount(state, hubId, itemType, excludeDroneId);
  return Math.max(0, effectiveTarget - current - inbound);
}

export function getOpenHubRestockDroneSlots(
  state: Pick<GameState, "drones" | "collectionNodes" | "serviceHubs" | "constructionSites">,
  hubId: string,
  itemType: CollectableItemType,
  excludeDroneId?: string,
): number {
  const hubEntry = state.serviceHubs[hubId];
  if (!hubEntry) return 0;
  const current = hubEntry.inventory[itemType] ?? 0;
  const target = hubEntry.targetStock[itemType] ?? 0;
  const upgradeNeed = hasHubUpgradeConstructionSite(state, hubId)
    ? 0
    : (hubEntry.pendingUpgrade?.[itemType] ?? 0);
  const rawNeed = Math.max(0, target + upgradeNeed - current);
  const desiredDrones = Math.min(MAX_DRONES_PER_HUB_RESTOCK_RESOURCE, Math.ceil(rawNeed / DRONE_CAPACITY));
  const assignedDrones = getInboundHubRestockDroneCount(state, hubId, itemType, excludeDroneId);
  return Math.max(0, desiredDrones - assignedDrones);
}

export function getInboundHubDispatchAmount(
  state: Pick<GameState, "drones">,
  hubId: string,
  itemType: CollectableItemType,
  excludeDroneId?: string,
): number {
  let total = 0;
  for (const drone of Object.values(state.drones)) {
    if (drone.droneId === excludeDroneId) continue;
    if (drone.currentTaskType !== "hub_dispatch") continue;
    if (!drone.targetNodeId?.startsWith(`hub:${hubId}:`)) continue;
    const [, , resource] = drone.targetNodeId.split(":");
    if (resource !== itemType) continue;
    total += DRONE_CAPACITY;
  }
  return total;
}

export function getInboundWarehouseDispatchAmount(
  state: Pick<GameState, "drones">,
  warehouseId: string,
  itemType: CollectableItemType,
  excludeDroneId?: string,
): number {
  let total = 0;
  const prefix = `wh:${warehouseId}:`;
  for (const drone of Object.values(state.drones)) {
    if (drone.droneId === excludeDroneId) continue;
    if (drone.currentTaskType !== "hub_dispatch" && drone.currentTaskType !== "building_supply") continue;
    if (!drone.targetNodeId?.startsWith(prefix)) continue;
    const [, , resource] = drone.targetNodeId.split(":");
    if (resource !== itemType) continue;
    total += DRONE_CAPACITY;
  }
  return total;
}

export function getInboundHubBuildingSupplyAmount(
  state: Pick<GameState, "drones">,
  hubId: string,
  itemType: CollectableItemType,
  excludeDroneId?: string,
): number {
  let total = 0;
  for (const drone of Object.values(state.drones)) {
    if (drone.droneId === excludeDroneId) continue;
    if (drone.currentTaskType !== "building_supply") continue;
    if (!drone.targetNodeId?.startsWith(`hub:${hubId}:`)) continue;
    const [, , resource] = drone.targetNodeId.split(":");
    if (resource !== itemType) continue;
    total += DRONE_CAPACITY;
  }
  return total;
}
