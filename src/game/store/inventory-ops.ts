import type {
  CollectableItemType,
  GameState,
  Inventory,
  ServiceHubEntry,
} from "./types";
import type { ItemId } from "../items/types";
import {
  addItem,
  getItemCount,
  hasItem,
  removeItem,
} from "../inventory/helpers";

export const COLLECTABLE_KEYS = new Set<string>([
  "wood",
  "stone",
  "iron",
  "copper",
]);

function isItemInventoryKey(key: keyof Inventory): key is ItemId {
  return key !== "coins";
}

export function createEmptyInventory(): Inventory {
  return {
    coins: 0,
    wood: 0,
    stone: 0,
    iron: 0,
    copper: 0,
    sapling: 0,
    ironIngot: 0,
    copperIngot: 0,
    metalPlate: 0,
    gear: 0,
    axe: 0,
    wood_pickaxe: 0,
    stone_pickaxe: 0,
    workbench: 0,
    warehouse: 0,
    smithy: 0,
    generator: 0,
    cable: 0,
    battery: 0,
    power_pole: 0,
    manual_assembler: 0,
    auto_smelter: 0,
    auto_assembler: 0,
  };
}

export function hasResources(
  inv: Inventory,
  costs: Partial<Record<keyof Inventory, number>>,
): boolean {
  for (const [rawKey, amt] of Object.entries(costs)) {
    const key = rawKey as keyof Inventory;
    const required = amt ?? 0;
    if (isItemInventoryKey(key)) {
      if (required > 0) {
        if (!hasItem(inv, key, required)) return false;
      } else if (getItemCount(inv, key) < required) {
        return false;
      }
      continue;
    }
    if ((inv.coins ?? 0) < required) return false;
  }
  return true;
}

export function addResources(
  inv: Inventory,
  items: Partial<Record<keyof Inventory, number>>,
): Inventory {
  let result: Inventory = { ...inv };
  for (const [rawKey, amt] of Object.entries(items)) {
    const key = rawKey as keyof Inventory;
    const delta = amt ?? 0;
    if (delta === 0) continue;

    if (isItemInventoryKey(key)) {
      if (delta > 0) {
        result = addItem(result, key, delta);
      } else {
        result = { ...result, [key]: getItemCount(result, key) + delta };
      }
      continue;
    }

    result = { ...result, coins: (result.coins ?? 0) + delta };
  }
  return result;
}

export function getEffectiveBuildInventory(
  state: Pick<GameState, "inventory" | "warehouseInventories" | "serviceHubs">,
): Inventory {
  const effective = { ...state.inventory } as Record<string, number>;
  for (const whInv of Object.values(state.warehouseInventories)) {
    for (const [key, amt] of Object.entries(whInv)) {
      effective[key] = (effective[key] ?? 0) + ((amt as number) ?? 0);
    }
  }
  for (const hub of Object.values(state.serviceHubs)) {
    for (const res of COLLECTABLE_KEYS) {
      effective[res] =
        (effective[res] ?? 0) +
        (hub.inventory[res as CollectableItemType] ?? 0);
    }
  }
  return effective as unknown as Inventory;
}

export function costIsFullyCollectable(
  costs: Partial<Record<keyof Inventory, number>>,
): boolean {
  return Object.keys(costs).every((k) => COLLECTABLE_KEYS.has(k));
}

export function fullCostAsRemaining(
  costs: Partial<Record<keyof Inventory, number>>,
): Partial<Record<CollectableItemType, number>> {
  const remaining: Partial<Record<CollectableItemType, number>> = {};
  for (const [k, v] of Object.entries(costs)) {
    if ((v ?? 0) > 0 && COLLECTABLE_KEYS.has(k)) {
      remaining[k as CollectableItemType] = v;
    }
  }
  return remaining;
}

export function consumeBuildResources(
  state: GameState,
  costs: Partial<Record<keyof Inventory, number>>,
): {
  inventory: Inventory;
  warehouseInventories: Record<string, Inventory>;
  serviceHubs: Record<string, ServiceHubEntry>;
  remaining: Partial<Record<CollectableItemType, number>>;
} {
  let inv: Inventory = { ...state.inventory };
  let warehouses = state.warehouseInventories;
  let hubs = state.serviceHubs;
  const remaining: Partial<Record<CollectableItemType, number>> = {};
  for (const [rawKey, amt] of Object.entries(costs)) {
    const key = rawKey as keyof Inventory;
    let needed = amt ?? 0;
    if (needed <= 0) continue;
    for (const [whId, whInv] of Object.entries(warehouses)) {
      if (needed <= 0) break;
      const whHave = isItemInventoryKey(key)
        ? getItemCount(whInv, key)
        : (whInv.coins ?? 0);
      const fromWh = Math.min(whHave, needed);
      if (fromWh > 0) {
        const nextWhInv = isItemInventoryKey(key)
          ? (removeItem(whInv, key, fromWh) ?? whInv)
          : { ...whInv, coins: whHave - fromWh };
        warehouses = {
          ...warehouses,
          [whId]: nextWhInv,
        };
        needed -= fromWh;
      }
    }
    if (needed > 0 && COLLECTABLE_KEYS.has(key)) {
      for (const [hubId, hub] of Object.entries(hubs)) {
        if (needed <= 0) break;
        const hubHave = hub.inventory[key as CollectableItemType] ?? 0;
        const fromHub = Math.min(hubHave, needed);
        if (fromHub > 0) {
          hubs = {
            ...hubs,
            [hubId]: {
              ...hub,
              inventory: { ...hub.inventory, [key]: hubHave - fromHub },
            },
          };
          needed -= fromHub;
        }
      }
    }
    if (needed > 0) {
      if (isItemInventoryKey(key)) {
        const globalHave = getItemCount(inv, key);
        const fromGlobal = Math.min(globalHave, needed);
        if (fromGlobal > 0) {
          const nextInv = removeItem(inv, key, fromGlobal);
          if (nextInv) {
            inv = nextInv;
          }
        }
        needed -= fromGlobal;
      } else {
        const globalHave = inv.coins ?? 0;
        const fromGlobal = Math.min(globalHave, needed);
        inv = { ...inv, coins: globalHave - fromGlobal };
        needed -= fromGlobal;
      }
    }
    if (needed > 0) {
      remaining[key as CollectableItemType] = needed;
    }
  }
  return {
    inventory: inv,
    warehouseInventories: warehouses,
    serviceHubs: hubs,
    remaining,
  };
}
