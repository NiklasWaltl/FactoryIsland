// ============================================================
// Live-switch wrapper tests for the building-placement family
// (Option B migration, 2026-05-16).
// ------------------------------------------------------------
// Covers BUILD_PLACE_BUILDING, BUILD_REMOVE_ASSET (Build-1) and
// REMOVE_BUILDING (no-op) + UPGRADE_HUB (Build-2). Verifies that
// applyLiveContextReducers claims each action and produces results
// semantically identical to the legacy handler called with the
// live deps. Deep branch coverage stays in
// construction-site-integration.test.ts and
// build-remove-asset-generic.test.ts.
// ============================================================

import { createInitialState } from "../../initial-state";
import { cellKey } from "../../utils/cell-key";
import type { GameAction } from "../../game-actions";
import type {
  BuildingType,
  ConveyorState,
  GameState,
  PlacedAsset,
} from "../../types";

function makeStubRoutingCache(): NonNullable<GameState["routingIndexCache"]> {
  return {
    warehouseInputTilesByItemId: new Map(),
    activeWorkbenchJobsByInputItem: new Map(),
  } as NonNullable<GameState["routingIndexCache"]>;
}
import { applyLiveContextReducers } from "../create-game-reducer";

function baseState(): GameState {
  return createInitialState("release");
}

function withInventoryFor(state: GameState): GameState {
  return {
    ...state,
    inventory: {
      ...state.inventory,
      wood: Math.max(state.inventory.wood ?? 0, 999),
      stone: Math.max(state.inventory.stone ?? 0, 999),
      iron: Math.max(state.inventory.iron ?? 0, 999),
      copper: Math.max(state.inventory.copper ?? 0, 999),
    },
  };
}

function forcePlayableTiles(
  state: GameState,
  cells: Array<[number, number]>,
): GameState {
  const tileMap = state.tileMap.map((row) => [...row]);
  for (const [x, y] of cells) {
    if (tileMap[y]?.[x]) tileMap[y][x] = "grass";
  }
  return { ...state, tileMap };
}

function unlockedFor(state: GameState, type: BuildingType): GameState {
  return {
    ...state,
    unlockedBuildings: [...new Set([...state.unlockedBuildings, type])],
  };
}

function buildModeFor(
  state: GameState,
  bType: Exclude<GameState["selectedBuildingType"], null>,
): GameState {
  return {
    ...state,
    buildMode: true,
    selectedBuildingType: bType,
  };
}

function placementReady(
  state: GameState,
  bType: Exclude<GameState["selectedBuildingType"], null>,
  cells: Array<[number, number]>,
): GameState {
  return buildModeFor(
    unlockedFor(withInventoryFor(forcePlayableTiles(state, cells)), bType),
    bType,
  );
}

describe("applyLiveContextReducers — BUILD_PLACE_BUILDING", () => {
  it("claims the action (returns non-null state) instead of falling through", () => {
    const s = placementReady(baseState(), "cable", [[10, 10]]);
    const action: GameAction = { type: "BUILD_PLACE_BUILDING", x: 10, y: 10 };

    const result = applyLiveContextReducers(s, action);

    expect(result).not.toBeNull();
  });

  it("default branch: cable placement writes assets + cellMap + cablesPlaced++", () => {
    const s = placementReady(baseState(), "cable", [[10, 10]]);
    const before = s.cablesPlaced;
    const action: GameAction = { type: "BUILD_PLACE_BUILDING", x: 10, y: 10 };

    const result = applyLiveContextReducers(s, action);

    expect(result).not.toBeNull();
    const next = result!;
    expect(next.cablesPlaced).toBe(before + 1);
    expect(next.cellMap[cellKey(10, 10)]).toBeDefined();
    const placedId = next.cellMap[cellKey(10, 10)];
    expect(next.assets[placedId]?.type).toBe("cable");
  });

  it("default branch: power_pole placement writes powerPolesPlaced++ and asset entry", () => {
    const s = placementReady(baseState(), "power_pole", [[12, 12]]);
    const before = s.powerPolesPlaced;
    const action: GameAction = { type: "BUILD_PLACE_BUILDING", x: 12, y: 12 };

    const next = applyLiveContextReducers(s, action)!;

    expect(next.powerPolesPlaced).toBe(before + 1);
    const placedId = next.cellMap[cellKey(12, 12)];
    expect(next.assets[placedId]?.type).toBe("power_pole");
  });

  it("conveyor branch: writes conveyors[id] = { queue: [] } and applies direction", () => {
    const s = placementReady(baseState(), "conveyor", [[14, 14]]);
    const action: GameAction = {
      type: "BUILD_PLACE_BUILDING",
      x: 14,
      y: 14,
      direction: "east",
    };

    const next = applyLiveContextReducers(s, action)!;

    const placedId = next.cellMap[cellKey(14, 14)];
    expect(next.assets[placedId]?.type).toBe("conveyor");
    expect(next.assets[placedId]?.direction).toBe("east");
    const conv: ConveyorState | undefined = next.conveyors[placedId];
    expect(conv).toEqual({ queue: [] });
  });

  it("eligibility block: returns the input state when building is locked", () => {
    const s = buildModeFor(
      withInventoryFor(forcePlayableTiles(baseState(), [[16, 16]])),
      "cable",
    );
    const withoutUnlock: GameState = {
      ...s,
      unlockedBuildings: s.unlockedBuildings.filter((b) => b !== "cable"),
    };
    const action: GameAction = { type: "BUILD_PLACE_BUILDING", x: 16, y: 16 };

    const next = applyLiveContextReducers(withoutUnlock, action)!;

    // Lock-Guard appends a notification but does not place the asset.
    expect(next.cellMap[cellKey(16, 16)]).toBeUndefined();
    expect(next.cablesPlaced).toBe(withoutUnlock.cablesPlaced);
    // Notification was emitted via deps.addErrorNotification.
    expect(next.notifications.length).toBeGreaterThan(
      withoutUnlock.notifications.length,
    );
  });

  it("eligibility block: returns input state when no building type is selected", () => {
    const s: GameState = {
      ...withInventoryFor(forcePlayableTiles(baseState(), [[18, 18]])),
      buildMode: true,
      selectedBuildingType: null,
    };
    const action: GameAction = { type: "BUILD_PLACE_BUILDING", x: 18, y: 18 };

    const next = applyLiveContextReducers(s, action)!;

    expect(next).toBe(s);
  });

  it("bounds guard: out-of-bounds coordinates return state unchanged (no notification)", () => {
    const s = placementReady(baseState(), "cable", []);
    const action: GameAction = { type: "BUILD_PLACE_BUILDING", x: -1, y: 5 };

    const next = applyLiveContextReducers(s, action)!;

    expect(next).toBe(s);
  });

  it("finalize side-effect: connectedAssetIds is recomputed after placement", () => {
    const s = placementReady(baseState(), "cable", [[20, 20]]);
    const action: GameAction = { type: "BUILD_PLACE_BUILDING", x: 20, y: 20 };

    const next = applyLiveContextReducers(s, action)!;

    // computeConnectedAssetIds runs unconditionally in finalizePlacement,
    // producing a fresh array reference even when the connectivity set is
    // unchanged. The reference inequality proves the post-mutation pass ran.
    expect(next.connectedAssetIds).not.toBe(s.connectedAssetIds);
  });

  it("finalize side-effect: routingIndexCache is invalidated after placement", () => {
    const stateWithCache: GameState = {
      ...placementReady(baseState(), "cable", [[22, 22]]),
      routingIndexCache: makeStubRoutingCache(),
    };
    const action: GameAction = { type: "BUILD_PLACE_BUILDING", x: 22, y: 22 };

    const next = applyLiveContextReducers(stateWithCache, action)!;

    expect(next.routingIndexCache).not.toBe(stateWithCache.routingIndexCache);
  });
});

describe("applyLiveContextReducers — BUILD_REMOVE_ASSET", () => {
  function stateWithConveyor(id: string, x: number, y: number): GameState {
    const conveyor: PlacedAsset = {
      id,
      type: "conveyor",
      x,
      y,
      size: 1,
      direction: "east",
    };
    const base = forcePlayableTiles(baseState(), [[x, y]]);
    return {
      ...base,
      buildMode: true,
      assets: { ...base.assets, [id]: conveyor },
      cellMap: { ...base.cellMap, [cellKey(x, y)]: id },
      conveyors: { ...base.conveyors, [id]: { queue: [] } },
    };
  }

  it("claims the action (returns non-null state) instead of falling through", () => {
    const s = stateWithConveyor("conv-live-1", 30, 30);
    const action: GameAction = {
      type: "BUILD_REMOVE_ASSET",
      assetId: "conv-live-1",
    };

    const result = applyLiveContextReducers(s, action);

    expect(result).not.toBeNull();
  });

  it("removes the asset from assets + cellMap and deletes conveyors entry", () => {
    const s = stateWithConveyor("conv-live-2", 32, 32);
    const action: GameAction = {
      type: "BUILD_REMOVE_ASSET",
      assetId: "conv-live-2",
    };

    const next = applyLiveContextReducers(s, action)!;

    expect(next.assets["conv-live-2"]).toBeUndefined();
    expect(next.cellMap[cellKey(32, 32)]).toBeUndefined();
    expect(next.conveyors["conv-live-2"]).toBeUndefined();
  });

  it("eligibility block: returns input state when assetId is missing", () => {
    const s: GameState = { ...baseState(), buildMode: true };
    const action: GameAction = {
      type: "BUILD_REMOVE_ASSET",
      assetId: "does-not-exist",
    };

    const next = applyLiveContextReducers(s, action)!;

    expect(next).toBe(s);
  });

  it("eligibility block: returns input state when neither buildMode nor building-tool is active", () => {
    const s = stateWithConveyor("conv-live-3", 34, 34);
    const withoutTool: GameState = { ...s, buildMode: false };
    const action: GameAction = {
      type: "BUILD_REMOVE_ASSET",
      assetId: "conv-live-3",
    };

    const next = applyLiveContextReducers(withoutTool, action)!;

    expect(next).toBe(withoutTool);
  });

  it("finalize side-effect: connectedAssetIds is recomputed after removal", () => {
    const s = stateWithConveyor("conv-live-4", 36, 36);
    const action: GameAction = {
      type: "BUILD_REMOVE_ASSET",
      assetId: "conv-live-4",
    };

    const next = applyLiveContextReducers(s, action)!;

    expect(next.connectedAssetIds).not.toBe(s.connectedAssetIds);
  });

  it("finalize side-effect: routingIndexCache is invalidated after removal", () => {
    const s: GameState = {
      ...stateWithConveyor("conv-live-5", 38, 38),
      routingIndexCache: makeStubRoutingCache(),
    };
    const action: GameAction = {
      type: "BUILD_REMOVE_ASSET",
      assetId: "conv-live-5",
    };

    const next = applyLiveContextReducers(s, action)!;

    expect(next.routingIndexCache).not.toBe(s.routingIndexCache);
  });
});

// ============================================================
// Build-2: REMOVE_BUILDING + UPGRADE_HUB
// ============================================================

describe("applyLiveContextReducers — REMOVE_BUILDING", () => {
  it("returns the same state reference (no-op marker)", () => {
    const s = baseState();
    const action: GameAction = {
      type: "REMOVE_BUILDING",
      buildingType: "workbench",
    };

    const next = applyLiveContextReducers(s, action);

    expect(next).toBe(s);
  });
});

describe("applyLiveContextReducers — UPGRADE_HUB", () => {
  const HUB_ID = "hub-upgrade-test";
  const ALL_COLLECTABLES: Array<
    keyof import("../../types").ServiceHubInventory
  > = [
    "wood",
    "stone",
    "iron",
    "copper",
    "iron_ingot",
    "copper_ingot",
    "metal_plate",
    "sapling",
    "wire",
    "coin",
    "iron_pickaxe",
    "module_fragment",
  ] as Array<keyof import("../../types").ServiceHubInventory>;

  function emptyHubInventory(): import("../../types").ServiceHubInventory {
    const inv = {} as import("../../types").ServiceHubInventory;
    for (const key of ALL_COLLECTABLES) inv[key] = 0;
    return inv;
  }

  function defaultTargetStock(): Record<
    import("../../types").CollectableItemType,
    number
  > {
    const ts = {} as Record<import("../../types").CollectableItemType, number>;
    for (const key of ALL_COLLECTABLES) ts[key] = 0;
    return ts;
  }

  function makeHubAsset(): PlacedAsset {
    return {
      id: HUB_ID,
      type: "service_hub",
      x: 5,
      y: 5,
      size: 2,
    };
  }

  function stateWithTier1Hub(overrides: Partial<GameState> = {}): GameState {
    const base = baseState();
    return {
      ...base,
      assets: { ...base.assets, [HUB_ID]: makeHubAsset() },
      serviceHubs: {
        ...base.serviceHubs,
        [HUB_ID]: {
          inventory: emptyHubInventory(),
          targetStock: defaultTargetStock(),
          tier: 1,
          droneIds: [],
        },
      },
      inventory: {
        ...base.inventory,
        wood: 999,
        stone: 999,
        iron: 999,
      },
      ...overrides,
    };
  }

  it("success path: creates constructionSites entry and stamps pendingUpgrade on the hub", () => {
    const s = stateWithTier1Hub();
    const action: GameAction = { type: "UPGRADE_HUB", hubId: HUB_ID };

    const next = applyLiveContextReducers(s, action)!;

    expect(next).not.toBe(s);
    expect(next.constructionSites[HUB_ID]).toBeDefined();
    expect(next.constructionSites[HUB_ID].buildingType).toBe("service_hub");
    expect(next.serviceHubs[HUB_ID].pendingUpgrade).toEqual({
      wood: 15,
      stone: 10,
      iron: 5,
    });
    expect(next.serviceHubs[HUB_ID].tier).toBe(1);
  });

  it("blocks when hub is still under construction and appends a notification", () => {
    const s = stateWithTier1Hub({
      constructionSites: {
        [HUB_ID]: {
          buildingType: "service_hub",
          remaining: { wood: 5 },
        },
      },
    });
    const action: GameAction = { type: "UPGRADE_HUB", hubId: HUB_ID };

    const next = applyLiveContextReducers(s, action)!;

    // Hub stays tier 1 with no pendingUpgrade.
    expect(next.serviceHubs[HUB_ID].pendingUpgrade).toBeUndefined();
    // Notification was emitted via deps.addErrorNotification.
    expect(next.notifications.length).toBeGreaterThan(s.notifications.length);
  });

  it("silently no-ops when hub tier !== 1 (already upgraded)", () => {
    const base = stateWithTier1Hub();
    const s: GameState = {
      ...base,
      serviceHubs: {
        ...base.serviceHubs,
        [HUB_ID]: { ...base.serviceHubs[HUB_ID], tier: 2 },
      },
    };
    const action: GameAction = { type: "UPGRADE_HUB", hubId: HUB_ID };

    const next = applyLiveContextReducers(s, action)!;

    expect(next).toBe(s);
  });

  it("silently no-ops when pendingUpgrade is already set", () => {
    const base = stateWithTier1Hub();
    const s: GameState = {
      ...base,
      serviceHubs: {
        ...base.serviceHubs,
        [HUB_ID]: {
          ...base.serviceHubs[HUB_ID],
          pendingUpgrade: { wood: 15 },
        },
      },
    };
    const action: GameAction = { type: "UPGRADE_HUB", hubId: HUB_ID };

    const next = applyLiveContextReducers(s, action)!;

    expect(next).toBe(s);
  });

  it("blocks when physical storage cannot cover the cost and appends a notification", () => {
    const base = stateWithTier1Hub();
    const s: GameState = {
      ...base,
      inventory: { ...base.inventory, wood: 0, stone: 0, iron: 0 },
      warehouseInventories: {},
    };
    const action: GameAction = { type: "UPGRADE_HUB", hubId: HUB_ID };

    const next = applyLiveContextReducers(s, action)!;

    expect(next.serviceHubs[HUB_ID].pendingUpgrade).toBeUndefined();
    expect(next.constructionSites[HUB_ID]).toBeUndefined();
    expect(next.notifications.length).toBeGreaterThan(s.notifications.length);
  });
});
