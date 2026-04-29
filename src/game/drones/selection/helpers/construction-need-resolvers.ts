import { MAX_DRONES_PER_CONSTRUCTION_TARGET } from "../../../store/constants/drone-assignment-caps";
import { DRONE_CAPACITY } from "../../../store/constants/drone-config";
import type {
  CollectableItemType,
  ConstructionSite,
  GameState,
} from "../../../store/types";

export function getInboundConstructionAmount(
  state: Pick<GameState, "drones" | "collectionNodes">,
  siteId: string,
  itemType: CollectableItemType,
  excludeDroneId?: string,
): number {
  let total = 0;
  for (const drone of Object.values(state.drones)) {
    if (drone.droneId === excludeDroneId) continue;
    if (drone.deliveryTargetId !== siteId) continue;

    if (drone.currentTaskType === "hub_dispatch" && (drone.targetNodeId?.startsWith("hub:") || drone.targetNodeId?.startsWith("wh:"))) {
      const [, , resource] = drone.targetNodeId.split(":");
      if (resource === itemType) total += DRONE_CAPACITY;
      continue;
    }

    if (drone.currentTaskType !== "construction_supply") continue;

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

export function getAssignedConstructionDroneCount(
  state: Pick<GameState, "drones">,
  siteId: string,
  excludeDroneId?: string,
): number {
  let total = 0;
  for (const drone of Object.values(state.drones)) {
    if (drone.droneId === excludeDroneId) continue;
    if (drone.deliveryTargetId !== siteId) continue;
    if (drone.currentTaskType === "construction_supply" || drone.currentTaskType === "hub_dispatch") {
      total++;
    }
  }
  return total;
}

function getDesiredConstructionDroneCount(site: ConstructionSite): number {
  let desired = 0;
  for (const amount of Object.values(site.remaining)) {
    if ((amount ?? 0) <= 0) continue;
    desired += Math.ceil((amount ?? 0) / DRONE_CAPACITY);
  }
  return Math.min(MAX_DRONES_PER_CONSTRUCTION_TARGET, desired);
}

export function getRemainingConstructionNeed(
  state: Pick<GameState, "drones" | "collectionNodes" | "constructionSites">,
  siteId: string,
  itemType: CollectableItemType,
  excludeDroneId?: string,
): number {
  const site = state.constructionSites[siteId];
  if (!site) return 0;
  const remaining = site.remaining[itemType] ?? 0;
  const inbound = getInboundConstructionAmount(state, siteId, itemType, excludeDroneId);
  return Math.max(0, remaining - inbound);
}

export function getOpenConstructionDroneSlots(
  state: Pick<GameState, "drones" | "constructionSites">,
  siteId: string,
  excludeDroneId?: string,
): number {
  const site = state.constructionSites[siteId];
  if (!site) return 0;
  const desired = getDesiredConstructionDroneCount(site);
  const assigned = getAssignedConstructionDroneCount(state, siteId, excludeDroneId);
  return Math.max(0, desired - assigned);
}
