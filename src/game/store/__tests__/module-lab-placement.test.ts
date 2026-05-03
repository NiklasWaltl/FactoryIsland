// ============================================================
// CP1: Non-stackable placement guard for module_lab
// ------------------------------------------------------------
// Verifies the guard lives at the reducer/state layer, not
// only in the UI.  A second BUILD_PLACE_BUILDING for module_lab
// must leave the game world unchanged (no new asset, no resource
// deduction) and must set an error notification.
// ============================================================

import {
  gameReducer,
  createInitialState,
  type GameState,
  type GameAction,
} from "../reducer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Add enough resources to build a module_lab (wood:10, stone:15, iron:8). */
function withBuildResources(state: GameState): GameState {
  return {
    ...state,
    inventory: {
      ...state.inventory,
      wood: 999,
      stone: 999,
      iron: 999,
    },
  };
}

/** Enable build mode with module_lab selected. */
function withBuildMode(state: GameState): GameState {
  return {
    ...state,
    buildMode: true,
    selectedBuildingType: "module_lab",
  };
}

function placeBuilding(
  state: GameState,
  pos: { x: number; y: number },
): GameState {
  const action: GameAction = {
    type: "BUILD_PLACE_BUILDING",
    x: pos.x,
    y: pos.y,
  };
  return gameReducer(state, action);
}

/**
 * Returns the most recent error notification's displayName,
 * or null if there is none.
 */
function getPlacementError(state: GameState): string | null {
  const errorNotif = [...state.notifications]
    .reverse()
    .find((n) => n.kind === "error");
  return errorNotif?.displayName ?? null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("module_lab non-stackable placement guard", () => {
  // Find a pair of playable grass cells that don't collide with the
  // fixed base-start assets.  (20,20) is reliably grass in the seeded map.
  const POS1 = { x: 20, y: 20 };
  const POS2 = { x: 30, y: 20 };

  it("allows the first module_lab placement", () => {
    const base = withBuildMode(withBuildResources(createInitialState("release")));
    const after = placeBuilding(base, POS1);

    expect(after.placedBuildings.filter((b) => b === "module_lab").length).toBe(
      1,
    );
  });

  it("rejects a second module_lab placement — state unchanged beyond notification", () => {
    const base = withBuildMode(withBuildResources(createInitialState("release")));
    const state1 = placeBuilding(base, POS1);
    const assetsBefore = { ...state1.assets };
    const inventoryBefore = { ...state1.inventory };

    const state2 = placeBuilding(state1, POS2);

    // World state must not grow
    expect(state2.placedBuildings.filter((b) => b === "module_lab").length).toBe(
      1,
    );
    expect(Object.keys(state2.assets)).toEqual(Object.keys(assetsBefore));
    // Resources must not be deducted again
    expect(state2.inventory.wood).toBe(inventoryBefore.wood);
    expect(state2.inventory.stone).toBe(inventoryBefore.stone);
    expect(state2.inventory.iron).toBe(inventoryBefore.iron);
  });

  it("sets an error notification when second placement is rejected", () => {
    const base = withBuildMode(withBuildResources(createInitialState("release")));
    const state1 = placeBuilding(base, POS1);
    const state2 = placeBuilding(state1, POS2);

    // Guard surfaces as an error notification (the "NON_STACKABLE" signal)
    const err = getPlacementError(state2);
    expect(err).not.toBeNull();
    // Message contains the German building label ("Modul-Labor")
    expect(err).toMatch(/Modul-Labor/);
  });
});
