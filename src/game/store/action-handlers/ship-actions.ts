import type { GameAction } from "../game-actions";
import type { GameState, Inventory } from "../types";
import type { ShipState } from "../types/ship-types";
import type { Module } from "../../modules/module.types";
import { drawQuest } from "../../ship/quest-registry";
import { drawReward } from "../../ship/reward-table";
import {
  MODULE_FRAGMENT_ITEM_ID,
  SHIP_FRAGMENT_PITY_THRESHOLD,
  SHIP_WAIT_DURATION_MS,
} from "../../ship/ship-constants";
import { DOCK_WAREHOUSE_ID } from "../bootstrap/apply-dock-warehouse-layout";
import { addResources, createEmptyInventory } from "../inventory-ops";
import {
  addDockWarehouseItem,
  addModuleFragments,
  collectDockWarehouseFragment,
} from "../helpers/module-fragments";
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

function randomVoyageMs(): number {
  return VOYAGE_MIN_MS + Math.random() * (VOYAGE_MAX_MS - VOYAGE_MIN_MS);
}

function getDepartureAt(ship: ShipState): number | null {
  return ship.departureAt ?? ship.departsAt ?? null;
}

function getPityCounter(ship: ShipState): number {
  return Number.isFinite(ship.pityCounter)
    ? ship.pityCounter
    : ship.shipsSinceLastFragment;
}

function getUpdatedRewardCounters(
  ship: ShipState,
  droppedFragmentLikeReward: boolean,
): Pick<ShipState, "shipsSinceLastFragment" | "pityCounter"> {
  const shipsSinceLastFragment = droppedFragmentLikeReward
    ? 0
    : ship.shipsSinceLastFragment + 1;
  const tracksPity = ship.questPhase >= 5;
  const pityCounter = droppedFragmentLikeReward
    ? 0
    : tracksPity
      ? getPityCounter(ship) + 1
      : getPityCounter(ship);

  return { shipsSinceLastFragment, pityCounter };
}

function createShipRewardModule(now: number): Module {
  return {
    id: `ship-mod-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type: "miner-boost",
    tier: 1,
    equippedTo: null,
  };
}

function addCompleteModuleReward(state: GameState, now: number): GameState {
  if (!Array.isArray(state.moduleInventory)) {
    return {
      ...state,
      moduleFragments: addModuleFragments(state.moduleFragments, 3),
    };
  }

  return {
    ...state,
    moduleInventory: [...state.moduleInventory, createShipRewardModule(now)],
  };
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

      if (
        (ship.status === "sailing" || ship.status === "departing") &&
        ship.returnsAt !== null &&
        now >= ship.returnsAt
      ) {
        if (ship.rewardPending) {
          return handleShipReturn(state, now);
        }
        return handleShipDock(state, now);
      }

      const departureAt = getDepartureAt(ship);
      if (ship.status === "docked" && departureAt !== null && now >= departureAt) {
        return handleShipTimedDeparture(state, now);
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
  const departureAt = now + SHIP_WAIT_DURATION_MS;
  const updatedShip: ShipState = {
    ...state.ship,
    status: "docked",
    activeQuest: quest,
    nextQuest,
    dockedAt: now,
    departsAt: departureAt,
    departureAt,
    returnsAt: null,
    rewardPending: false,
    pendingMultiplier: 1,
  };
  return { ...state, ship: updatedShip };
}

function handleShipTimedDeparture(state: GameState, now: number): GameState {
  const updatedShip: ShipState = {
    ...state.ship,
    status: "departing",
    activeQuest: null,
    nextQuest: null,
    dockedAt: null,
    departsAt: null,
    departureAt: null,
    returnsAt: now + randomVoyageMs(),
    rewardPending: false,
    pendingMultiplier: 1,
  };

  return {
    ...state,
    ship: updatedShip,
    warehouseInventories: {
      ...state.warehouseInventories,
      [DOCK_WAREHOUSE_ID]: createEmptyInventory(),
    },
  };
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
    departureAt: null,
    returnsAt: now + randomVoyageMs(),
    rewardPending: multiplier > 0,
    pendingMultiplier: multiplier,
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

  const reward = drawReward(
    ship.pendingMultiplier,
    ship.questPhase,
    getPityCounter(ship) >= SHIP_FRAGMENT_PITY_THRESHOLD,
  );

  let rewardState = state;
  switch (reward.kind) {
    case "coins":
      rewardState = {
        ...rewardState,
        inventory: addResources(rewardState.inventory, {
          coins: reward.amount,
        }),
      };
      break;
    case "basic_resource":
    case "rare_resource":
      rewardState = addDockWarehouseItem(
        rewardState,
        reward.itemId as keyof Inventory,
        reward.amount,
      );
      break;
    case "module_fragment":
      rewardState = collectDockWarehouseFragment(
        addDockWarehouseItem(
          rewardState,
          MODULE_FRAGMENT_ITEM_ID,
          reward.amount,
        ),
      );
      break;
    case "complete_module":
      rewardState = addCompleteModuleReward(rewardState, now);
      break;
  }

  const isFragment =
    reward.kind === "module_fragment" || reward.kind === "complete_module";
  const counters = getUpdatedRewardCounters(ship, isFragment);

  const updatedShip: ShipState = {
    ...ship,
    status: "sailing",
    activeQuest: null,
    nextQuest: null,
    dockedAt: null,
    departsAt: null,
    departureAt: null,
    returnsAt: now + randomVoyageMs(),
    rewardPending: false,
    lastReward: reward,
    pendingMultiplier: 1,
    ...counters,
  };

  const notifications = addNotification(
    rewardState.notifications,
    reward.itemId,
    reward.amount,
  );

  return {
    ...rewardState,
    ship: updatedShip,
    notifications,
  };
}
