import type { GameAction } from "../game-actions";
import type { GameState } from "../types";
import type { ShipState } from "../types/ship-types";
import { drawQuest } from "../../ship/quest-registry";
import { drawReward } from "../../ship/reward-table";
import { DOCK_WAREHOUSE_ID } from "../bootstrap/apply-dock-warehouse-layout";
import { addResources, createEmptyInventory } from "../inventory-ops";
import { addNotification } from "../utils/notifications";

const SHIP_TICK_TYPES = new Set<GameAction["type"]>([
  "SHIP_TICK",
  "SHIP_DOCK",
  "SHIP_DEPART",
  "SHIP_RETURN",
]);

/** Voyage duration range: 3–5 minutes in ms */
const VOYAGE_MIN_MS = 3 * 60 * 1_000;
const VOYAGE_MAX_MS = 5 * 60 * 1_000;
/** Docked wait time: 2 minutes */
const DOCK_WAIT_MS = 2 * 60 * 1_000;

function randomVoyageMs(): number {
  return VOYAGE_MIN_MS + Math.random() * (VOYAGE_MAX_MS - VOYAGE_MIN_MS);
}

export function computeQualityMultiplier(
  delivered: number,
  required: number,
): 0 | 1 | 2 | 3 {
  if (required <= 0 || delivered <= 0) return 0;
  const pct = delivered / required;
  if (pct >= 2.0) return 3;
  if (pct >= 1.5) return 2;
  return 1;
}

export function handleShipAction(
  state: GameState,
  action: GameAction,
): GameState | null {
  if (!SHIP_TICK_TYPES.has(action.type)) return null;

  switch (action.type) {
    case "SHIP_TICK": {
      const ship = state.ship;
      const now = Date.now();

      if (ship.status === "sailing" && ship.returnsAt !== null && now >= ship.returnsAt) {
        if (ship.rewardPending) {
          return handleShipReturn(state, now);
        }
        return handleShipDock(state, now);
      }

      if (ship.status === "docked" && ship.departsAt !== null && now >= ship.departsAt) {
        return handleShipDepart(state, now);
      }

      return state;
    }

    case "SHIP_DOCK":
      return handleShipDock(state, Date.now());

    case "SHIP_DEPART":
      return handleShipDepart(state, Date.now());

    case "SHIP_RETURN":
      return handleShipReturn(state, Date.now());

    default:
      return null;
  }
}

function handleShipDock(state: GameState, now: number): GameState {
  const quest = drawQuest(state.ship.questPhase);
  const nextQuest = drawQuest(state.ship.questPhase);
  const updatedShip: ShipState = {
    ...state.ship,
    status: "docked",
    activeQuest: quest,
    nextQuest,
    dockedAt: now,
    departsAt: now + DOCK_WAIT_MS,
    returnsAt: null,
    rewardPending: false,
    pendingMultiplier: 1,
  };
  return { ...state, ship: updatedShip };
}

function handleShipDepart(state: GameState, now: number): GameState {
  const ship = state.ship;
  const quest = ship.activeQuest;

  const dockInv = state.warehouseInventories[DOCK_WAREHOUSE_ID];
  const delivered =
    quest && dockInv
      ? ((dockInv[quest.itemId as keyof typeof dockInv] as number) ?? 0)
      : 0;
  const required = quest?.amount ?? 0;

  const multiplier = computeQualityMultiplier(delivered, required);

  const clearedInv = createEmptyInventory();

  const updatedShip: ShipState = {
    ...ship,
    status: "sailing",
    dockedAt: null,
    departsAt: null,
    returnsAt: now + randomVoyageMs(),
    rewardPending: multiplier > 0,
    pendingMultiplier: multiplier,
    shipsSinceLastFragment: ship.shipsSinceLastFragment + 1,
  };

  return {
    ...state,
    ship: updatedShip,
    warehouseInventories: {
      ...state.warehouseInventories,
      [DOCK_WAREHOUSE_ID]: clearedInv,
    },
  };
}

function handleShipReturn(state: GameState, now: number): GameState {
  const ship = state.ship;
  if (!ship.rewardPending || ship.pendingMultiplier === 0) {
    return {
      ...state,
      ship: {
        ...ship,
        rewardPending: false,
        pendingMultiplier: 1,
      },
    };
  }

  const reward = drawReward(ship.pendingMultiplier, ship.questPhase);

  const isCoinReward = reward.itemId === "coins";
  const nextInventory = isCoinReward
    ? addResources(state.inventory, { coins: reward.amount })
    : state.inventory;
  const currentInv =
    state.warehouseInventories[DOCK_WAREHOUSE_ID] ?? createEmptyInventory();
  const rewardInv = { ...currentInv };
  if (!isCoinReward) {
    const key = reward.itemId as keyof typeof rewardInv;
    rewardInv[key] = ((rewardInv[key] as number) ?? 0) + reward.amount;
  }

  const isFragment =
    reward.kind === "module_fragment" || reward.kind === "complete_module";

  const updatedShip: ShipState = {
    ...ship,
    status: "sailing",
    activeQuest: null,
    nextQuest: null,
    dockedAt: null,
    departsAt: null,
    returnsAt: now + randomVoyageMs(),
    rewardPending: false,
    lastReward: reward,
    pendingMultiplier: 1,
    shipsSinceLastFragment: isFragment ? 0 : ship.shipsSinceLastFragment,
  };

  const notifications = addNotification(
    state.notifications,
    reward.itemId,
    reward.amount,
  );

  return {
    ...state,
    ship: updatedShip,
    inventory: nextInventory,
    notifications,
    warehouseInventories: isCoinReward
      ? state.warehouseInventories
      : {
          ...state.warehouseInventories,
          [DOCK_WAREHOUSE_ID]: rewardInv,
        },
  };
}
