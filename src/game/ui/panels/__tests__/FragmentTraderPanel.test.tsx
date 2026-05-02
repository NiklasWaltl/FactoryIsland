import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  createInitialState,
  type GameAction,
  type GameState,
} from "../../../store/reducer";
import { FragmentTraderPanel } from "../FragmentTraderPanel";
import { PITY_THRESHOLD } from "../../../ship/ship-constants";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function stateWithCoinsAndPity(
  coins: number,
  shipsSinceLastFragment = 0,
): GameState {
  const base = createInitialState("release");
  return {
    ...base,
    inventory: { ...base.inventory, coins },
    ship: { ...base.ship, shipsSinceLastFragment },
  };
}

describe("FragmentTraderPanel", () => {
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

  function renderPanel(state: GameState) {
    const dispatch = jest.fn<void, [GameAction]>();
    act(() => {
      root.render(<FragmentTraderPanel state={state} dispatch={dispatch} />);
    });
    return dispatch;
  }

  function buyButton(): HTMLButtonElement {
    const button = Array.from(container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.includes("Kaufen"),
    );
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("Buy button not found");
    }
    return button;
  }

  it("disables the buy button when coins are 499", () => {
    renderPanel(stateWithCoinsAndPity(499));

    expect(buyButton().disabled).toBe(true);
  });

  it("enables the buy button when coins are 500", () => {
    renderPanel(stateWithCoinsAndPity(500));

    expect(buyButton().disabled).toBe(false);
  });

  it("shows pity progress when shipsSinceLastFragment is 5", () => {
    renderPanel(stateWithCoinsAndPity(500, 5));

    expect(container.textContent).toContain(
      "Pity: noch 5 Schiffe bis Rabattpreis",
    );
  });

  it("shows the discount label when pity threshold is reached", () => {
    renderPanel(stateWithCoinsAndPity(250, PITY_THRESHOLD));

    expect(buyButton().textContent).toContain("Kaufen — 250 🪙 (Rabatt!)");
    expect(buyButton().disabled).toBe(false);
  });

  it("shows the collected module fragment count", () => {
    const state = {
      ...stateWithCoinsAndPity(500),
      moduleFragments: 2,
    };

    renderPanel(state);

    expect(container.textContent).toContain("Fragmente im Inventar: 2");
  });

  it("dispatches COLLECT_FRAGMENT after a successful buy", () => {
    const dispatch = renderPanel(stateWithCoinsAndPity(500));

    act(() => {
      buyButton().click();
    });

    expect(dispatch).toHaveBeenNthCalledWith(1, { type: "BUY_FRAGMENT" });
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: "COLLECT_FRAGMENT" });
  });
});
