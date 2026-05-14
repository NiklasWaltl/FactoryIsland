import { debugLog } from "../../debug/debugLogger";
import { addItem, removeItem } from "../../inventory/helpers";
import { isKnownItemId } from "../../items/registry";
import { EMPTY_HOTBAR_SLOT } from "../constants/ui/hotbar";
import { RESOURCE_LABELS } from "../constants/resources";
import type { GameAction } from "../game-actions";
import { hotbarAdd } from "../helpers/hotbar";
import { consumeResources } from "../helpers/reducer-helpers";
import { addResources } from "../inventory-ops";
import type { BuildingType, Inventory, ToolKind } from "../types";
import { addErrorNotification } from "../utils/notifications";
import { getWarehouseCapacity } from "../warehouse-capacity";
import type { BoundedContext, WarehouseContextState } from "./types";

export const WAREHOUSE_HANDLED_ACTION_TYPES = [
  "TRANSFER_TO_WAREHOUSE",
  "TRANSFER_FROM_WAREHOUSE",
  "EQUIP_FROM_WAREHOUSE",
  "EQUIP_BUILDING_FROM_WAREHOUSE",
  "REMOVE_FROM_HOTBAR",
] as const satisfies readonly GameAction["type"][];

type WarehouseActionType = (typeof WAREHOUSE_HANDLED_ACTION_TYPES)[number];
type WarehouseAction = Extract<GameAction, { type: WarehouseActionType }>;

const WAREHOUSE_ACTION_TYPE_SET: ReadonlySet<GameAction["type"]> = new Set(
  WAREHOUSE_HANDLED_ACTION_TYPES,
);

function isWarehouseAction(action: GameAction): action is WarehouseAction {
  return WAREHOUSE_ACTION_TYPE_SET.has(action.type);
}

function reduceWarehouse(
  state: WarehouseContextState,
  action: WarehouseAction,
): WarehouseContextState {
  const actionType = action.type;

  switch (actionType) {
    case "TRANSFER_TO_WAREHOUSE": {
      const { item, amount } = action;
      if (amount <= 0) return state;
      const whId = state.selectedWarehouseId;
      if (!whId) return state;
      const whInv = state.warehouseInventories[whId];
      if (!whInv) return state;

      const globalAvailable = state.inventory[item] as number;
      const whCap = getWarehouseCapacity(state.mode);
      const whCurrent = whInv[item] as number;
      const spaceInWarehouse =
        item === "coins" ? Infinity : Math.max(0, whCap - whCurrent);
      const transferAmount = Math.min(
        amount,
        globalAvailable,
        spaceInWarehouse,
      );
      if (transferAmount <= 0) return state;

      return {
        ...state,
        inventory: consumeResources(state.inventory, {
          [item]: transferAmount,
        }),
        warehouseInventories: {
          ...state.warehouseInventories,
          [whId]: addResources(whInv, { [item]: transferAmount }),
        },
      };
    }

    case "TRANSFER_FROM_WAREHOUSE": {
      const { item, amount } = action;
      if (amount <= 0) return state;
      const whId = state.selectedWarehouseId;
      if (!whId) return state;
      const whInv = state.warehouseInventories[whId];
      if (!whInv) return state;

      const whAvailable = whInv[item] as number;
      const transferAmount = Math.min(amount, whAvailable);
      if (transferAmount <= 0) return state;

      return {
        ...state,
        inventory: addResources(state.inventory, { [item]: transferAmount }),
        warehouseInventories: {
          ...state.warehouseInventories,
          [whId]: consumeResources(whInv, { [item]: transferAmount }),
        },
      };
    }

    case "EQUIP_BUILDING_FROM_WAREHOUSE": {
      const { buildingType, amount = 1 } = action;
      return equipFromWarehouse(state, {
        invKey: buildingType,
        toolKind: "building",
        buildingType,
        amount,
      });
    }

    case "EQUIP_FROM_WAREHOUSE": {
      const { itemKind, amount = 1 } = action;
      debugLog.hotbar(
        `Equip ${RESOURCE_LABELS[itemKind] ?? itemKind} ×${amount} from warehouse → hotbar`,
      );
      return equipFromWarehouse(state, {
        invKey: itemKind,
        toolKind: itemKind as Exclude<ToolKind, "empty">,
        amount,
      });
    }

    case "REMOVE_FROM_HOTBAR": {
      const hs = state.hotbarSlots[action.slot];
      if (!hs || hs.toolKind === "empty") return state;
      const whId = state.selectedWarehouseId;
      if (!whId) return state;
      const whInv = state.warehouseInventories[whId];
      if (!whInv) return state;

      debugLog.hotbar(
        `Removed ${hs.label || hs.toolKind} ×${hs.amount} from Hotbar slot ${action.slot}`,
      );

      const newHotbarSlots = state.hotbarSlots.map((s, i) =>
        i === action.slot ? { ...EMPTY_HOTBAR_SLOT } : s,
      );

      let newWhInv: Inventory = whInv;
      if (hs.toolKind === "building" && hs.buildingType) {
        const bType = hs.buildingType;
        if (isKnownItemId(bType)) {
          newWhInv = addItem(whInv, bType, hs.amount);
        } else {
          const base = Reflect.get(whInv, bType);
          newWhInv = { ...whInv };
          Reflect.set(newWhInv, bType, (base ?? 0) + hs.amount);
        }
      } else if (hs.toolKind === "axe") {
        newWhInv = { ...whInv, axe: whInv.axe + hs.amount };
      } else if (hs.toolKind === "wood_pickaxe") {
        newWhInv = { ...whInv, wood_pickaxe: whInv.wood_pickaxe + hs.amount };
      } else if (hs.toolKind === "stone_pickaxe") {
        newWhInv = { ...whInv, stone_pickaxe: whInv.stone_pickaxe + hs.amount };
      } else if (hs.toolKind === "sapling") {
        newWhInv = { ...whInv, sapling: whInv.sapling + hs.amount };
      }

      return {
        ...state,
        warehouseInventories: {
          ...state.warehouseInventories,
          [whId]: newWhInv,
        },
        hotbarSlots: newHotbarSlots,
      };
    }

    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

interface EquipPreflight {
  invKey: string;
  toolKind: Exclude<ToolKind, "empty">;
  buildingType?: BuildingType;
  amount: number;
}

function equipFromWarehouse(
  state: WarehouseContextState,
  preflight: EquipPreflight,
): WarehouseContextState {
  const { invKey, toolKind, buildingType, amount } = preflight;
  const whId = state.selectedWarehouseId;
  if (!whId) return state;
  const whInv = state.warehouseInventories[whId];
  if (!whInv) return state;

  let newWhInv: Inventory;
  if (isKnownItemId(invKey)) {
    const next = removeItem(whInv, invKey, amount);
    if (!next) return state;
    newWhInv = next;
  } else {
    const base = Reflect.get(whInv, invKey);
    if (typeof base !== "number" || !Number.isFinite(base) || base < amount) {
      return state;
    }
    newWhInv = { ...whInv };
    Reflect.set(newWhInv, invKey, base - amount);
  }

  const newHotbar = hotbarAdd(
    state.hotbarSlots,
    toolKind,
    buildingType,
    amount,
  );
  if (!newHotbar) {
    return {
      ...state,
      notifications: addErrorNotification(
        state.notifications,
        "Hotbar voll! Kein Platz zum Ausrüsten.",
      ),
    };
  }

  return {
    ...state,
    warehouseInventories: {
      ...state.warehouseInventories,
      [whId]: newWhInv,
    },
    hotbarSlots: newHotbar,
  };
}

export const warehouseContext: BoundedContext<WarehouseContextState> = {
  reduce(state, action) {
    if (!isWarehouseAction(action)) return null;
    return reduceWarehouse(state, action);
  },
  handledActionTypes: WAREHOUSE_HANDLED_ACTION_TYPES,
};
