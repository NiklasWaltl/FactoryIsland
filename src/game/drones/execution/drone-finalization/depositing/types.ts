import type {
  DroneCargoItem,
  GameState,
  StarterDroneState,
} from "../../../../store/types";
import type { DroneFinalizationDeps } from "../types";

export interface DepositFinalizerCommonDeps {
  deps: DroneFinalizationDeps;
  idleDrone: StarterDroneState;
  cargo: DroneCargoItem;
}

export interface ShipDockDepositContext extends DepositFinalizerCommonDeps {
  deliveryId: string;
}

export interface GeneratorDepositContext extends DepositFinalizerCommonDeps {
  deliveryId: string;
}

export interface ConstructionDepositContext extends DepositFinalizerCommonDeps {
  deliveryId: string;
}

export interface HubUpgradeAfterConstructionContext {
  deps: DroneFinalizationDeps;
  deliveryId: string;
}

export interface FallbackDepositContext extends DepositFinalizerCommonDeps {
  drone: StarterDroneState;
}

export type BuildingSupplyDepositOutcome =
  | { handled: true; outcome: "deposited"; nextState: GameState }
  | { handled: false; outcome: "not_deposited" };
