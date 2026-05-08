import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  cellKey,
  createInitialState,
  type GameState,
  type Inventory,
  type PlacedAsset,
} from "../../../store/reducer";
import type { CraftingJob } from "../../../crafting/types";
import { ProductionStatusFeed } from "../ProductionStatusFeed";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const WB = "wb-feed";
const WH = "wh-feed";

function buildState(overrides?: Partial<Inventory>): GameState {
  const base = createInitialState("release");
  const workbench: PlacedAsset = {
    id: WB,
    type: "workbench",
    x: 4,
    y: 4,
    size: 1,
  };
  const warehouse: PlacedAsset = {
    id: WH,
    type: "warehouse",
    x: 8,
    y: 8,
    size: 2,
  };
  const job: CraftingJob = {
    id: "job-feed-output",
    recipeId: "wood_pickaxe",
    workbenchId: WB,
    inventorySource: { kind: "warehouse", warehouseId: WH },
    inputBuffer: [],
    status: "delivering",
    priority: "normal",
    source: "player",
    enqueuedAt: 1,
    startedAt: null,
    finishesAt: null,
    progress: 0,
    ingredients: [{ itemId: "wood", count: 1 }],
    output: { itemId: "wood_pickaxe", count: 1 },
    processingTime: 1,
    reservationOwnerId: "job-feed-output",
  };

  return {
    ...base,
    assets: {
      ...base.assets,
      [WB]: workbench,
      [WH]: warehouse,
    },
    cellMap: {
      ...base.cellMap,
      [cellKey(4, 4)]: WB,
      [cellKey(8, 8)]: WH,
      [cellKey(9, 8)]: WH,
      [cellKey(8, 9)]: WH,
      [cellKey(9, 9)]: WH,
    },
    warehouseInventories: {
      [WH]: {
        ...base.inventory,
        ...(overrides ?? {}),
      },
    },
    buildingSourceWarehouseIds: {
      [WB]: WH,
    },
    crafting: {
      ...base.crafting,
      jobs: [job],
    },
  };
}

describe("ProductionStatusFeed", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders production blocker reasons in the feed", () => {
    act(() => {
      root.render(<ProductionStatusFeed state={buildState({ wood: 5 })} />);
    });

    expect(container.textContent).toContain("📦 Output voll");
  });
});
