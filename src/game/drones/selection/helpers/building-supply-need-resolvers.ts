import { getBuildingInputConfig } from "../../../store/constants/buildings";
import { MAX_DRONES_PER_BUILDING_SUPPLY } from "../../../store/constants/drone-assignment-caps";
import { DRONE_CAPACITY } from "../../../store/constants/drone-config";
import type {
  CollectableItemType,
  GameState,
} from "../../../store/types";

function getBuildingInputCurrent(
  state: Pick<GameState, "assets" | "generators">,
  assetId: string,
): number {
  const asset = state.assets[assetId];
  if (!asset) return 0;
  if (asset.type === "generator") return state.generators[assetId]?.fuel ?? 0;
  return 0;
}

export function getInboundBuildingSupplyAmount(
  state: Pick<GameState, "drones" | "collectionNodes">,
  assetId: string,
  itemType: CollectableItemType,
  excludeDroneId?: string,
): number {
  let total = 0;
  for (const drone of Object.values(state.drones)) {
    if (drone.droneId === excludeDroneId) continue;
    if (drone.deliveryTargetId !== assetId) continue;
    if (drone.currentTaskType !== "building_supply") continue;

    if (drone.cargo?.itemType === itemType) {
      total += drone.cargo.amount;
      continue;
    }
    if (drone.targetNodeId?.startsWith("hub:") || drone.targetNodeId?.startsWith("wh:")) {
      const [, , resource] = drone.targetNodeId.split(":");
      if (resource === itemType) total += DRONE_CAPACITY;
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

export function getRemainingBuildingInputDemand(
  state: Pick<GameState, "assets" | "generators" | "drones" | "collectionNodes">,
  assetId: string,
  itemType: CollectableItemType,
  excludeDroneId?: string,
): number {
  const asset = state.assets[assetId];
  if (!asset) return 0;
  const cfg = getBuildingInputConfig(asset.type);
  if (!cfg || cfg.resource !== itemType) return 0;
  const current = getBuildingInputCurrent(state, assetId);
  const inbound = getInboundBuildingSupplyAmount(state, assetId, itemType, excludeDroneId);
  let raw = Math.max(0, cfg.capacity - current - inbound);
  if (asset.type === "generator") {
    const requested = state.generators[assetId]?.requestedRefill ?? 0;
    const requestedRemaining = Math.max(0, requested - inbound);
    raw = Math.min(raw, requestedRemaining);
  }
  return raw;
}

export function getAssignedBuildingSupplyDroneCount(
  state: Pick<GameState, "drones">,
  assetId: string,
  excludeDroneId?: string,
): number {
  let total = 0;
  for (const drone of Object.values(state.drones)) {
    if (drone.droneId === excludeDroneId) continue;
    if (drone.deliveryTargetId !== assetId) continue;
    if (drone.currentTaskType === "building_supply") total++;
  }
  return total;
}

export function getOpenBuildingSupplyDroneSlots(
  state: Pick<GameState, "assets" | "generators" | "drones">,
  assetId: string,
  itemType: CollectableItemType,
  excludeDroneId?: string,
): number {
  const asset = state.assets[assetId];
  if (!asset) return 0;
  const cfg = getBuildingInputConfig(asset.type);
  if (!cfg || cfg.resource !== itemType) return 0;
  const current = getBuildingInputCurrent(state, assetId);
  let rawNeed = Math.max(0, cfg.capacity - current);
  if (asset.type === "generator") {
    const requested = state.generators[assetId]?.requestedRefill ?? 0;
    rawNeed = Math.min(rawNeed, requested);
  }
  const desiredDrones = Math.min(MAX_DRONES_PER_BUILDING_SUPPLY, Math.ceil(rawNeed / DRONE_CAPACITY));
  const assigned = getAssignedBuildingSupplyDroneCount(state, assetId, excludeDroneId);
  return Math.max(0, desiredDrones - assigned);
}
