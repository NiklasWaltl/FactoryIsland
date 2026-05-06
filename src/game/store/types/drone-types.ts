import type { CollectableItemType } from "./item-types";

// ---- Drone Roles ----
/**
 * Optional role that hard-filters a drone's task selection to a specific work type.
 * "auto" = no filter — drone picks any best-scoring task (default).
 * "construction" = only construction_supply, hub_dispatch, deconstruct.
 * "supply" = only hub_restock, building_supply, workbench_delivery.
 * Fallback: if the role-filtered candidate list is empty, selection retries with
 * the unfiltered "auto" set so role-locked drones don't deadlock when their
 * preferred work is unavailable.
 */
export type DroneRole = "auto" | "construction" | "supply";

// ---- Starter Drone ----
export type DroneStatus =
  | "idle"
  | "moving_to_collect"
  | "collecting"
  | "moving_to_dropoff"
  | "depositing"
  /** Drone is flying back to its homeHub dock after finishing a task or on game start. */
  | "returning_to_dock";

export interface DroneCargoItem {
  itemType: CollectableItemType;
  amount: number;
}

/**
 * Singleton starter drone. Becomes the "hub drone" once a service hub is
 * introduced — no separate drone system needed.
 *
 * Hub-integration path: set `hubId` to a service-hub asset ID.
 * The drone then delivers to that hub's tile position instead of the start module.
 * All other state-machine logic stays identical.
 */
export interface StarterDroneState {
  status: DroneStatus;
  /** Conceptual tile position (for distance calc; no visual yet). */
  tileX: number;
  tileY: number;
  /** ID of the CollectionNode currently targeted (null when idle). */
  targetNodeId: string | null;
  /** Items being carried this trip. */
  cargo: DroneCargoItem | null;
  /** Ticks remaining for the current movement / action phase. */
  ticksRemaining: number;
  /**
   * When null: drone delivers to the start module (resolved via getStartModulePosition).
   * When set to an asset ID: drone delivers to that hub asset's tile.
   * This is the only change required for hub integration.
   */
  hubId: string | null;
  /** Type of the active drone task. null when idle / no task. */
  currentTaskType: DroneTaskType | null;
  /** Asset ID of the delivery target (construction site or hub). null when idle or delivering to start module. */
  deliveryTargetId: string | null;
  /** Crafting job currently being delivered from a workbench. */
  craftingJobId: string | null;
  /**
   * Stable identifier for this drone instance.
   * Used as the claim/reservation token on collection nodes.
   * Remains constant for the lifetime of the drone object.
   */
  droneId: string;
  /**
   * Optional role preference — influences task scoring.
   * Defaults to "auto" when absent (backward compatible with older saves).
   */
  role?: DroneRole;
  /** Pending deconstruction refund payload to deposit at hub/global after teardown. */
  deconstructRefund?: Partial<Record<CollectableItemType, number>> | null;
}

// ---- Drone Tasks ----
/**
 * hub_dispatch: drone flies to its hub, withdraws resources from hub.inventory,
 * then delivers them directly to a construction site.
 * nodeId format: "hub:{hubId}:{resourceType}"
 */
export type DroneTaskType =
  | "construction_supply"
  | "hub_restock"
  | "hub_dispatch"
  | "workbench_delivery"
  | "building_supply"
  | "deconstruct";

/**
 * Hard-filter mapping: which task types a given role is allowed to take.
 * "auto" matches every task type. The selection layer falls back to "auto"
 * when a role-filtered candidate list comes up empty, so this is not a
 * deadlock surface — see selectDroneTask().
 */
export function roleAllows(role: DroneRole, taskType: DroneTaskType): boolean {
  if (role === "auto") return true;
  if (role === "construction") {
    return (
      taskType === "construction_supply" ||
      taskType === "hub_dispatch" ||
      taskType === "deconstruct"
    );
  }
  // role === "supply"
  return (
    taskType === "hub_restock" ||
    taskType === "building_supply" ||
    taskType === "workbench_delivery"
  );
}
