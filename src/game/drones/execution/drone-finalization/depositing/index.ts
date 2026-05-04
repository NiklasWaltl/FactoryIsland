import { applyDroneUpdate } from "../../../utils/drone-state-helpers";
import { parseWorkbenchTaskNodeId } from "../../../../store/workbench/workbench-task-utils";
import {
  finalizeWorkbenchDelivery,
  finalizeWorkbenchInputDelivery,
} from "../../workbench-finalizer-bindings";
import type {
  DroneCargoItem,
  GameState,
  StarterDroneState,
} from "../../../../store/types";
import { decideDepositingTaskRoute } from "../../../utils/drone-utils";
import type { WorkbenchInputTask } from "../../workbench-finalizers";
import type { DroneFinalizationDeps } from "../types";
import { depositConstruction } from "./deposit-construction";
import { depositFallback } from "./deposit-fallback";
import { depositGenerator } from "./deposit-generator";
import { depositShipDock } from "./deposit-ship-dock";

export function handleDepositingStatus(
  state: GameState,
  droneId: string,
  drone: StarterDroneState,
  deps: DroneFinalizationDeps,
): GameState {
  const rem = drone.ticksRemaining - 1;
  if (rem > 0)
    return applyDroneUpdate(state, droneId, { ...drone, ticksRemaining: rem });

  const idleDrone: StarterDroneState = {
    ...drone,
    status: "idle",
    targetNodeId: null,
    cargo: null,
    ticksRemaining: 0,
    currentTaskType: null,
    deliveryTargetId: null,
    craftingJobId: null,
  };
  const workbenchTask = parseWorkbenchTaskNodeId(drone.targetNodeId);
  const depositingTaskRoute = decideDepositingTaskRoute({
    currentTaskType: drone.currentTaskType,
    workbenchTaskKind: workbenchTask?.kind,
    hasCargo: !!drone.cargo,
    deliveryTargetId: drone.deliveryTargetId,
  });
  if (depositingTaskRoute.kind === "workbench_input") {
    return finalizeWorkbenchInputDelivery(
      state,
      droneId,
      workbenchTask as WorkbenchInputTask,
      idleDrone,
    );
  }
  if (depositingTaskRoute.kind === "workbench_output") {
    return finalizeWorkbenchDelivery(
      state,
      droneId,
      drone.craftingJobId,
      idleDrone,
    );
  }
  if (depositingTaskRoute.kind === "no_cargo") {
    return applyDroneUpdate(state, droneId, {
      ...drone,
      status: "idle",
      ticksRemaining: 0,
      currentTaskType: null,
      deliveryTargetId: null,
      craftingJobId: null,
    });
  }

  const cargo = drone.cargo as DroneCargoItem;
  const { itemType, amount } = cargo;
  const { debugLog } = deps;

  if (depositingTaskRoute.kind === "building_supply_target") {
    const deliveryId = depositingTaskRoute.targetId;
    const targetAsset = state.assets[deliveryId];
    const fallbackContext = { drone, idleDrone, cargo, deps };

    if (targetAsset?.isDockWarehouse === true) {
      const dockOutcome = depositShipDock(state, droneId, {
        deliveryId,
        idleDrone,
        cargo,
        deps,
      });
      if (dockOutcome.handled) {
        return dockOutcome.nextState;
      }
      return depositFallback(state, droneId, fallbackContext);
    }

    const generatorOutcome = depositGenerator(state, droneId, {
      deliveryId,
      idleDrone,
      cargo,
      deps,
    });
    if (generatorOutcome.handled) {
      return generatorOutcome.nextState;
    }

    debugLog.inventory(
      `[Drone] building_supply target ${deliveryId} gone or invalid; delegating ${amount}× ${itemType} to fallback deposit`,
    );
    return depositFallback(state, droneId, fallbackContext);
  }

  if (depositingTaskRoute.kind === "construction_supply_target") {
    return depositConstruction(state, droneId, {
      deliveryId: depositingTaskRoute.targetId,
      idleDrone,
      cargo,
      deps,
    });
  }

  return depositFallback(state, droneId, {
    drone,
    idleDrone,
    cargo,
    deps,
  });
}
