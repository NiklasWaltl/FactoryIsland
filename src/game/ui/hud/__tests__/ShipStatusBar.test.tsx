import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  createInitialState,
  type GameAction,
  type GameState,
} from "../../../store/reducer";
import {
  applyDockWarehouseLayout,
  DOCK_WAREHOUSE_ID,
} from "../../../store/bootstrap/apply-dock-warehouse-layout";
import { ShipStatusBar } from "../ShipStatusBar";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function buildBaseState(): GameState {
  return applyDockWarehouseLayout(createInitialState("release"));
}

function buildTravelingState(now: number): GameState {
  const base = buildBaseState();
  return {
    ...base,
    ship: {
      ...base.ship,
      status: "departing",
      activeQuest: null,
      nextQuest: null,
      dockedAt: null,
      departureAt: null,
      returnsAt: now + 90_000,
      rewardPending: false,
      pendingMultiplier: 1,
    },
  };
}

function buildDockedState(now: number, delivered: number): GameState {
  const base = buildBaseState();
  const quest = {
    itemId: "wood" as const,
    amount: 10,
    label: "Holz",
    phase: 1,
  };

  return {
    ...base,
    ship: {
      ...base.ship,
      status: "docked",
      activeQuest: quest,
      nextQuest: null,
      dockedAt: now - 1_000,
      departureAt: now + 60_000,
      returnsAt: null,
      rewardPending: false,
      pendingMultiplier: 1,
    },
    warehouseInventories: {
      ...base.warehouseInventories,
      [DOCK_WAREHOUSE_ID]: {
        ...base.warehouseInventories[DOCK_WAREHOUSE_ID],
        wood: delivered,
      },
    },
  };
}

describe("ShipStatusBar", () => {
  let container: HTMLDivElement;
  let root: Root;
  let dispatch: jest.Mock<void, [GameAction]>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    dispatch = jest.fn<void, [GameAction]>();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders traveling status (departing)", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(10_000);
    try {
      act(() => {
        root.render(
          <ShipStatusBar
            state={buildTravelingState(10_000)}
            dispatch={dispatch}
          />,
        );
      });

      expect(container.textContent).toContain("Unterwegs");
      expect(container.textContent).toContain("Rückkehr: 1:30");
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("renders docked status with quest name and progress", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(20_000);
    try {
      act(() => {
        root.render(
          <ShipStatusBar
            state={buildDockedState(20_000, 5)}
            dispatch={dispatch}
          />,
        );
      });

      expect(container.textContent).toContain("Angedockt");
      expect(container.textContent).toContain("Holz ×10");
      expect(container.textContent).toContain("Fortschritt: 5/10 (50%)");
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("updates UI when ship status changes", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(30_000);
    try {
      act(() => {
        root.render(
          <ShipStatusBar
            state={buildTravelingState(30_000)}
            dispatch={dispatch}
          />,
        );
      });
      expect(container.textContent).toContain("Unterwegs");

      act(() => {
        root.render(
          <ShipStatusBar
            state={buildDockedState(30_000, 10)}
            dispatch={dispatch}
          />,
        );
      });

      expect(container.textContent).toContain("Angedockt");
      expect(container.textContent).toContain("Fortschritt: 10/10 (100%)");
    } finally {
      fakeNow.mockRestore();
    }
  });
});
