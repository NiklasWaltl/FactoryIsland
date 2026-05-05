import type { AssetType, DroneStatus, GameState } from "../types";

export type DeconstructQueueStatus = "open" | "reserved" | "active";

export interface DeconstructRequestQueueRow {
  readonly assetId: string;
  readonly assetType: AssetType;
  readonly x: number;
  readonly y: number;
  readonly queueStatus: DeconstructQueueStatus;
  readonly assignedDroneId?: string;
  readonly assignedDroneStatus?: DroneStatus;
  /**
   * 1-based order in DRONE_TICK iteration (`Object.keys(state.drones)`).
   * This is the only explicit ordering signal available for assigned targets.
   */
  readonly tickOrderIndex?: number;
}

interface AssignedDeconstructDrone {
  readonly droneId: string;
  readonly droneStatus: DroneStatus;
  readonly tickOrderIndex: number;
}

function buildAssignedDeconstructDroneMap(
  state: Pick<GameState, "assets" | "drones">,
): Record<string, AssignedDeconstructDrone> {
  const assignedByAssetId: Record<string, AssignedDeconstructDrone> = {};
  const droneIds = Object.keys(state.drones);

  for (let index = 0; index < droneIds.length; index += 1) {
    const droneId = droneIds[index];
    const drone = state.drones[droneId];
    if (!drone || drone.currentTaskType !== "deconstruct") continue;

    const targetAssetId = drone.deliveryTargetId ?? drone.targetNodeId;
    if (!targetAssetId) continue;

    const targetAsset = state.assets[targetAssetId];
    if (!targetAsset || targetAsset.status !== "deconstructing") continue;

    // Keep the first drone in tick order as the canonical assignment marker.
    if (assignedByAssetId[targetAssetId]) continue;

    assignedByAssetId[targetAssetId] = {
      droneId,
      droneStatus: drone.status,
      tickOrderIndex: index + 1,
    };
  }

  return assignedByAssetId;
}

function toQueueStatus(
  assignedDrone: AssignedDeconstructDrone | undefined,
): DeconstructQueueStatus {
  if (!assignedDrone) return "open";
  return assignedDrone.droneStatus === "moving_to_collect"
    ? "reserved"
    : "active";
}

export function getDeconstructRequestQueueRows(
  state: Pick<GameState, "assets" | "drones">,
): DeconstructRequestQueueRow[] {
  const assignedByAssetId = buildAssignedDeconstructDroneMap(state);

  const rows = Object.values(state.assets)
    .filter((asset) => asset.status === "deconstructing")
    .map((asset) => {
      const assignedDrone = assignedByAssetId[asset.id];
      return {
        assetId: asset.id,
        assetType: asset.type,
        x: asset.x,
        y: asset.y,
        queueStatus: toQueueStatus(assignedDrone),
        assignedDroneId: assignedDrone?.droneId,
        assignedDroneStatus: assignedDrone?.droneStatus,
        tickOrderIndex: assignedDrone?.tickOrderIndex,
      } satisfies DeconstructRequestQueueRow;
    });

  rows.sort((left, right) => {
    const leftOrder = left.tickOrderIndex ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.tickOrderIndex ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.assetId.localeCompare(right.assetId);
  });

  return rows;
}
