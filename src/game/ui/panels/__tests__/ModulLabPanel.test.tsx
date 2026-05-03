// ============================================================
// CP3: ModuleLabPanel UI edge cases
// ============================================================

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createInitialState, gameReducer, type GameAction, type GameState } from "../../../store/reducer";
import { MODULE_FRAGMENT_RECIPES } from "../../../constants/moduleLabConstants";
import { ModulLabPanel } from "../ModulLabPanel";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const tier1 = MODULE_FRAGMENT_RECIPES.find((r) => r.id === "module_tier1")!;

function withFragments(state: GameState, count: number): GameState {
  return { ...state, moduleFragments: count };
}

function dispatch(state: GameState, action: GameAction): GameState {
  return gameReducer(state, action);
}

// ---------------------------------------------------------------------------
// DOM test helpers
// ---------------------------------------------------------------------------

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

function render(ui: React.ReactElement): void {
  act(() => {
    root.render(ui);
  });
}

function getButton(label: RegExp | string): HTMLButtonElement | null {
  const buttons = Array.from(container.querySelectorAll("button"));
  return (
    (buttons.find((b) =>
      typeof label === "string"
        ? b.textContent?.includes(label)
        : label.test(b.textContent ?? ""),
    ) as HTMLButtonElement | undefined) ?? null
  );
}

// ---------------------------------------------------------------------------
// 3d: Button state transitions: Start → Complete → Collect → idle
// ---------------------------------------------------------------------------

describe("ModulLabPanel — 3d button state transitions", () => {
  it("Craft button is disabled while a job is active", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(1_000_000);

    try {
      let state = withFragments(createInitialState("release"), 10);
      state = dispatch(state, {
        type: "START_MODULE_CRAFT",
        recipeId: tier1.id,
      });

      // Switch to fragments tab to see the craft buttons
      let renderedState = state;
      render(
        <ModulLabPanel
          state={renderedState}
          dispatch={(a) => {
            renderedState = dispatch(renderedState, a);
          }}
        />,
      );

      // Click the "Fragmente" tab
      const fragTab = getButton("Fragmente");
      act(() => {
        fragTab?.click();
      });

      // All Craften buttons should be disabled (job active)
      const craftButtons = Array.from(
        container.querySelectorAll("button"),
      ).filter((b) => b.textContent?.includes("Craften"));
      expect(craftButtons.length).toBeGreaterThan(0);
      craftButtons.forEach((b) => {
        expect((b as HTMLButtonElement).disabled).toBe(true);
      });
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("Collect button is visible when job is done", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(2_000_000);

    try {
      let state = withFragments(createInitialState("release"), 10);
      state = dispatch(state, {
        type: "START_MODULE_CRAFT",
        recipeId: tier1.id,
      });

      // Advance time past duration
      fakeNow.mockReturnValue(2_000_000 + tier1.durationMs + 1);
      state = dispatch(state, { type: "MODULE_LAB_TICK" });
      expect(state.moduleLabJob?.status).toBe("done");

      render(
        <ModulLabPanel
          state={state}
          dispatch={(a) => {
            state = dispatch(state, a);
          }}
        />,
      );

      // Click the "Aktiver Job" tab
      const jobTab = getButton("Aktiver Job");
      act(() => {
        jobTab?.click();
      });

      const collectBtn = getButton(/Modul einsammeln/);
      expect(collectBtn).not.toBeNull();
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("full cycle: Start → MODULE_LAB_TICK → Collect → idle (no double-collect)", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(3_000_000);

    try {
      let state = withFragments(createInitialState("release"), 10);

      // Capture dispatches
      const dispatched: GameAction[] = [];
      const testDispatch = (a: GameAction) => {
        dispatched.push(a);
        state = dispatch(state, a);
        // Re-render with updated state
        render(
          <ModulLabPanel state={state} dispatch={testDispatch} />,
        );
      };

      // Render initially (fragments tab)
      render(<ModulLabPanel state={state} dispatch={testDispatch} />);

      // Switch to fragments tab and click first Craften button
      act(() => {
        getButton("Fragmente")?.click();
      });

      const craftBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Craften"),
      ) as HTMLButtonElement | undefined;
      expect(craftBtn).toBeDefined();

      act(() => {
        craftBtn?.click();
      });

      expect(dispatched.some((a) => a.type === "START_MODULE_CRAFT")).toBe(true);
      expect(state.moduleLabJob).not.toBeNull();

      // Advance time past duration and tick
      fakeNow.mockReturnValue(3_000_000 + tier1.durationMs + 1);
      state = dispatch(state, { type: "MODULE_LAB_TICK" });
      expect(state.moduleLabJob?.status).toBe("done");

      // Re-render with done state, switch to Job tab
      render(<ModulLabPanel state={state} dispatch={testDispatch} />);
      act(() => {
        getButton("Aktiver Job")?.click();
      });

      const collectBtn = getButton(/Modul einsammeln/);
      expect(collectBtn).not.toBeNull();

      // First click — collects the module
      act(() => {
        collectBtn?.click();
      });

      expect(state.moduleLabJob).toBeNull();
      expect(state.moduleInventory.length).toBe(1);

      // After collect, job tab should show "no active job" message
      render(<ModulLabPanel state={state} dispatch={testDispatch} />);
      act(() => {
        getButton("Aktiver Job")?.click();
      });

      const noJobMsg = container.textContent?.includes("Kein aktiver Job");
      expect(noJobMsg).toBe(true);
      // Collect button must be gone
      expect(getButton(/Modul einsammeln/)).toBeNull();
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("3c: re-opening panel with active job shows job state (not blank)", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(4_000_000);

    try {
      let state = withFragments(createInitialState("release"), 10);
      state = dispatch(state, {
        type: "START_MODULE_CRAFT",
        recipeId: tier1.id,
      });

      // First render (simulates opening the panel)
      render(
        <ModulLabPanel
          state={state}
          dispatch={(a) => {
            state = dispatch(state, a);
          }}
        />,
      );
      act(() => {
        getButton("Aktiver Job")?.click();
      });
      expect(container.textContent).toMatch(/wird gecraftet/);

      // "Close" by unmounting and remounting (simulates building panel close/reopen)
      act(() => {
        root.unmount();
      });
      root = createRoot(container);
      render(
        <ModulLabPanel
          state={state}
          dispatch={(a) => {
            state = dispatch(state, a);
          }}
        />,
      );
      act(() => {
        getButton("Aktiver Job")?.click();
      });

      // Job must still be visible
      expect(container.textContent).toMatch(/wird gecraftet/);
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("3c: re-opening panel with done job shows Collect button immediately", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(5_000_000);

    try {
      let state = withFragments(createInitialState("release"), 10);
      state = dispatch(state, {
        type: "START_MODULE_CRAFT",
        recipeId: tier1.id,
      });

      // Tick to done
      fakeNow.mockReturnValue(5_000_000 + tier1.durationMs + 1);
      state = dispatch(state, { type: "MODULE_LAB_TICK" });

      // Simulate reopening the panel (fresh mount)
      act(() => {
        root.unmount();
      });
      root = createRoot(container);
      render(
        <ModulLabPanel
          state={state}
          dispatch={(a) => {
            state = dispatch(state, a);
          }}
        />,
      );
      act(() => {
        getButton("Aktiver Job")?.click();
      });

      expect(getButton(/Modul einsammeln/)).not.toBeNull();
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("3b: countdown derives from completesAt-Date.now, not reset on tab switch", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(6_000_000);

    try {
      let state = withFragments(createInitialState("release"), 10);
      state = dispatch(state, {
        type: "START_MODULE_CRAFT",
        recipeId: tier1.id,
      });

      const disp = (a: GameAction) => {
        state = dispatch(state, a);
      };

      render(<ModulLabPanel state={state} dispatch={disp} />);

      // Go to job tab and read initial countdown
      act(() => {
        getButton("Aktiver Job")?.click();
      });
      const firstCountdown = container.textContent?.match(/(\d+)s verbleibend/)?.[1];
      expect(firstCountdown).toBeDefined();
      const firstSecs = Number(firstCountdown);

      // Switch away (simulates tab switch)
      act(() => {
        getButton("Fragmente")?.click();
      });

      // 2 seconds elapse; re-render with same state but new Date.now()
      fakeNow.mockReturnValue(6_000_000 + 2_000);
      render(<ModulLabPanel state={state} dispatch={disp} />);

      // Switch back to job tab
      act(() => {
        getButton("Aktiver Job")?.click();
      });

      const secondCountdown = container.textContent?.match(/(\d+)s verbleibend/)?.[1];
      const secondSecs = Number(secondCountdown);

      // Countdown must reflect actual elapsed time — at least 1s less
      expect(secondSecs).toBeLessThanOrEqual(firstSecs - 1);
    } finally {
      fakeNow.mockRestore();
    }
  });
});
