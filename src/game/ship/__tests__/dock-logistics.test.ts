import { getBuildingInputTargets } from "../../buildings/building-input-targets";
import { selectDroneTask } from "../../drones/selection/select-drone-task-bindings";
import { addToCollectionNodeAt } from "../../store/helpers/reducer-helpers";
import { gameReducer, createInitialState } from "../../store/reducer";
import {
  applyDockWarehouseLayout,
  DOCK_WAREHOUSE_ID,
} from "../../store/bootstrap/apply-dock-warehouse-layout";
import { createEmptyInventory } from "../../store/inventory-ops";
import { getWarehouseInputCell } from "../../store/warehouse-input";
import { cellKey } from "../../store/utils/cell-key";
import type { ShipState } from "../../store/types/ship-types";
import type {
  CollectableItemType,
  GameAction,
  GameState,
  Inventory,
  PlacedAsset,
} from "../../store/types";

function dispatch(state: GameState, ...actions: GameAction[]): GameState {
  let next = state;
  for (const action of actions) next = gameReducer(next, action);
  return next;
}

function createShipReadyState(): GameState {
  const base = createInitialState("release");
  const ship: ShipState = {
    status: "sailing",
    activeQuest: null,
    nextQuest: null,
    questHistory: [],
    dockedAt: null,
    departureAt: null,
    returnsAt: Date.now() + 30_000,
    rewardPending: false,
    lastReward: null,
    questPhase: 1,
    shipsSinceLastFragment: 0,
    pityCounter: 0,
    pendingMultiplier: 1,
  };

  return applyDockWarehouseLayout({
    ...base,
    ship,
    moduleInventory: [],
    moduleFragments: 0,
    moduleLabJob: null,
  });
}

function withDockedQuest(
  state: GameState,
  itemId: CollectableItemType = "wood",
  amount = 30,
): GameState {
  return {
    ...state,
    ship: {
      ...state.ship,
      status: "docked",
      activeQuest: { itemId, amount, label: itemId, phase: 1 },
      nextQuest: null,
      dockedAt: 0,
      departureAt: null,
      returnsAt: null,
      rewardPending: false,
      pendingMultiplier: 1,
    },
  };
}

function withSilencedHubRestock(state: GameState): GameState {
  const zeroStock: Record<CollectableItemType, number> = {
    wood: 0,
    stone: 0,
    iron: 0,
    copper: 0,
  };
  const serviceHubs = Object.fromEntries(
    Object.entries(state.serviceHubs).map(([hubId, hub]) => [
      hubId,
      {
        ...hub,
        inventory: { ...hub.inventory, ...zeroStock },
        targetStock: { ...hub.targetStock, ...zeroStock },
        pendingUpgrade: undefined,
      },
    ]),
  );
  return { ...state, serviceHubs };
}

function withCollectionNode(
  state: GameState,
  itemType: CollectableItemType,
  amount: number,
): GameState {
  return {
    ...state,
    collectionNodes: addToCollectionNodeAt(
      state.collectionNodes,
      itemType,
      state.starterDrone.tileX,
      state.starterDrone.tileY,
      amount,
    ),
  };
}

function withDockInventory(
  state: GameState,
  patch: Partial<Inventory>,
): GameState {
  return {
    ...state,
    warehouseInventories: {
      ...state.warehouseInventories,
      [DOCK_WAREHOUSE_ID]: {
        ...createEmptyInventory(),
        ...state.warehouseInventories[DOCK_WAREHOUSE_ID],
        ...patch,
      },
    },
  };
}

function withGeneratorNeedingWood(state: GameState): GameState {
  const generatorId = "test-generator";
  const generatorAsset: PlacedAsset = {
    id: generatorId,
    type: "generator",
    x: state.starterDrone.tileX + 4,
    y: state.starterDrone.tileY,
    size: 2,
    width: 2,
    height: 2,
  };
  return {
    ...state,
    assets: { ...state.assets, [generatorId]: generatorAsset },
    generators: {
      ...state.generators,
      [generatorId]: {
        fuel: 0,
        progress: 0,
        running: false,
        requestedRefill: 10,
      },
    },
  };
}

describe("dock warehouse logistics integration", () => {
  it("accepts conveyor delivery on the dock warehouse input tile", () => {
    const base = createShipReadyState();
    const dock = base.assets[DOCK_WAREHOUSE_ID];
    const input = getWarehouseInputCell(dock);
    const conveyorId = "dock-input-conveyor";
    const conveyor: PlacedAsset = {
      id: conveyorId,
      type: "conveyor",
      x: input.x,
      y: input.y,
      size: 1,
      direction: input.requiredDir,
    };
    const state: GameState = {
      ...base,
      assets: { ...base.assets, [conveyorId]: conveyor },
      cellMap: { ...base.cellMap, [cellKey(input.x, input.y)]: conveyorId },
      conveyors: { ...base.conveyors, [conveyorId]: { queue: ["wood"] } },
      connectedAssetIds: [...base.connectedAssetIds, conveyorId],
      poweredMachineIds: [...base.poweredMachineIds, conveyorId],
    };

    const next = dispatch(state, { type: "LOGISTICS_TICK" });

    expect(next.warehouseInventories[DOCK_WAREHOUSE_ID].wood).toBe(1);
    expect(next.conveyors[conveyorId].queue).toEqual([]);
  });

  it("plans dock warehouse building_supply only while a matching quest is docked", () => {
    const docked = withCollectionNode(
      withSilencedHubRestock(withDockedQuest(createShipReadyState())),
      "wood",
      10,
    );

    const dockedTask = selectDroneTask(docked);

    expect(getBuildingInputTargets(docked)).toContainEqual({
      assetId: DOCK_WAREHOUSE_ID,
      resource: "wood",
      capacity: 30,
    });
    expect(dockedTask).toMatchObject({
      taskType: "building_supply",
      deliveryTargetId: DOCK_WAREHOUSE_ID,
    });

    const sailing = withCollectionNode(
      withSilencedHubRestock(createShipReadyState()),
      "wood",
      10,
    );

    expect(getBuildingInputTargets(sailing)).not.toContainEqual(
      expect.objectContaining({ assetId: DOCK_WAREHOUSE_ID }),
    );
    expect(selectDroneTask(sailing)?.deliveryTargetId).not.toBe(
      DOCK_WAREHOUSE_ID,
    );
  });

  it("does not source a dock quest delivery from the dock warehouse itself", () => {
    const state = withDockInventory(
      withSilencedHubRestock(withDockedQuest(createShipReadyState())),
      { wood: 5 },
    );

    const task = selectDroneTask(state);

    expect(task?.nodeId).not.toBe(`wh:${DOCK_WAREHOUSE_ID}:wood`);
  });

  it("uses the dock warehouse as a warehouse source for building_supply", () => {
    const state = withGeneratorNeedingWood(
      withDockInventory(withSilencedHubRestock(createShipReadyState()), {
        wood: 10,
      }),
    );

    const task = selectDroneTask(state);

    expect(task).toMatchObject({
      taskType: "building_supply",
      nodeId: `wh:${DOCK_WAREHOUSE_ID}:wood`,
      deliveryTargetId: "test-generator",
    });
  });

  it("uses the dock warehouse as a warehouse source for hub_dispatch", () => {
    const siteId = "test-construction-site";
    const siteAsset: PlacedAsset = {
      id: siteId,
      type: "workbench",
      x: 8,
      y: 8,
      size: 2,
      width: 2,
      height: 2,
    };
    const state: GameState = withDockInventory(
      withSilencedHubRestock(createShipReadyState()),
      { wood: 10 },
    );
    const withSite: GameState = {
      ...state,
      assets: { ...state.assets, [siteId]: siteAsset },
      constructionSites: {
        ...state.constructionSites,
        [siteId]: { buildingType: "workbench", remaining: { wood: 5 } },
      },
    };

    const task = selectDroneTask(withSite);

    expect(task).toMatchObject({
      taskType: "hub_dispatch",
      nodeId: `wh:${DOCK_WAREHOUSE_ID}:wood`,
      deliveryTargetId: siteId,
    });
  });

  it("does not create a reward when the dock warehouse departs empty", () => {
    const state = withDockInventory(
      withDockedQuest(createShipReadyState()),
      createEmptyInventory(),
    );

    const departed = dispatch(state, { type: "SHIP_DEPART" });
    const returned = dispatch(departed, { type: "SHIP_RETURN" });

    expect(departed.ship.pendingMultiplier).toBe(0);
    expect(departed.ship.rewardPending).toBe(false);
    expect(departed.ship.lastReward).toBeNull();
    expect(departed.warehouseInventories[DOCK_WAREHOUSE_ID]).toMatchObject(
      createEmptyInventory(),
    );
    expect(returned.ship.lastReward).toBeNull();
    expect(returned.warehouseInventories[DOCK_WAREHOUSE_ID]).toEqual(
      departed.warehouseInventories[DOCK_WAREHOUSE_ID],
    );
  });
});
