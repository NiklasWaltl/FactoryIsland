// ============================================================
// CP2: Save/Load continuity across Save v25
// ------------------------------------------------------------
// Verifies:
//   1. A v25 save (no moduleLabJob field) migrates to v26 cleanly.
//   2. Starting a craft, serialising, and reloading preserves the
//      active job (recipeId, startedAt).
//   3. After reload the job can be ticked to "done" and collected
//      exactly once.
// ============================================================

import {
  migrateSave,
  serializeState,
  deserializeState,
  CURRENT_SAVE_VERSION,
  type SaveGameLatest,
} from "../save";
import {
  createInitialState,
  gameReducer,
  type GameState,
  type GameAction,
} from "../../store/reducer";
import { MODULE_FRAGMENT_RECIPES } from "../../constants/moduleLabConstants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tick(state: GameState, action: GameAction): GameState {
  return gameReducer(state, action);
}

function withFragments(state: GameState, count: number): GameState {
  return { ...state, moduleFragments: count };
}

/**
 * Build a minimal v25-shaped save from a fresh initial state.
 * V25 has moduleFragments (number) but NO moduleLabJob field.
 */
function makeV25Save(overrides: Partial<Record<string, unknown>> = {}): unknown {
  const base = createInitialState("release");
  const v26 = serializeState(base) as unknown as Record<string, unknown>;

  // Strip moduleLabJob (it only exists in v26+)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { moduleLabJob: _dropped, ...v25Body } = v26;

  return {
    ...v25Body,
    version: 25,
    moduleFragments: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Save v25 → v26 migration", () => {
  it("migrates a v25 save to v26 and sets moduleLabJob to null", () => {
    const raw = makeV25Save();
    const migrated = migrateSave(raw) as SaveGameLatest;

    expect(migrated).not.toBeNull();
    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.moduleLabJob).toBeNull();
  });

  it("preserves moduleFragments across migration", () => {
    const raw = makeV25Save({ moduleFragments: 7 });
    const migrated = migrateSave(raw) as SaveGameLatest;

    expect(migrated.moduleFragments).toBe(7);
  });
});

describe("craft job save/load continuity (v25 → current)", () => {
  const tier1 = MODULE_FRAGMENT_RECIPES.find((r) => r.id === "module_tier1")!;

  it("persists an active craft job across a save/load cycle", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(5_000_000);

    try {
      // 1. Load from a v25 save
      const s0 = deserializeState(
        migrateSave(makeV25Save({ moduleFragments: 10 })) as SaveGameLatest,
      );

      // 2. Start a craft
      const s1 = tick(s0, {
        type: "START_MODULE_CRAFT",
        recipeId: tier1.id,
      });
      expect(s1.moduleLabJob).not.toBeNull();
      expect(s1.moduleLabJob!.recipeId).toBe(tier1.id);
      const startedAt = s1.moduleLabJob!.startedAt;

      // 3. Serialise → reload
      const saved = serializeState(s1);
      const s2 = deserializeState(saved);

      expect(s2.moduleLabJob).not.toBeNull();
      expect(s2.moduleLabJob!.recipeId).toBe(tier1.id);
      expect(s2.moduleLabJob!.startedAt).toBe(startedAt);
      expect(s2.moduleLabJob!.status).toBe("crafting");
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("allows Collect exactly once after the job completes post-reload", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(6_000_000);

    try {
      const s0 = deserializeState(
        migrateSave(makeV25Save({ moduleFragments: 10 })) as SaveGameLatest,
      );
      const s1 = tick(s0, { type: "START_MODULE_CRAFT", recipeId: tier1.id });

      // Save and reload while still crafting
      const s2 = deserializeState(serializeState(s1));

      // Advance time past duration to mark job done
      fakeNow.mockReturnValue(6_000_000 + tier1.durationMs + 1);
      const s3 = tick(s2, { type: "MODULE_LAB_TICK" });
      expect(s3.moduleLabJob!.status).toBe("done");

      // First collect succeeds
      const s4 = tick(s3, { type: "COLLECT_MODULE" });
      expect(s4.moduleLabJob).toBeNull();
      expect(s4.moduleInventory.length).toBe(1);
      expect(s4.moduleInventory[0].tier).toBe(tier1.outputTier);

      // Second collect is a no-op (moduleLabJob is already null)
      const s5 = tick(s4, { type: "COLLECT_MODULE" });
      expect(s5.moduleLabJob).toBeNull();
      expect(s5.moduleInventory.length).toBe(1);
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("a done job reloaded from a saved state still shows status=done", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(7_000_000);

    try {
      const s0 = deserializeState(
        migrateSave(makeV25Save({ moduleFragments: 10 })) as SaveGameLatest,
      );
      const s1 = tick(s0, { type: "START_MODULE_CRAFT", recipeId: tier1.id });

      // Tick to done, then serialise
      fakeNow.mockReturnValue(7_000_000 + tier1.durationMs + 1);
      const s2 = tick(s1, { type: "MODULE_LAB_TICK" });
      const s3 = deserializeState(serializeState(s2));

      expect(s3.moduleLabJob!.status).toBe("done");
    } finally {
      fakeNow.mockRestore();
    }
  });
});
