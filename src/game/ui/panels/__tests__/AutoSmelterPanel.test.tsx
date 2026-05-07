import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Module } from "../../../modules/module.types";
import {
  createInitialState,
  type AutoSmelterEntry,
  type GameAction,
  type GameState,
  type PlacedAsset,
} from "../../../store/reducer";
import { AutoSmelterPanel } from "../AutoSmelterPanel";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const SMELTER_ID = "smelter-1";

function makeSmelterAsset(overrides: Partial<PlacedAsset> = {}): PlacedAsset {
  return {
    id: SMELTER_ID,
    type: "auto_smelter",
    x: 8,
    y: 8,
    size: 2,
    width: 2,
    height: 1,
    direction: "east",
    ...overrides,
  };
}

function makeSmelterEntry(): AutoSmelterEntry {
  return {
    inputBuffer: [],
    processing: null,
    pendingOutput: [],
    status: "IDLE",
    lastRecipeInput: null,
    lastRecipeOutput: null,
    throughputEvents: [],
    selectedRecipe: "iron",
  };
}

function makeModule(module: Partial<Module> & Pick<Module, "id">): Module {
  return {
    type: "smelter-boost",
    tier: 1,
    equippedTo: null,
    ...module,
  };
}

function buildState(
  input: {
    modules?: Module[];
    assetOverrides?: Partial<PlacedAsset>;
  } = {},
): GameState {
  const base = createInitialState("release");
  return {
    ...base,
    assets: {
      ...base.assets,
      [SMELTER_ID]: makeSmelterAsset(input.assetOverrides),
    },
    autoSmelters: {
      ...base.autoSmelters,
      [SMELTER_ID]: makeSmelterEntry(),
    },
    machinePowerRatio: { ...base.machinePowerRatio, [SMELTER_ID]: 1 },
    selectedAutoSmelterId: SMELTER_ID,
    openPanel: "auto_smelter",
    moduleInventory: input.modules ?? [],
  };
}

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

function renderPanel(
  state: GameState,
  dispatch: React.Dispatch<GameAction>,
): void {
  act(() => {
    root.render(<AutoSmelterPanel state={state} dispatch={dispatch} />);
  });
}

function getButton(label: string): HTMLButtonElement | null {
  const buttons = Array.from(container.querySelectorAll("button"));
  return (
    (buttons.find((button) => button.textContent?.includes(label)) as
      | HTMLButtonElement
      | undefined) ?? null
  );
}

function clickButton(button: HTMLButtonElement): void {
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("AutoSmelterPanel module slot", () => {
  it("shows the slot section when the panel is open", () => {
    renderPanel(buildState(), jest.fn());

    expect(container.textContent).toContain("Modul-Slot");
  });

  it("shows the empty inventory hint when no modules are available", () => {
    renderPanel(buildState(), jest.fn());

    expect(container.textContent).toContain(
      "Keine Module verfügbar — im Modul-Labor craften",
    );
  });

  it("dispatches PLACE_MODULE with the selected module and asset ids", () => {
    const dispatch = jest.fn<void, [GameAction]>();
    const state = buildState({ modules: [makeModule({ id: "module-1" })] });
    renderPanel(state, dispatch);

    const button = getButton("Einsetzen");
    expect(button).not.toBeNull();
    clickButton(button!);

    expect(dispatch).toHaveBeenCalledWith({
      type: "PLACE_MODULE",
      moduleId: "module-1",
      assetId: SMELTER_ID,
    });
  });

  it("dispatches REMOVE_MODULE for the equipped module", () => {
    const dispatch = jest.fn<void, [GameAction]>();
    const state = buildState({
      assetOverrides: { moduleSlot: "module-1" },
      modules: [makeModule({ id: "module-1", equippedTo: SMELTER_ID })],
    });
    renderPanel(state, dispatch);

    expect(container.textContent).toContain("Smelter-Boost Tier 1");
    const button = getButton("Herausnehmen");
    expect(button).not.toBeNull();
    clickButton(button!);

    expect(dispatch).toHaveBeenCalledWith({
      type: "REMOVE_MODULE",
      moduleId: "module-1",
    });
  });
});
