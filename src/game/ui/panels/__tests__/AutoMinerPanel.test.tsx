import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Module } from "../../../modules/module.types";
import {
  createInitialState,
  gameReducer,
  type GameAction,
  type GameState,
  type PlacedAsset,
} from "../../../store/reducer";
import { AutoMinerPanel } from "../AutoMinerPanel";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const MINER_ID = "miner-1";

function makeAutoMinerAsset(overrides: Partial<PlacedAsset> = {}): PlacedAsset {
  return {
    id: MINER_ID,
    type: "auto_miner",
    x: 8,
    y: 8,
    size: 1,
    ...overrides,
  };
}

function makeModule(module: Partial<Module> & Pick<Module, "id">): Module {
  return {
    type: "miner-boost",
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
      [MINER_ID]: makeAutoMinerAsset(input.assetOverrides),
    },
    autoMiners: {
      ...base.autoMiners,
      [MINER_ID]: {
        depositId: "iron-deposit-1",
        resource: "iron",
        progress: 0,
      },
    },
    connectedAssetIds: [...base.connectedAssetIds, MINER_ID],
    poweredMachineIds: [...base.poweredMachineIds, MINER_ID],
    machinePowerRatio: { ...base.machinePowerRatio, [MINER_ID]: 1 },
    selectedAutoMinerId: MINER_ID,
    openPanel: "auto_miner",
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
    root.render(<AutoMinerPanel state={state} dispatch={dispatch} />);
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

describe("AutoMinerPanel module slot", () => {
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
      assetId: MINER_ID,
    });
  });

  it("dispatches REMOVE_MODULE for the equipped module", () => {
    const dispatch = jest.fn<void, [GameAction]>();
    const state = buildState({
      assetOverrides: { moduleSlot: "module-1" },
      modules: [makeModule({ id: "module-1", equippedTo: MINER_ID })],
    });
    renderPanel(state, dispatch);

    const button = getButton("Herausnehmen");
    expect(button).not.toBeNull();
    clickButton(button!);

    expect(dispatch).toHaveBeenCalledWith({
      type: "REMOVE_MODULE",
      moduleId: "module-1",
    });
  });

  it("switches from insert to remove after equipping and shows name and tier", () => {
    let state = buildState({ modules: [makeModule({ id: "module-1" })] });
    const dispatch = jest.fn<void, [GameAction]>();
    renderPanel(state, dispatch);

    const insertButton = getButton("Einsetzen");
    expect(insertButton).not.toBeNull();
    clickButton(insertButton!);

    const action = dispatch.mock.calls[0][0];
    state = gameReducer(state, action);
    renderPanel(state, dispatch);

    expect(getButton("Herausnehmen")).not.toBeNull();
    expect(container.textContent).toContain("Miner-Boost Tier 1");
    expect(container.textContent).toContain("T1");
  });
});
