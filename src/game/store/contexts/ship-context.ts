import { drawQuest, getQuestId } from "../../ship/quest-registry";
import {
  SHIP_DOCK_WAIT_MAX_MS,
  SHIP_DOCK_WAIT_MIN_MS,
} from "../../ship/ship-balance";
import type { GameAction } from "../game-actions";
import type { ShipState } from "../types/ship-types";
import type { BoundedContext, ShipContextState } from "./types";

export const SHIP_HANDLED_ACTION_TYPES = [
  "SHIP_TICK",
  "SHIP_DOCK",
  "SHIP_DEPART",
  "SHIP_RETURN",
] as const satisfies readonly GameAction["type"][];

type ShipActionType = (typeof SHIP_HANDLED_ACTION_TYPES)[number];
type ShipAction = Extract<GameAction, { type: ShipActionType }>;

const SHIP_ACTION_TYPE_SET: ReadonlySet<GameAction["type"]> = new Set(
  SHIP_HANDLED_ACTION_TYPES,
);

function isShipAction(action: GameAction): action is ShipAction {
  return SHIP_ACTION_TYPE_SET.has(action.type);
}

function randomDockWaitMs(): number {
  return (
    SHIP_DOCK_WAIT_MIN_MS +
    Math.random() * (SHIP_DOCK_WAIT_MAX_MS - SHIP_DOCK_WAIT_MIN_MS)
  );
}

function dockShip(state: ShipContextState, now: number): ShipContextState {
  const quest = drawQuest(state.ship.questPhase, state.ship.questHistory);
  const nextQuest = drawQuest(state.ship.questPhase, [
    ...state.ship.questHistory,
    getQuestId(quest),
  ]);
  const departureAt = now + randomDockWaitMs();
  const updatedShip: ShipState = {
    ...state.ship,
    status: "docked",
    activeQuest: quest,
    nextQuest,
    dockedAt: now,
    departureAt,
    returnsAt: null,
    rewardPending: false,
    pendingMultiplier: 1,
  };
  return { ...state, ship: updatedShip };
}

function reduceShip(
  state: ShipContextState,
  action: ShipAction,
): ShipContextState {
  const actionType = action.type;

  switch (actionType) {
    case "SHIP_DOCK":
      return dockShip(state, Date.now());

    case "SHIP_TICK":
    case "SHIP_DEPART":
    case "SHIP_RETURN":
      // cross-slice: no-op in isolated context
      // Depart clears warehouseInventories[DOCK]; return mutates inventory,
      // moduleInventory and notifications; tick can branch into either.
      return state;

    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

export const shipContext: BoundedContext<ShipContextState> = {
  reduce(state, action) {
    if (!isShipAction(action)) return null;
    return reduceShip(state, action);
  },
  handledActionTypes: SHIP_HANDLED_ACTION_TYPES,
};
