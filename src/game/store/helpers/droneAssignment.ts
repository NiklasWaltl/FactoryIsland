import { getDroneDockOffset } from "../../drones/dock/drone-dock-geometry";
import { getMaxDrones } from "../selectors/hub-tier-selectors";
import type { GameState, StarterDroneState } from "../types";

export type DroneHubAssignmentPreflightResult =
  | {
      valid: true;
      dockPos: { x: number; y: number };
    }
  | {
      valid: false;
      reason: "hub_or_asset_missing" | "drone_missing" | "hub_full";
    }
  | null;

export function validateDroneHubAssignment(input: {
  droneId: string;
  hubId: string;
  hubs: GameState["serviceHubs"];
  assets: GameState["assets"];
  starter: StarterDroneState;
  drones: GameState["drones"];
}): DroneHubAssignmentPreflightResult {
  const targetHub = input.hubs[input.hubId];
  const hubAsset = input.assets[input.hubId];
  if (!targetHub || !hubAsset) {
    return { valid: false, reason: "hub_or_asset_missing" };
  }

  const drone =
    input.droneId === input.starter.droneId
      ? input.starter
      : (input.drones[input.droneId] ?? null);
  if (!drone) {
    return { valid: false, reason: "drone_missing" };
  }

  const maxSlots = getMaxDrones(targetHub.tier);
  if (
    !targetHub.droneIds.includes(input.droneId) &&
    targetHub.droneIds.length >= maxSlots
  ) {
    return { valid: false, reason: "hub_full" };
  }

  const nextDroneIds = targetHub.droneIds.includes(input.droneId)
    ? [...targetHub.droneIds]
    : [...targetHub.droneIds, input.droneId];
  const dockSlot = nextDroneIds.indexOf(input.droneId);
  const offset = getDroneDockOffset(dockSlot);

  return {
    valid: true,
    dockPos: {
      x: hubAsset.x + offset.dx,
      y: hubAsset.y + offset.dy,
    },
  };
}
