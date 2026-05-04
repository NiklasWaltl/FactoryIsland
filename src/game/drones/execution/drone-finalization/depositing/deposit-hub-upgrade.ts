import { finalizeHubTier2Upgrade } from "../../../../buildings/service-hub/hub-upgrade-workflow";
import { getMaxDrones } from "../../../../store/selectors/hub-tier-selectors";
import { getDroneDockOffset } from "../../../dock/drone-dock-geometry";
import { syncDrones } from "../../../utils/drone-state-helpers";
import type { GameState, StarterDroneState } from "../../../../store/types";
import type { HubUpgradeAfterConstructionContext } from "./types";

export function finalizeHubAfterConstruction(
  state: GameState,
  context: HubUpgradeAfterConstructionContext,
): GameState {
  const { deliveryId, deps } = context;
  const { makeId, addNotification, debugLog } = deps;

  const completedAsset = state.assets[deliveryId];
  if (completedAsset?.type !== "service_hub") {
    return state;
  }
  const hubEntry = state.serviceHubs[deliveryId];
  if (!hubEntry) {
    return state;
  }

  if (hubEntry.pendingUpgrade) {
    if (import.meta.env.DEV) {
      debugLog.building(
        `[HubUpgrade] Upgrade demand for ${deliveryId} fully delivered via construction flow — finalizing tier upgrade.`,
      );
    }
    return finalizeHubTier2Upgrade(
      state,
      deliveryId,
      {
        makeId,
        getDroneDockOffset,
        addNotification,
        syncDrones,
      },
      {
        deductPendingFromHubInventory: false,
      },
    );
  }

  if (hubEntry.droneIds.length < getMaxDrones(hubEntry.tier)) {
    // New Proto-Hub construction: spawn its first drone after completion.
    const newDroneId = `drone-${makeId()}`;
    const dockSlot = hubEntry.droneIds.length;
    const offset = getDroneDockOffset(dockSlot);
    const spawnedDrone: StarterDroneState = {
      status: "idle",
      tileX: completedAsset.x + offset.dx,
      tileY: completedAsset.y + offset.dy,
      targetNodeId: null,
      cargo: null,
      ticksRemaining: 0,
      hubId: deliveryId,
      currentTaskType: null,
      deliveryTargetId: null,
      craftingJobId: null,
      droneId: newDroneId,
    };
    debugLog.building(
      `[Drone] Drohne ${newDroneId} für neuen Hub ${deliveryId} gespawnt nach Bauabschluss.`,
    );
    return {
      ...state,
      drones: { ...state.drones, [newDroneId]: spawnedDrone },
      serviceHubs: {
        ...state.serviceHubs,
        [deliveryId]: {
          ...hubEntry,
          droneIds: [...hubEntry.droneIds, newDroneId],
        },
      },
    };
  }

  return state;
}
