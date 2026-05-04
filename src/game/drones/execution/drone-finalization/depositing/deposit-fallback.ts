import {
  finalizeHubTier2Upgrade,
  createEmptyHubInventory,
} from "../../../../buildings/service-hub/hub-upgrade-workflow";
import { createDefaultProtoHubTargetStock } from "../../../../store/constants/hub/hub-target-stock";
import { isHubUpgradeDeliverySatisfied } from "../../../../buildings/service-hub/hub-upgrade-status";
import { addResources } from "../../../../store/inventory-ops";
import { getDroneDockOffset } from "../../../dock/drone-dock-geometry";
import {
  syncDrones,
  applyDroneUpdate,
} from "../../../utils/drone-state-helpers";
import type { GameState, ServiceHubInventory } from "../../../../store/types";
import type { FallbackDepositContext } from "./types";

export function depositFallback(
  state: GameState,
  droneId: string,
  context: FallbackDepositContext,
): GameState {
  const { drone, idleDrone, cargo, deps } = context;
  const { itemType, amount } = cargo;
  const { makeId, addNotification, debugLog } = deps;

  // hub_restock: deposit into hub inventory when assigned
  let hubEntry = drone.hubId ? (state.serviceHubs[drone.hubId] ?? null) : null;
  let depositState = state;
  // Self-heal: hub asset exists but serviceHubs entry is missing
  if (
    !hubEntry &&
    drone.hubId &&
    state.assets[drone.hubId]?.type === "service_hub"
  ) {
    debugLog.inventory(
      `[Drone] Hub entry missing for ${drone.hubId} during deposit — self-healing`,
    );
    hubEntry = {
      inventory: createEmptyHubInventory(),
      targetStock: createDefaultProtoHubTargetStock(),
      tier: 1,
      droneIds: [drone.droneId],
    };
    depositState = {
      ...state,
      serviceHubs: {
        ...state.serviceHubs,
        [drone.hubId]: hubEntry,
      },
    };
  }
  if (hubEntry && drone.hubId) {
    const updatedHubInv: ServiceHubInventory = {
      ...hubEntry.inventory,
      [itemType]: (hubEntry.inventory[itemType] ?? 0) + amount,
    };
    debugLog.inventory(
      `Drone deposited ${amount}× ${itemType} into Service-Hub`,
    );
    const afterDeposit: GameState = {
      ...depositState,
      serviceHubs: {
        ...depositState.serviceHubs,
        [drone.hubId]: { ...hubEntry, inventory: updatedHubInv },
      },
    };
    const updatedHubEntry = afterDeposit.serviceHubs[drone.hubId];
    const finalized = isHubUpgradeDeliverySatisfied(updatedHubEntry)
      ? finalizeHubTier2Upgrade(afterDeposit, drone.hubId, {
          makeId,
          getDroneDockOffset,
          addNotification,
          syncDrones,
        })
      : afterDeposit;
    return applyDroneUpdate(finalized, droneId, idleDrone);
  }

  // Fallback: global inventory
  debugLog.inventory(`Drone deposited ${amount}× ${itemType} into Startmodul`);
  if (import.meta.env.DEV) {
    const waitingJob = (state.crafting?.jobs ?? []).find(
      (job) =>
        (job.status === "queued" || job.status === "reserved") &&
        job.ingredients.some((ingredient) => ingredient.itemId === itemType),
    );
    if (waitingJob) {
      debugLog.inventory(
        `[Drone] Drohne ${drone.droneId}: delivering ${amount}× ${itemType} for Job ${waitingJob.id} (${waitingJob.status}) → global pool`,
      );
    }
  }
  return applyDroneUpdate(
    {
      ...state,
      inventory: addResources(state.inventory, { [itemType]: amount }),
    },
    droneId,
    idleDrone,
  );
}
