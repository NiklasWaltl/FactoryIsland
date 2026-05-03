import type { ItemId } from "../../items/types";

export type RewardType =
  | "coins"
  | "basic_resource"
  | "rare_resource"
  | "module_fragment"
  | "complete_module";

export type ShipStatus =
  | "sailing"    // ship is at sea, returning or on first approach
  | "docked"     // ship is at the dock, quest visible, countdown running
  | "departing"; // ship has departed, quest being evaluated, reward pending

export interface ShipQuest {
  /** Item the quest requests */
  itemId: ItemId;
  /** Amount required */
  amount: number;
  /** Display name */
  label: string;
  /** Phase this quest belongs to (1–5) */
  phase: number;
}

export interface ShipReward {
  /** Reward category for display purposes */
  kind: RewardType;
  /** Item key (or "coins") */
  itemId: string;
  /** Amount granted */
  amount: number;
  /** Display label */
  label: string;
  /** Quality multiplier that produced this reward (1 | 2 | 3) */
  multiplier: 1 | 2 | 3;
}

export interface ShipState {
  status: ShipStatus;
  /** Active quest (null while ship is sailing with no active quest yet) */
  activeQuest: ShipQuest | null;
  /** Next quest already revealed to the player (set on SHIP_DOCK) */
  nextQuest: ShipQuest | null;
  /** Timestamp when the ship docked (ms) */
  dockedAt: number | null;
  /** Timestamp when the ship will depart (ms) */
  departsAt: number | null;
  /** Timestamp when the docked ship leaves without an explicit departure (ms) */
  departureAt: number | null;
  /** Timestamp when the ship will return from its voyage (ms) */
  returnsAt: number | null;
  /** True while waiting for SHIP_RETURN to distribute the reward */
  rewardPending: boolean;
  /** Last reward distributed (for notification) */
  lastReward: ShipReward | null;
  /** Current quest phase (1–5) */
  questPhase: number;
  /** Ships completed without a fragment drop (pity counter — unused until Block 6) */
  shipsSinceLastFragment: number;
  /** Phase-5+ ships completed without a fragment/module drop. */
  pityCounter: number;
  /** Quality multiplier computed at SHIP_DEPART and read at SHIP_RETURN; 0 means no reward. */
  pendingMultiplier: 0 | 1 | 2 | 3;
}
