import type { GameAction } from "../game-actions";
import type { DroneHubAssignmentPreflightResult } from "../helpers/droneAssignment";
import type {
  DroneStatus,
  GameNotification,
  GameState,
  StarterDroneState,
} from "../types";
import { selectStarterDrone } from "../selectors/drone-selectors";

export interface DroneAssignmentActionDeps {
  validateDroneHubAssignment(input: {
    droneId: string;
    hubId: string;
    hubs: GameState["serviceHubs"];
    assets: GameState["assets"];
    starter: StarterDroneState;
    drones: GameState["drones"];
  }): DroneHubAssignmentPreflightResult;
  addErrorNotification(
    notifications: GameNotification[],
    message: string,
  ): GameNotification[];
  syncDrones(state: GameState): GameState;
  debugLog: {
    building(message: string): void;
  };
}

export function handleDroneAssignmentAction(
  state: GameState,
  action: GameAction,
  deps: DroneAssignmentActionDeps,
): GameState | null {
  switch (action.type) {
    case "ASSIGN_DRONE_TO_HUB": {
      const workingState = deps.syncDrones(state);
      const { droneId, hubId } = action;
      const starter = selectStarterDrone(workingState);
      if (!starter) return state;
      const preflightDecision = deps.validateDroneHubAssignment({
        droneId,
        hubId,
        hubs: workingState.serviceHubs,
        assets: workingState.assets,
        starter,
        drones: workingState.drones,
      });
      if (!preflightDecision || !preflightDecision.valid) {
        if (preflightDecision?.reason === "hub_full") {
          return {
            ...workingState,
            notifications: deps.addErrorNotification(
              workingState.notifications,
              "Hub hat keine freien Drohnen-Slots.",
            ),
          };
        }
        return workingState;
      }

      const targetHub = workingState.serviceHubs[hubId]!;

      const drone =
        droneId === starter.droneId
          ? starter
          : (workingState.drones[droneId] as StarterDroneState);

      // Remove drone from its old hub's droneIds
      let newHubs = { ...workingState.serviceHubs };
      const oldHubId = drone.hubId;
      if (oldHubId && oldHubId !== hubId && newHubs[oldHubId]) {
        newHubs = {
          ...newHubs,
          [oldHubId]: {
            ...newHubs[oldHubId],
            droneIds: newHubs[oldHubId].droneIds.filter((id) => id !== droneId),
          },
        };
      }

      // Add drone to new hub (preserve order; skip if already there)
      const newDroneIds = targetHub.droneIds.includes(droneId)
        ? [...(newHubs[hubId]?.droneIds ?? [])]
        : [...(newHubs[hubId]?.droneIds ?? []), droneId];
      const dockSlot = newDroneIds.indexOf(droneId);
      const dockX = preflightDecision.dockPos.x;
      const dockY = preflightDecision.dockPos.y;
      newHubs = {
        ...newHubs,
        [hubId]: {
          ...newHubs[hubId]!,
          droneIds: newDroneIds,
        },
      };

      // Release any claimed collection node before resetting the drone
      let newNodes = workingState.collectionNodes;
      if (
        drone.targetNodeId &&
        newNodes[drone.targetNodeId]?.reservedByDroneId === droneId
      ) {
        newNodes = {
          ...newNodes,
          [drone.targetNodeId]: {
            ...newNodes[drone.targetNodeId],
            reservedByDroneId: null,
          },
        };
      }

      // Snap drone to new dock, reset to idle
      const assignedDrone: StarterDroneState = {
        ...drone,
        hubId,
        status: "idle" as DroneStatus,
        tileX: dockX,
        tileY: dockY,
        targetNodeId: null,
        cargo: null,
        ticksRemaining: 0,
        currentTaskType: null,
        craftingJobId: null,
        deliveryTargetId: null,
      };

      deps.debugLog.building(
        `[ASSIGN_DRONE_TO_HUB] Drone ${droneId} → hub ${hubId} (dock slot ${dockSlot}, pos ${dockX},${dockY})`,
      );

      const newState: GameState = {
        ...workingState,
        serviceHubs: newHubs,
        collectionNodes: newNodes,
        drones: { ...workingState.drones, [droneId]: assignedDrone },
      };
      return deps.syncDrones(newState);
    }

    default:
      return null;
  }
}
