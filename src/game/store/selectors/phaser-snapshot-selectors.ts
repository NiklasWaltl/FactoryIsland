// ============================================================
// Phaser snapshot selectors (UI / read-only)
// ------------------------------------------------------------
// Stable selector-based caches for the snapshot arrays/objects
// that the GridRenderer feeds into PhaserHost. Replaces the
// previous fragile string-signature memoization in
// GridRenderer.tsx with slice-ref-keyed caches.
//
// Stability contract:
//  - Output reference is preserved across calls iff every
//    structural input compares equal to the last call.
//  - Inputs are stable slice references coming straight out of
//    the reducer (e.g. `state.drones`, `state.collectionNodes`).
//  - When the inputs DO change, the new output is content-equal
//    to the prior output where possible (re-uses entries via
//    item-level structural equality) so PhaserHost effects do
//    not fire on no-op state churn.
// ============================================================
import type { GameState, PlacedAsset, StarterDroneState } from "../types";
import type {
  StaticAssetSnapshot,
  DroneSnapshot,
  CollectionNodeSnapshot,
  ShipSnapshot,
} from "../../world/PhaserGame";
import {
  getDockWarehouseInputTile,
  getDockWarehousePos,
} from "../constants/map/map-layout";

// ----- Drone snapshots ----------------------------------------------------

interface DroneSnapshotsCache {
  readonly dronesRef: GameState["drones"] | null;
  readonly snapshots: DroneSnapshot[];
  readonly byId: Map<string, DroneSnapshot>;
}

let droneSnapshotsCache: DroneSnapshotsCache = {
  dronesRef: null,
  snapshots: [],
  byId: new Map(),
};

function buildDroneSnapshot(drone: StarterDroneState): DroneSnapshot {
  return {
    droneId: drone.droneId,
    status: drone.status,
    tileX: drone.tileX,
    tileY: drone.tileY,
    cargo: drone.cargo
      ? { itemType: drone.cargo.itemType, amount: drone.cargo.amount }
      : null,
    hubId: drone.hubId,
    isParkedAtHub: drone.status === "idle" && drone.hubId !== null,
    parkingSlot: null,
  };
}

function droneSnapshotEquals(a: DroneSnapshot, b: DroneSnapshot): boolean {
  if (a === b) return true;
  if (
    a.droneId !== b.droneId ||
    a.status !== b.status ||
    a.tileX !== b.tileX ||
    a.tileY !== b.tileY ||
    a.hubId !== b.hubId ||
    a.isParkedAtHub !== b.isParkedAtHub ||
    a.parkingSlot !== b.parkingSlot
  ) {
    return false;
  }
  if (a.cargo === b.cargo) return true;
  if (!a.cargo || !b.cargo) return false;
  return (
    a.cargo.itemType === b.cargo.itemType && a.cargo.amount === b.cargo.amount
  );
}

/**
 * Returns a stable DroneSnapshot[] for the given drones slice.
 *
 * If `state.drones` has not changed by reference, returns the previous
 * snapshot array unchanged. If individual entries are structurally equal
 * to the previous version, they are reused so the resulting array can
 * itself be reused when the order is unchanged.
 */
export function selectDroneSnapshots(
  drones: GameState["drones"],
): readonly DroneSnapshot[] {
  if (droneSnapshotsCache.dronesRef === drones) {
    return droneSnapshotsCache.snapshots;
  }

  const prev = droneSnapshotsCache.byId;
  const nextById = new Map<string, DroneSnapshot>();
  const nextSnapshots: DroneSnapshot[] = [];
  let allSameAsPrev = prev.size === Object.keys(drones).length;
  let i = 0;

  for (const drone of Object.values(drones)) {
    const built = buildDroneSnapshot(drone);
    const previous = prev.get(drone.droneId);
    const reused =
      previous && droneSnapshotEquals(previous, built) ? previous : built;
    nextSnapshots.push(reused);
    nextById.set(drone.droneId, reused);
    if (allSameAsPrev && droneSnapshotsCache.snapshots[i] !== reused) {
      allSameAsPrev = false;
    }
    i++;
  }

  if (allSameAsPrev) {
    droneSnapshotsCache = {
      dronesRef: drones,
      snapshots: droneSnapshotsCache.snapshots,
      byId: nextById,
    };
    return droneSnapshotsCache.snapshots;
  }

  droneSnapshotsCache = {
    dronesRef: drones,
    snapshots: nextSnapshots,
    byId: nextById,
  };
  return nextSnapshots;
}

// ----- Collection-node snapshots ------------------------------------------

interface CollectionNodeSnapshotsCache {
  readonly nodesRef: GameState["collectionNodes"] | null;
  readonly snapshots: CollectionNodeSnapshot[];
  readonly byId: Map<string, CollectionNodeSnapshot>;
}

let collectionNodeSnapshotsCache: CollectionNodeSnapshotsCache = {
  nodesRef: null,
  snapshots: [],
  byId: new Map(),
};

function collectionNodeSnapshotEquals(
  a: CollectionNodeSnapshot,
  b: CollectionNodeSnapshot,
): boolean {
  return (
    a === b ||
    (a.id === b.id &&
      a.itemType === b.itemType &&
      a.amount === b.amount &&
      a.tileX === b.tileX &&
      a.tileY === b.tileY)
  );
}

/**
 * Returns a stable CollectionNodeSnapshot[] for the given collectionNodes slice.
 *
 * Re-uses the previous array when the slice reference is unchanged or when
 * every node matches structurally; otherwise re-uses individual entries
 * that did not change.
 */
export function selectCollectionNodeSnapshots(
  collectionNodes: GameState["collectionNodes"],
): readonly CollectionNodeSnapshot[] {
  if (collectionNodeSnapshotsCache.nodesRef === collectionNodes) {
    return collectionNodeSnapshotsCache.snapshots;
  }

  const prev = collectionNodeSnapshotsCache.byId;
  const nextById = new Map<string, CollectionNodeSnapshot>();
  const nextSnapshots: CollectionNodeSnapshot[] = [];
  let allSameAsPrev = prev.size === Object.keys(collectionNodes).length;
  let i = 0;

  for (const node of Object.values(collectionNodes)) {
    const built: CollectionNodeSnapshot = {
      id: node.id,
      itemType: node.itemType,
      amount: node.amount,
      tileX: node.tileX,
      tileY: node.tileY,
    };
    const previous = prev.get(node.id);
    const reused =
      previous && collectionNodeSnapshotEquals(previous, built)
        ? previous
        : built;
    nextSnapshots.push(reused);
    nextById.set(node.id, reused);
    if (allSameAsPrev && collectionNodeSnapshotsCache.snapshots[i] !== reused) {
      allSameAsPrev = false;
    }
    i++;
  }

  if (allSameAsPrev) {
    collectionNodeSnapshotsCache = {
      nodesRef: collectionNodes,
      snapshots: collectionNodeSnapshotsCache.snapshots,
      byId: nextById,
    };
    return collectionNodeSnapshotsCache.snapshots;
  }

  collectionNodeSnapshotsCache = {
    nodesRef: collectionNodes,
    snapshots: nextSnapshots,
    byId: nextById,
  };
  return nextSnapshots;
}

// ----- Ship snapshot ------------------------------------------------------

interface ShipSnapshotCache {
  readonly statusRef: GameState["ship"]["status"] | null;
  readonly tileMapRef: GameState["tileMap"] | null;
  readonly snapshot: ShipSnapshot | null;
}

let shipSnapshotCache: ShipSnapshotCache = {
  statusRef: null,
  tileMapRef: null,
  snapshot: null,
};

/**
 * Returns a stable ShipSnapshot derived from ship.status + tileMap.
 *
 * Re-uses the previous snapshot when neither input ref has changed.
 */
export function selectShipSnapshot(
  state: Pick<GameState, "ship" | "tileMap">,
): ShipSnapshot {
  if (
    shipSnapshotCache.snapshot !== null &&
    shipSnapshotCache.statusRef === state.ship.status &&
    shipSnapshotCache.tileMapRef === state.tileMap
  ) {
    return shipSnapshotCache.snapshot;
  }

  const dockPos = getDockWarehousePos(state.tileMap);
  const dockInputTile = getDockWarehouseInputTile(state.tileMap);
  const snapshot: ShipSnapshot = {
    status: state.ship.status,
    dockTileX: dockPos.x,
    dockTileY: dockPos.y,
    inputTileX: dockInputTile.x,
    inputTileY: dockInputTile.y,
  };

  shipSnapshotCache = {
    statusRef: state.ship.status,
    tileMapRef: state.tileMap,
    snapshot,
  };
  return snapshot;
}

// ----- Static-asset snapshots --------------------------------------------

/** Asset types that are routed through Phaser as static sprites. */
const PHASER_RENDERED_TYPES: ReadonlySet<PlacedAsset["type"]> = new Set([
  "map_shop",
  "stone_deposit",
  "iron_deposit",
  "copper_deposit",
  "stone",
  "iron",
  "copper",
  "tree",
  "sapling",
  "cable",
  "generator",
  "battery",
  "power_pole",
  "conveyor",
  "conveyor_corner",
  "conveyor_merger",
  "conveyor_splitter",
  "conveyor_underground_in",
  "conveyor_underground_out",
  "auto_miner",
  "auto_smelter",
  "auto_assembler",
  "warehouse",
  "workbench",
  "smithy",
  "manual_assembler",
  "service_hub",
  "dock_warehouse",
  "module_lab",
  "research_lab",
]);

/** True if a given asset type is Phaser-rendered. Used by the grid overlay loop. */
export function isPhaserRenderedAssetType(type: PlacedAsset["type"]): boolean {
  return PHASER_RENDERED_TYPES.has(type);
}

interface FullStaticAssetsCache {
  readonly assetsRef: GameState["assets"] | null;
  readonly constructionSitesRef: GameState["constructionSites"] | null;
  readonly snapshots: StaticAssetSnapshot[];
  readonly byId: Map<string, StaticAssetSnapshot>;
}

let fullStaticAssetsCache: FullStaticAssetsCache = {
  assetsRef: null,
  constructionSitesRef: null,
  snapshots: [],
  byId: new Map(),
};

function staticAssetWidth(asset: PlacedAsset): 1 | 2 {
  return asset.width ?? asset.size;
}

function staticAssetHeight(asset: PlacedAsset): 1 | 2 {
  return asset.height ?? asset.size;
}

function staticAssetSnapshotEquals(
  a: StaticAssetSnapshot,
  b: StaticAssetSnapshot,
): boolean {
  return (
    a === b ||
    (a.id === b.id &&
      a.type === b.type &&
      a.x === b.x &&
      a.y === b.y &&
      a.width === b.width &&
      a.height === b.height &&
      a.direction === b.direction &&
      !!a.isUnderConstruction === !!b.isUnderConstruction &&
      !!a.isDeconstructing === !!b.isDeconstructing)
  );
}

/**
 * Returns the full, unculled list of Phaser-rendered static-asset snapshots.
 *
 * Stability: keyed on `state.assets` and `state.constructionSites` slice refs.
 * If both are unchanged, the previous array is returned as-is. If only some
 * entries changed, the unchanged entries are reused so consumers performing
 * an item-by-item equality check (e.g. viewport culling) can detect no-ops.
 */
export function selectFullStaticAssetSnapshots(
  state: Pick<GameState, "assets" | "constructionSites">,
): readonly StaticAssetSnapshot[] {
  if (
    fullStaticAssetsCache.assetsRef === state.assets &&
    fullStaticAssetsCache.constructionSitesRef === state.constructionSites
  ) {
    return fullStaticAssetsCache.snapshots;
  }

  const prev = fullStaticAssetsCache.byId;
  const nextById = new Map<string, StaticAssetSnapshot>();
  const nextSnapshots: StaticAssetSnapshot[] = [];
  // Track whether the resulting list is the same content+order as before so
  // we can return the previous array reference unchanged.
  let allSameAsPrev = true;
  let visitedRenderedCount = 0;

  for (const asset of Object.values(state.assets)) {
    if (!PHASER_RENDERED_TYPES.has(asset.type)) continue;

    const built: StaticAssetSnapshot = {
      id: asset.id,
      type: asset.type,
      x: asset.x,
      y: asset.y,
      width: staticAssetWidth(asset),
      height: staticAssetHeight(asset),
      direction: asset.direction,
      isUnderConstruction: !!state.constructionSites[asset.id],
      isDeconstructing: asset.status === "deconstructing",
    };

    const previous = prev.get(asset.id);
    const reused =
      previous && staticAssetSnapshotEquals(previous, built) ? previous : built;
    nextSnapshots.push(reused);
    nextById.set(asset.id, reused);

    if (
      allSameAsPrev &&
      (visitedRenderedCount >= fullStaticAssetsCache.snapshots.length ||
        fullStaticAssetsCache.snapshots[visitedRenderedCount] !== reused)
    ) {
      allSameAsPrev = false;
    }
    visitedRenderedCount++;
  }

  if (
    allSameAsPrev &&
    visitedRenderedCount === fullStaticAssetsCache.snapshots.length
  ) {
    fullStaticAssetsCache = {
      assetsRef: state.assets,
      constructionSitesRef: state.constructionSites,
      snapshots: fullStaticAssetsCache.snapshots,
      byId: nextById,
    };
    return fullStaticAssetsCache.snapshots;
  }

  fullStaticAssetsCache = {
    assetsRef: state.assets,
    constructionSitesRef: state.constructionSites,
    snapshots: nextSnapshots,
    byId: nextById,
  };
  return nextSnapshots;
}

// ----- Viewport-culled static-asset snapshots -----------------------------

interface CulledStaticAssetsCache {
  readonly sourceRef: readonly StaticAssetSnapshot[] | null;
  readonly minCellX: number;
  readonly minCellY: number;
  readonly maxCellX: number;
  readonly maxCellY: number;
  readonly snapshots: StaticAssetSnapshot[];
}

let culledStaticAssetsCache: CulledStaticAssetsCache = {
  sourceRef: null,
  minCellX: 0,
  minCellY: 0,
  maxCellX: 0,
  maxCellY: 0,
  snapshots: [],
};

function isAssetInViewport(
  asset: StaticAssetSnapshot,
  minCellX: number,
  minCellY: number,
  maxCellX: number,
  maxCellY: number,
): boolean {
  return !(
    asset.x + asset.width < minCellX ||
    asset.x > maxCellX ||
    asset.y + asset.height < minCellY ||
    asset.y > maxCellY
  );
}

/**
 * Returns a viewport-culled, reference-stable static-asset snapshot array.
 *
 * Stability: if the source array, all viewport bounds, and the resulting
 * filtered list are identical to the previous call (item-by-item), the
 * previous array is returned unchanged. This preserves PhaserHost's effect
 * gating across small pans that keep the visible set fixed.
 *
 * Cost per call when nothing changed: O(N_visible) reference comparisons,
 * no allocations.
 */
export function selectCulledStaticAssetSnapshots(
  source: readonly StaticAssetSnapshot[],
  minCellX: number,
  minCellY: number,
  maxCellX: number,
  maxCellY: number,
): readonly StaticAssetSnapshot[] {
  const cache = culledStaticAssetsCache;
  const sameInputs =
    cache.sourceRef === source &&
    cache.minCellX === minCellX &&
    cache.minCellY === minCellY &&
    cache.maxCellX === maxCellX &&
    cache.maxCellY === maxCellY;
  if (sameInputs) return cache.snapshots;

  const next: StaticAssetSnapshot[] = [];
  let matchesPrev = true;
  let prevIdx = 0;
  for (const asset of source) {
    if (!isAssetInViewport(asset, minCellX, minCellY, maxCellX, maxCellY)) {
      continue;
    }
    next.push(asset);
    if (
      matchesPrev &&
      (prevIdx >= cache.snapshots.length || cache.snapshots[prevIdx] !== asset)
    ) {
      matchesPrev = false;
    }
    prevIdx++;
  }

  if (matchesPrev && prevIdx === cache.snapshots.length) {
    culledStaticAssetsCache = {
      sourceRef: source,
      minCellX,
      minCellY,
      maxCellX,
      maxCellY,
      snapshots: cache.snapshots,
    };
    return cache.snapshots;
  }

  culledStaticAssetsCache = {
    sourceRef: source,
    minCellX,
    minCellY,
    maxCellX,
    maxCellY,
    snapshots: next,
  };
  return next;
}

/** Test-only helper to reset all module-level snapshot caches. */
export function __resetPhaserSnapshotCachesForTests(): void {
  droneSnapshotsCache = {
    dronesRef: null,
    snapshots: [],
    byId: new Map(),
  };
  collectionNodeSnapshotsCache = {
    nodesRef: null,
    snapshots: [],
    byId: new Map(),
  };
  shipSnapshotCache = {
    statusRef: null,
    tileMapRef: null,
    snapshot: null,
  };
  fullStaticAssetsCache = {
    assetsRef: null,
    constructionSitesRef: null,
    snapshots: [],
    byId: new Map(),
  };
  culledStaticAssetsCache = {
    sourceRef: null,
    minCellX: 0,
    minCellY: 0,
    maxCellX: 0,
    maxCellY: 0,
    snapshots: [],
  };
}
