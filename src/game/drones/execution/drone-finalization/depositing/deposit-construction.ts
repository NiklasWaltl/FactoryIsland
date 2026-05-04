import { addResources } from "../../../../store/inventory-ops";
import { computeConnectedAssetIds } from "../../../../logistics/connectivity";
import { applyDroneUpdate } from "../../../utils/drone-state-helpers";
import type { ConstructionSite, GameState } from "../../../../store/types";
import { finalizeHubAfterConstruction } from "./deposit-hub-upgrade";
import type { ConstructionDepositContext } from "./types";

export function depositConstruction(
  state: GameState,
  droneId: string,
  context: ConstructionDepositContext,
): GameState {
  const { deliveryId, idleDrone, cargo, deps } = context;
  const { itemType, amount } = cargo;
  const { debugLog } = deps;

  const site = state.constructionSites[deliveryId];
  if (!site) {
    debugLog.inventory(
      `Drone construction target gone, depositing ${amount}× ${itemType} into global inventory`,
    );
    return applyDroneUpdate(
      {
        ...state,
        inventory: addResources(state.inventory, { [itemType]: amount }),
      },
      droneId,
      idleDrone,
    );
  }

  const needed = site.remaining[itemType] ?? 0;
  const applied = Math.min(amount, needed);
  const leftover = amount - applied;
  const newRemaining = { ...site.remaining };
  const newNeeded = needed - applied;
  if (newNeeded <= 0) {
    delete newRemaining[itemType];
  } else {
    newRemaining[itemType] = newNeeded;
  }
  const isComplete = Object.values(newRemaining).every(
    (value) => (value ?? 0) <= 0,
  );
  const isHubUpgradeSite =
    site.buildingType === "service_hub" &&
    !!state.serviceHubs[deliveryId]?.pendingUpgrade;
  let newSites: Record<string, ConstructionSite>;
  if (isComplete) {
    const { [deliveryId]: _, ...rest } = state.constructionSites;
    newSites = rest;
    debugLog.building(`[Drone] Construction site ${deliveryId} completed`);
  } else {
    newSites = {
      ...state.constructionSites,
      [deliveryId]: { ...site, remaining: newRemaining },
    };
  }
  const newInv =
    leftover > 0
      ? addResources(state.inventory, { [itemType]: leftover })
      : state.inventory;
  debugLog.inventory(
    `Drone deposited ${applied}× ${itemType} into construction site ${deliveryId}` +
      (leftover > 0 ? ` (${leftover} overflow → global)` : ""),
  );
  if (import.meta.env.DEV && isHubUpgradeSite) {
    const remainingAfter = newRemaining[itemType] ?? 0;
    debugLog.building(
      `[HubUpgrade] Delivery applied to ${deliveryId}: ${applied}× ${itemType}, remaining ${itemType}=${remainingAfter}`,
    );
  }
  let completionState = applyDroneUpdate(
    { ...state, constructionSites: newSites, inventory: newInv },
    droneId,
    idleDrone,
  );
  if (isComplete) {
    completionState = {
      ...completionState,
      connectedAssetIds: computeConnectedAssetIds(completionState),
    };
    completionState = finalizeHubAfterConstruction(completionState, {
      deps,
      deliveryId,
    });
  }
  return completionState;
}
