import { MODULE_FRAGMENT_ITEM_ID } from "../../ship/ship-constants";
import { DOCK_WAREHOUSE_ID } from "../bootstrap/apply-dock-warehouse-layout";
import { createEmptyInventory } from "../inventory-ops";
import type { GameState, Inventory, ModuleFragmentCount } from "../types";

export function normalizeModuleFragmentCount(
  raw: unknown,
): ModuleFragmentCount {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.floor(raw));
  }

  if (!Array.isArray(raw)) return 0;

  let total = 0;
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    total += normalizeModuleFragmentCount((entry as { count?: unknown }).count);
  }

  return total;
}

export function addModuleFragments(
  fragments: unknown,
  amount = 1,
): ModuleFragmentCount {
  const increment = normalizeModuleFragmentCount(amount);
  return normalizeModuleFragmentCount(fragments) + increment;
}

export function getDockWarehouseFragmentCount(
  state: Pick<GameState, "warehouseInventories">,
): number {
  return (
    state.warehouseInventories[DOCK_WAREHOUSE_ID]?.[MODULE_FRAGMENT_ITEM_ID] ??
    0
  );
}

export function addDockWarehouseItem(
  state: GameState,
  item: keyof Inventory,
  amount: number,
): GameState {
  const increment = normalizeModuleFragmentCount(amount);
  if (increment === 0) return state;

  const dockInventory =
    state.warehouseInventories[DOCK_WAREHOUSE_ID] ?? createEmptyInventory();
  const current = dockInventory[item] ?? 0;

  return {
    ...state,
    warehouseInventories: {
      ...state.warehouseInventories,
      [DOCK_WAREHOUSE_ID]: {
        ...dockInventory,
        [item]: current + increment,
      },
    },
  };
}

export function removeDockWarehouseItem(
  state: GameState,
  item: keyof Inventory,
  amount: number,
): { removed: boolean; state: GameState } {
  const decrement = normalizeModuleFragmentCount(amount);
  if (decrement === 0) return { removed: false, state };

  const dockInventory = state.warehouseInventories[DOCK_WAREHOUSE_ID];
  const current = dockInventory?.[item] ?? 0;
  if (!dockInventory || current < decrement) return { removed: false, state };

  return {
    removed: true,
    state: {
      ...state,
      warehouseInventories: {
        ...state.warehouseInventories,
        [DOCK_WAREHOUSE_ID]: {
          ...dockInventory,
          [item]: current - decrement,
        },
      },
    },
  };
}

export function collectDockWarehouseFragment(state: GameState): GameState {
  const result = removeDockWarehouseItem(state, MODULE_FRAGMENT_ITEM_ID, 1);
  if (!result.removed) return state;

  return {
    ...result.state,
    moduleFragments: addModuleFragments(result.state.moduleFragments, 1),
  };
}
