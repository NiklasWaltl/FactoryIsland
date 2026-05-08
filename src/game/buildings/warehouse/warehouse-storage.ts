import { COLLECTABLE_KEYS } from "../../store/constants/resources";
import { getItemCount, removeItem } from "../../inventory/helpers";
import type { ItemId } from "../../items/types";
import type {
  CollectableItemType,
  GameState,
  Inventory,
  ServiceHubEntry,
} from "../../store/types";

function isItemInventoryKey(key: keyof Inventory): key is ItemId {
  return key !== "coins";
}

function consumeBuildResources(
  state: Pick<GameState, "inventory" | "warehouseInventories" | "serviceHubs">,
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
    // 1) Warehouses first (any key they happen to hold).
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
    // 2) Then hubs (only collectable resource types).
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
    // 3) Last-resort fallback: global inventory (e.g. coins, items without
    // a physical home, or pre-Phase-1 saves where stocks still live globally).
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

/**
 * Pure predicate: are `costs` fully covered by the physical storage view
 * (warehouses + service hubs + last-resort global fallback)?
 *
 * Use this for affordance checks (build menu, upgrade buttons, crafting UI).
 * `null`/`undefined`/empty `costs` are treated as trivially satisfiable.
 */
export function hasResourcesInPhysicalStorage(
  state: Pick<GameState, "inventory" | "warehouseInventories" | "serviceHubs">,
  costs?: Partial<Record<keyof Inventory, number>> | null,
): boolean {
  if (!costs) return true;
  const consumed = consumeBuildResources(state, costs);
  return Object.keys(consumed.remaining).length === 0;
}

/**
 * Public, all-or-nothing consume helper for physical resources.
 *
 * Behaviour contract:
 *  - Pre-checks total availability via `hasResourcesInPhysicalStorage`.
 *  - Either fully deducts and returns `{ ok: true, ...next }`,
 *    or returns `{ ok: false }` and DOES NOT mutate any store.
 *  - Priority: warehouses → service hubs → state.inventory (fallback).
 *  - Negative inventory values are impossible by construction.
 */
export function consumeFromPhysicalStorage(
  state: GameState,
  costs: Partial<Record<keyof Inventory, number>>,
):
  | {
      ok: true;
      next: Pick<
        GameState,
        "inventory" | "warehouseInventories" | "serviceHubs"
      >;
    }
  | { ok: false } {
  if (!hasResourcesInPhysicalStorage(state, costs)) {
    return { ok: false };
  }
  const consumed = consumeBuildResources(state, costs);
  // hasResources guarantees remaining is empty; assert in DEV to catch logic drift.
  if (import.meta.env.DEV && Object.keys(consumed.remaining).length > 0) {
    return { ok: false };
  }
  return {
    ok: true,
    next: {
      inventory: consumed.inventory,
      warehouseInventories: consumed.warehouseInventories,
      serviceHubs: consumed.serviceHubs,
    },
  };
}
