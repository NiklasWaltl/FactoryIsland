import { addResources } from "../../../../store/inventory-ops";
import { applyDroneUpdate } from "../../../utils/drone-state-helpers";
import type {
  CollectableItemType,
  GameState,
  StarterDroneState,
} from "../../../../store/types";
import type { DroneFinalizationDeps } from "../types";

interface DeconstructDepositContext {
  drone: StarterDroneState;
  idleDrone: StarterDroneState;
  deconstructRefund: Partial<Record<CollectableItemType, number>>;
  deps: DroneFinalizationDeps;
}

export function depositDeconstructRefund(
  state: GameState,
  droneId: string,
  context: DeconstructDepositContext,
): GameState {
  const { drone, idleDrone, deconstructRefund, deps } = context;
  const { debugLog } = deps;

  const entries = Object.entries(deconstructRefund).filter(
    ([, amount]) => (amount ?? 0) > 0,
  ) as Array<[CollectableItemType, number]>;

  if (entries.length === 0) {
    return applyDroneUpdate(state, droneId, idleDrone);
  }

  if (drone.hubId && state.serviceHubs[drone.hubId]) {
    const hubEntry = state.serviceHubs[drone.hubId];
    const updatedHubInventory = { ...hubEntry.inventory };
    for (const [itemType, amount] of entries) {
      updatedHubInventory[itemType] =
        (updatedHubInventory[itemType] ?? 0) + amount;
    }
    debugLog.inventory(
      `[Drone] deconstruct: deposited salvage into hub ${drone.hubId}`,
    );
    return applyDroneUpdate(
      {
        ...state,
        serviceHubs: {
          ...state.serviceHubs,
          [drone.hubId]: {
            ...hubEntry,
            inventory: updatedHubInventory,
          },
        },
      },
      droneId,
      idleDrone,
    );
  }

  debugLog.inventory(
    "[Drone] deconstruct: deposited salvage into global inventory",
  );
  return applyDroneUpdate(
    {
      ...state,
      inventory: addResources(state.inventory, deconstructRefund),
    },
    droneId,
    idleDrone,
  );
}
