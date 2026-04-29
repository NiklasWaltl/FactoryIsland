import type { CollectableItemType } from "../types";

// ---- Drone Roles ----
/**
 * Optional role that biases a drone's task selection toward a specific work type.
 * "auto" = no preference — drone picks any best-scoring task (default).
 * "construction" = prefers construction_supply tasks (score bonus applied).
 * "supply" = prefers hub_restock tasks (score bonus applied).
 * Roles never block fallback: if the preferred task type has no candidates the
 * drone still picks the highest-scoring task of any type.
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
 * The drone then delivers to that hub's tile position instead of MAP_SHOP_POS.
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
   * When null: drone delivers to the start module (MAP_SHOP_POS).
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
}

// ---- Drone Tasks ----
/**
 * hub_dispatch: drone flies to its hub, withdraws resources from hub.inventory,
 * then delivers them directly to a construction site.
 * nodeId format: "hub:{hubId}:{resourceType}"
 */
export type DroneTaskType = "construction_supply" | "hub_restock" | "hub_dispatch" | "workbench_delivery" | "building_supply";
