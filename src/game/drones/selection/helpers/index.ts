export type { NeedSlotResolverDeps } from "./need-slot-resolvers-types";
export {
  getAssignedConstructionDroneCount,
  getInboundConstructionAmount,
  getOpenConstructionDroneSlots,
  getRemainingConstructionNeed,
} from "./construction-need-resolvers";
export {
  getAssignedBuildingSupplyDroneCount,
  getInboundBuildingSupplyAmount,
  getOpenBuildingSupplyDroneSlots,
  getRemainingBuildingInputDemand,
} from "./building-supply-need-resolvers";
export {
  getInboundHubBuildingSupplyAmount,
  getInboundHubDispatchAmount,
  getInboundHubRestockAmount,
  getInboundHubRestockDroneCount,
  getInboundWarehouseDispatchAmount,
  getOpenHubRestockDroneSlots,
  getRemainingHubRestockNeed,
} from "./hub-restock-need-resolvers";
export {
  getAssignedWorkbenchDeliveryDroneCount,
  getAssignedWorkbenchInputDroneCount,
  getWorkbenchJobInputAmount,
} from "./workbench-need-resolvers";
