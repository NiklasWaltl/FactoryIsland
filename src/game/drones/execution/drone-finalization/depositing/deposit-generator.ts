import { addResources } from "../../../../store/inventory-ops";
import { getBuildingInputConfig } from "../../../../store/constants/buildings/index";
import { applyDroneUpdate } from "../../../utils/drone-state-helpers";
import type { GameState } from "../../../../store/types";
import type {
  BuildingSupplyDepositOutcome,
  GeneratorDepositContext,
} from "./types";

export function depositGenerator(
  state: GameState,
  droneId: string,
  context: GeneratorDepositContext,
): BuildingSupplyDepositOutcome {
  const { deliveryId, idleDrone, cargo, deps } = context;
  const { itemType, amount } = cargo;
  const { debugLog } = deps;

  const targetAsset = state.assets[deliveryId];
  if (!targetAsset || targetAsset.type !== "generator") {
    return { handled: false, outcome: "not_deposited" };
  }
  const cfg = getBuildingInputConfig(targetAsset.type);
  if (!cfg || cfg.resource !== itemType) {
    return { handled: false, outcome: "not_deposited" };
  }
  const gen = state.generators[deliveryId];
  if (!gen) {
    return { handled: false, outcome: "not_deposited" };
  }

  const space = Math.max(0, cfg.capacity - gen.fuel);
  if (space <= 0) {
    return { handled: false, outcome: "not_deposited" };
  }
  const applied = Math.min(amount, space);
  const leftover = amount - applied;
  const nextRequested = Math.max(0, (gen.requestedRefill ?? 0) - applied);
  const newGenerators = {
    ...state.generators,
    [deliveryId]: {
      ...gen,
      fuel: gen.fuel + applied,
      requestedRefill: nextRequested,
    },
  };
  const newInv =
    leftover > 0
      ? addResources(state.inventory, { [itemType]: leftover })
      : state.inventory;
  debugLog.inventory(
    `Drone deposited ${applied}× ${itemType} into generator ${deliveryId} (fuel ${gen.fuel} → ${gen.fuel + applied}/${cfg.capacity})` +
      (leftover > 0 ? ` (${leftover} overflow → global)` : ""),
  );
  const nextState = applyDroneUpdate(
    { ...state, generators: newGenerators, inventory: newInv },
    droneId,
    idleDrone,
  );
  return { handled: true, outcome: "deposited", nextState };
}
