// Drone and building-supply helper functions extracted from reducer.ts.
// No logic changes - moved verbatim or delegated to existing canonical modules.

import {
  getInboundBuildingSupplyAmount as getInboundBuildingSupplyAmountResolver,
  getRemainingBuildingInputDemand as getRemainingBuildingInputDemandResolver,
} from "../../drones/selection/helpers/need-slot-resolvers";
import {
  selectDroneTask as selectDroneTaskBinding,
} from "../../drones/selection/select-drone-task-bindings";
import {
  getDroneDockSlotIndex,
  getDroneHomeDock,
  isDroneParkedAtHub,
  getParkedDrones,
} from "../../drones/dock/drone-dock";
import { getDroneStatusDetail as getDroneStatusDetailClassifier } from "../selectors/drone-status-detail";
import type {
  CollectableItemType,
  DroneTaskType,
  GameState,
  StarterDroneState,
} from "../types";

export {
  getDroneDockSlotIndex,
  getDroneHomeDock,
  isDroneParkedAtHub,
  getParkedDrones,
};

/** Get all drones assigned to a specific hub. */
export function getHubDrones(state: GameState, hubId: string): StarterDroneState[] {
  const hub = state.serviceHubs[hubId];
  if (!hub) return [];
  return hub.droneIds.map((id) => state.drones[id]).filter(Boolean);
}

/** Produce a human-readable status detail for a drone (for UI display). */
export function getDroneStatusDetail(state: GameState, drone: StarterDroneState): { label: string; taskGoal?: string } {
  return getDroneStatusDetailClassifier(state, drone);
}

/** Reads the current amount in a building's input buffer. */
export function getBuildingInputCurrent(
  state: Pick<GameState, "assets" | "generators">,
  assetId: string,
): number {
  const asset = state.assets[assetId];
  if (!asset) return 0;
  if (asset.type === "generator") return state.generators[assetId]?.fuel ?? 0;
  return 0;
}

/** Counts in-flight building_supply cargo + reservations + hub-bound trips heading into `assetId`. */
export function getInboundBuildingSupplyAmount(
  state: Pick<GameState, "drones" | "collectionNodes">,
  assetId: string,
  itemType: CollectableItemType,
  excludeDroneId?: string,
): number {
  return getInboundBuildingSupplyAmountResolver(state, assetId, itemType, excludeDroneId);
}

/** Open delivery demand for a building's input buffer (capacity - current - inbound). */
export function getRemainingBuildingInputDemand(
  state: Pick<GameState, "assets" | "generators" | "drones" | "collectionNodes">,
  assetId: string,
  itemType: CollectableItemType,
  excludeDroneId?: string,
): number {
  return getRemainingBuildingInputDemandResolver(state, assetId, itemType, excludeDroneId);
}

/** Selects the highest-scoring drone task from all valid candidates. */
export function selectDroneTask(state: GameState, droneOverride?: StarterDroneState): {
  taskType: DroneTaskType;
  nodeId: string;
  deliveryTargetId: string;
} | null {
  return selectDroneTaskBinding(state, droneOverride);
}
