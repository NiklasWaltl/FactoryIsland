import type { GameAction } from "../game-actions";
import type { GameState, Inventory } from "../types";
import type { ShipQuest, ShipState } from "../types/ship-types";
import type { Module } from "../../modules/module.types";
import {
  drawQuest,
  getQuestId,
  SHIP_QUEST_HISTORY_SIZE,
} from "../../ship/quest-registry";
import { drawReward } from "../../ship/reward-table";
import {
  SHIP_DOCK_WAIT_MAX_MS,
  SHIP_DOCK_WAIT_MIN_MS,
  SHIP_PITY_TRACKING_MIN_PHASE,
  SHIP_REWARD_QUALITY_THRESHOLDS,
  SHIP_VOYAGE_MAX_MS,
  SHIP_VOYAGE_MIN_MS,
} from "../../ship/ship-balance";
import {
  MODULE_FRAGMENT_ITEM_ID,
  SHIP_FRAGMENT_PITY_THRESHOLD,
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

function randomVoyageMs(): number {
  return (
    SHIP_VOYAGE_MIN_MS +
    Math.random() * (SHIP_VOYAGE_MAX_MS - SHIP_VOYAGE_MIN_MS)
  );
}

function randomDockWaitMs(): number {
  return (
    SHIP_DOCK_WAIT_MIN_MS +
    Math.random() * (SHIP_DOCK_WAIT_MAX_MS - SHIP_DOCK_WAIT_MIN_MS)
  );
}

function normalizeQuestHistory(raw: readonly string[] | undefined): string[] {
  if (!Array.isArray(raw)) return [];
  const filtered = raw.filter((id): id is string => typeof id === "string");
  return filtered.slice(-SHIP_QUEST_HISTORY_SIZE);
}

function appendQuestHistory(
  history: readonly string[] | undefined,
  quest: ShipQuest | null,
): string[] {
  const current = normalizeQuestHistory(history);
  if (!quest) return current;
  return [...current, getQuestId(quest)].slice(-SHIP_QUEST_HISTORY_SIZE);
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
  const tracksPity = ship.questPhase >= SHIP_PITY_TRACKING_MIN_PHASE;
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
  if (pct >= SHIP_REWARD_QUALITY_THRESHOLDS.excellentRatio) return 3;
  if (pct >= SHIP_REWARD_QUALITY_THRESHOLDS.goodRatio) return 2;
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
        if (ship.rewardPending || ship.pendingMultiplier === 0) {
          return handleShipReturn(state, now);
        }
        return handleShipDock(state, now);
      }

      const departureAt = ship.departureAt;
      if (
        ship.status === "docked" &&
        departureAt !== null &&
        now >= departureAt
      ) {
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

function handleShipTimedDeparture(state: GameState, now: number): GameState {
  const updatedShip: ShipState = {
    ...state.ship,
    status: "departing",
    activeQuest: null,
    nextQuest: null,
    dockedAt: null,
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
  const questHistory = appendQuestHistory(ship.questHistory, quest);

  const clearedInv = createEmptyInventory();

  const updatedShip: ShipState = {
    ...ship,
    status: "sailing",
    dockedAt: null,
    departureAt: null,
    returnsAt: now + randomVoyageMs(),
    rewardPending: multiplier > 0,
    pendingMultiplier: multiplier,
    questHistory,
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
  if (ship.pendingMultiplier === 0) {
    const counters = getUpdatedRewardCounters(ship, false);
    return {
      ...state,
      ship: {
        ...ship,
        status: "sailing",
        activeQuest: null,
        nextQuest: null,
        dockedAt: null,
        departureAt: null,
        returnsAt: now + randomVoyageMs(),
        rewardPending: false,
        lastReward: null,
        pendingMultiplier: 1,
        ...counters,
      },
    };
  }

  if (!ship.rewardPending) {
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
