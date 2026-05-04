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
import { DockWarehousePanel } from "../DockWarehousePanel";

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
      status: "sailing",
      activeQuest: null,
      nextQuest: null,
      dockedAt: null,
      departureAt: null,
      returnsAt: now + 120_000,
      rewardPending: false,
      pendingMultiplier: 1,
    },
  };
}

function buildDockedState(now: number, delivered: number): GameState {
  const base = buildBaseState();
  const quest = {
    itemId: "wood" as const,
    amount: 20,
    label: "Holz",
    phase: 1,
  };

  return {
    ...base,
    ship: {
      ...base.ship,
      status: "docked",
      activeQuest: quest,
      nextQuest: { ...quest, amount: 25 },
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

describe("DockWarehousePanel", () => {
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

  function renderPanel(state: GameState): jest.Mock<void, [GameAction]> {
    const dispatch = jest.fn<void, [GameAction]>();
    act(() => {
      root.render(<DockWarehousePanel state={state} dispatch={dispatch} />);
    });
    return dispatch;
  }

  function findButtonByLabel(text: string): HTMLButtonElement | null {
    const buttons = Array.from(
      container.querySelectorAll("button"),
    ) as HTMLButtonElement[];
    return buttons.find((button) => button.textContent?.includes(text)) ?? null;
  }

  it("shows countdown while ship is traveling and hides depart button", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(10_000);
    try {
      renderPanel(buildTravelingState(10_000));

      expect(container.textContent).toContain("Ankunft in");
      expect(container.textContent).toContain("2:00");
      expect(findButtonByLabel("Schiff ablegen lassen")).toBeNull();
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("shows quest, reward preview and depart button while docked", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(20_000);
    try {
      renderPanel(buildDockedState(20_000, 20));

      expect(container.textContent).toContain("Aktueller Auftrag");
      expect(container.textContent).toContain("Holz × 20");
      expect(container.textContent).toContain("Erwarteter Reward:");
      expect(findButtonByLabel("Schiff ablegen lassen")).not.toBeNull();
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("enables depart button when quest is fulfilled and dispatches SHIP_DEPART", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(30_000);
    try {
      const dispatch = renderPanel(buildDockedState(30_000, 20));
      const button = findButtonByLabel("Schiff ablegen lassen");

      expect(button).not.toBeNull();
      expect(button?.disabled).toBe(false);

      act(() => {
        button?.click();
      });

      expect(dispatch).toHaveBeenCalledWith({ type: "SHIP_DEPART" });
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("keeps depart button enabled for unfulfilled quest and shows warning hint", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(40_000);
    try {
      renderPanel(buildDockedState(40_000, 0));
      const button = findButtonByLabel("Schiff ablegen lassen");

      expect(button).not.toBeNull();
      expect(button?.disabled).toBe(false);
      expect(container.textContent).toContain("Warnung");
      expect(button?.title).toContain("Achtung");
    } finally {
      fakeNow.mockRestore();
    }
  });
});
