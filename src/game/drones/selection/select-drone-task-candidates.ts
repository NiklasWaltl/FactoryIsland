import type {
  CollectableItemType,
  CollectionNode,
  GameState,
  StarterDroneState,
} from "../../store/types";
import { gatherWarehouseBuildingSupplyCandidates } from "../candidates/building-supply-warehouse-source-candidates";
import { gatherConstructionSupplyCandidates } from "../candidates/construction-supply-candidates";
import { gatherGroundBuildingSupplyCandidates } from "../candidates/ground-building-supply-candidates";
import { gatherHubBuildingSupplyCandidates } from "../candidates/hub-building-supply-candidates";
import { gatherHubDispatchCandidates } from "../candidates/hub-dispatch-candidates";
import { gatherHubRestockCandidates } from "../candidates/hub-restock-candidates";
import {
  DRONE_DEMAND_BONUS_MAX,
  DRONE_ROLE_BONUS,
  DRONE_SPREAD_PENALTY_PER_DRONE,
  scoreDroneTask,
  DRONE_STICKY_BONUS,
  DRONE_URGENCY_BONUS_MAX,
  DRONE_WAREHOUSE_PRIORITY_BONUS,
} from "../candidates/scoring";
import type { DroneSelectionCandidate } from "../candidates/types";
import { gatherWarehouseConstructionCandidates } from "../candidates/warehouse-construction-candidates";
import { gatherWorkbenchInputCandidates } from "../candidates/workbench-input-candidates";
import { gatherWorkbenchOutputDeliveryCandidates } from "../candidates/workbench-output-delivery-candidates";
import {
  getAssignedBuildingSupplyDroneCount,
  getAssignedConstructionDroneCount,
  getAssignedWorkbenchDeliveryDroneCount,
  getAssignedWorkbenchInputDroneCount,
  getOpenBuildingSupplyDroneSlots,
  getOpenConstructionDroneSlots,
  getOpenHubRestockDroneSlots,
  getRemainingBuildingInputDemand,
  getRemainingConstructionNeed,
  getRemainingHubRestockNeed,
  getWorkbenchJobInputAmount,
} from "./helpers/need-slot-resolvers";
import type { SelectDroneTaskDeps } from "./select-drone-task-types";

export function collectDroneTaskCandidates(input: {
  state: GameState;
  drone: StarterDroneState;
  availableNodes: CollectionNode[];
  availableTypes: Set<CollectableItemType>;
  constructionRoleBonus: number;
  restockRoleBonus: number;
  deps: SelectDroneTaskDeps;
}): DroneSelectionCandidate[] {
  const {
    state,
    drone,
    availableNodes,
    availableTypes,
    constructionRoleBonus,
    restockRoleBonus,
    deps,
  } = input;

  const candidates: DroneSelectionCandidate[] = [];

  candidates.push(
    ...gatherConstructionSupplyCandidates(
      state,
      drone,
      availableNodes,
      availableTypes,
      constructionRoleBonus,
      {
        demandBonusMax: DRONE_DEMAND_BONUS_MAX,
        stickyBonus: DRONE_STICKY_BONUS,
        spreadPenaltyPerDrone: DRONE_SPREAD_PENALTY_PER_DRONE,
      },
      {
        getOpenConstructionDroneSlots,
        getAssignedConstructionDroneCount,
        getRemainingConstructionNeed,
        scoreDroneTask,
      },
    ),
  );

  const hubEntry = drone.hubId
    ? (state.serviceHubs[drone.hubId] ?? null)
    : null;
  if (hubEntry && drone.hubId) {
    candidates.push(
      ...gatherHubRestockCandidates(
        state,
        drone,
        drone.hubId,
        availableNodes,
        restockRoleBonus,
        {
          stickyBonus: DRONE_STICKY_BONUS,
          urgencyBonusMax: DRONE_URGENCY_BONUS_MAX,
        },
        {
          getRemainingHubRestockNeed,
          getOpenHubRestockDroneSlots,
          scoreDroneTask,
        },
      ),
    );
  }

  if (hubEntry && drone.hubId) {
    candidates.push(
      ...gatherHubDispatchCandidates(
        state,
        drone,
        constructionRoleBonus,
        {
          demandBonusMax: DRONE_DEMAND_BONUS_MAX,
          stickyBonus: DRONE_STICKY_BONUS,
          spreadPenaltyPerDrone: DRONE_SPREAD_PENALTY_PER_DRONE,
        },
        {
          getOpenConstructionDroneSlots,
          getAssignedConstructionDroneCount,
          getRemainingConstructionNeed,
          getAvailableHubDispatchSupply: deps.getAvailableHubDispatchSupply,
          scoreDroneTask,
        },
      ),
    );
  }

  candidates.push(
    ...gatherWarehouseConstructionCandidates(
      state,
      drone,
      constructionRoleBonus,
      {
        demandBonusMax: DRONE_DEMAND_BONUS_MAX,
        stickyBonus: DRONE_STICKY_BONUS,
        spreadPenaltyPerDrone: DRONE_SPREAD_PENALTY_PER_DRONE,
        warehousePriorityBonus: DRONE_WAREHOUSE_PRIORITY_BONUS,
      },
      {
        getOpenConstructionDroneSlots,
        getAssignedConstructionDroneCount,
        getRemainingConstructionNeed,
        getNearbyWarehousesForDispatch: deps.getNearbyWarehousesForDispatch,
        scoreDroneTask,
      },
    ),
  );

  candidates.push(
    ...gatherGroundBuildingSupplyCandidates(
      state,
      drone,
      availableNodes,
      availableTypes,
      {
        demandBonusMax: DRONE_DEMAND_BONUS_MAX,
        stickyBonus: DRONE_STICKY_BONUS,
        spreadPenaltyPerDrone: DRONE_SPREAD_PENALTY_PER_DRONE,
      },
      {
        getBuildingInputTargets: deps.getBuildingInputTargets,
        isUnderConstruction: deps.isUnderConstruction,
        getRemainingBuildingInputDemand,
        getOpenBuildingSupplyDroneSlots,
        getAssignedBuildingSupplyDroneCount,
        scoreDroneTask,
      },
    ),
  );

  if (hubEntry && drone.hubId) {
    candidates.push(
      ...gatherHubBuildingSupplyCandidates(
        state,
        drone,
        {
          demandBonusMax: DRONE_DEMAND_BONUS_MAX,
          stickyBonus: DRONE_STICKY_BONUS,
          spreadPenaltyPerDrone: DRONE_SPREAD_PENALTY_PER_DRONE,
        },
        {
          getBuildingInputTargets: deps.getBuildingInputTargets,
          isUnderConstruction: deps.isUnderConstruction,
          getRemainingBuildingInputDemand,
          getOpenBuildingSupplyDroneSlots,
          getAvailableHubDispatchSupply: deps.getAvailableHubDispatchSupply,
          getAssignedBuildingSupplyDroneCount,
          scoreDroneTask,
        },
      ),
    );
  }

  candidates.push(
    ...gatherWarehouseBuildingSupplyCandidates(
      state,
      drone,
      {
        demandBonusMax: DRONE_DEMAND_BONUS_MAX,
        stickyBonus: DRONE_STICKY_BONUS,
        spreadPenaltyPerDrone: DRONE_SPREAD_PENALTY_PER_DRONE,
        warehousePriorityBonus: DRONE_WAREHOUSE_PRIORITY_BONUS,
      },
      {
        getBuildingInputTargets: deps.getBuildingInputTargets,
        isUnderConstruction: deps.isUnderConstruction,
        getRemainingBuildingInputDemand,
        getOpenBuildingSupplyDroneSlots,
        getAssignedBuildingSupplyDroneCount,
        getNearbyWarehousesForDispatch: deps.getNearbyWarehousesForDispatch,
        scoreDroneTask,
      },
    ),
  );

  candidates.push(
    ...gatherWorkbenchInputCandidates(
      state,
      drone,
      { stickyBonus: DRONE_STICKY_BONUS },
      {
        hasCompleteWorkbenchInput: deps.hasCompleteWorkbenchInput,
        isCollectableCraftingItem: deps.isCollectableCraftingItem,
        getWorkbenchJobInputAmount,
        getAssignedWorkbenchInputDroneCount,
        resolveWorkbenchInputPickup: deps.resolveWorkbenchInputPickup,
        scoreDroneTask,
      },
    ),
  );

  candidates.push(
    ...gatherWorkbenchOutputDeliveryCandidates(
      state,
      drone,
      { stickyBonus: DRONE_STICKY_BONUS },
      {
        getAssignedWorkbenchDeliveryDroneCount,
        scoreDroneTask,
      },
    ),
  );

  if (!drone.hubId || !hubEntry) {
    for (const node of availableNodes) {
      const stickyBonus =
        node.reservedByDroneId === drone.droneId ? DRONE_STICKY_BONUS : 0;
      candidates.push({
        taskType: "hub_restock",
        nodeId: node.id,
        deliveryTargetId: "",
        score: scoreDroneTask(
          "hub_restock",
          drone.tileX,
          drone.tileY,
          node.tileX,
          node.tileY,
          {
            role: restockRoleBonus,
            sticky: stickyBonus,
          },
        ),
        _roleBonus: restockRoleBonus,
        _stickyBonus: stickyBonus,
        _urgencyBonus: 0,
        _demandBonus: 0,
        _spreadPenalty: 0,
      });
    }
  }

  return candidates;
}

export function buildCandidateInputs(
  state: GameState,
  drone: StarterDroneState,
): {
  availableNodes: CollectionNode[];
  availableTypes: Set<CollectableItemType>;
  constructionRoleBonus: number;
  restockRoleBonus: number;
} {
  const role = drone.role ?? "auto";
  const availableNodes = Object.values(state.collectionNodes).filter(
    (node) =>
      node.amount > 0 &&
      (node.reservedByDroneId === null ||
        node.reservedByDroneId === drone.droneId),
  );
  const availableTypes = new Set<CollectableItemType>();
  for (const node of availableNodes) availableTypes.add(node.itemType);

  return {
    availableNodes,
    availableTypes,
    constructionRoleBonus: role === "construction" ? DRONE_ROLE_BONUS : 0,
    restockRoleBonus: role === "supply" ? DRONE_ROLE_BONUS : 0,
  };
}
