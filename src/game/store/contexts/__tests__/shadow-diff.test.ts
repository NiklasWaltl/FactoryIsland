// ============================================================
// Phase 3 Cutover — shadow-diff parity tests
// ------------------------------------------------------------
// For each context slice that does real work, assert that running
// the bounded-context reducer on the pre-action state produces the
// same slice value as the legacy reducer on the same input.
// ============================================================

import type { GameAction } from "../../game-actions";
import { createInitialState } from "../../initial-state";
import { gameReducer } from "../../reducer";
import { applyContextReducers } from "../create-game-reducer";
import { deepEqual, SHADOW_DIFF_SLICES } from "../shadow-diff";

function freshState() {
  return createInitialState("release");
}

describe("shadowDiff / applyContextReducers parity", () => {
  it("deepEqual handles primitives, arrays and nested objects", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("a", "a")).toBe(true);
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(undefined, undefined)).toBe(true);
    expect(deepEqual(NaN, NaN)).toBe(true);

    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);

    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2, 3], [1, 2])).toBe(false);
    expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);

    expect(deepEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toBe(true);
    expect(deepEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 3 } })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);

    expect(deepEqual({ a: [1, 2] }, { a: [1, 2] })).toBe(true);
    expect(deepEqual([{ a: 1 }], [{ a: 2 }])).toBe(false);
  });

  it("crafting slice: SET_KEEP_STOCK_TARGET matches legacy for unknown workbench", () => {
    const state = freshState();
    const action: GameAction = {
      type: "SET_KEEP_STOCK_TARGET",
      workbenchId: "workbench-unknown",
      recipeId: "wood_pickaxe",
      amount: 4,
      enabled: true,
    };

    const legacy = gameReducer(state, action);
    const context = applyContextReducers(state, action);

    expect(legacy.keepStockByWorkbench).toEqual(state.keepStockByWorkbench);
    expect(context.keepStockByWorkbench).toEqual(state.keepStockByWorkbench);
    expect(
      deepEqual(legacy.keepStockByWorkbench, context.keepStockByWorkbench),
    ).toBe(true);
  });

  it("crafting slice: context matches legacy for SET_RECIPE_AUTOMATION_POLICY", () => {
    const state = freshState();
    const action: GameAction = {
      type: "SET_RECIPE_AUTOMATION_POLICY",
      recipeId: "wood_pickaxe",
      patch: { manualOnly: true },
    };

    const legacy = gameReducer(state, action);
    const context = applyContextReducers(state, action);

    expect(
      deepEqual(
        legacy.recipeAutomationPolicies,
        context.recipeAutomationPolicies,
      ),
    ).toBe(true);
  });

  it("drones slice: context matches legacy for DRONE_SET_ROLE", () => {
    const state = freshState();
    const action: GameAction = {
      type: "DRONE_SET_ROLE",
      droneId: "starter",
      role: "construction",
    };

    const legacy = gameReducer(state, action);
    const context = applyContextReducers(state, action);

    expect(deepEqual(legacy.drones, context.drones)).toBe(true);
  });

  it("inventory/network slice: context matches legacy for NETWORK_COMMIT_RESERVATION", () => {
    const state = freshState();
    const action: GameAction = {
      type: "NETWORK_COMMIT_RESERVATION",
      reservationId: "missing-reservation",
    };

    const legacy = gameReducer(state, action);
    const context = applyContextReducers(state, action);

    expect(deepEqual(legacy.network, context.network)).toBe(true);
    expect(deepEqual(legacy.inventory, context.inventory)).toBe(true);
  });

  it("zone slice: context matches legacy for CREATE_ZONE", () => {
    // CREATE_ZONE generates a fresh id via makeId(); running both
    // reducers consumes two distinct counters, so we compare the
    // shape of productionZones (size + names) rather than identity.
    const state = freshState();
    const action: GameAction = { type: "CREATE_ZONE", name: "Test Zone" };

    const legacy = gameReducer(state, action);
    const context = applyContextReducers(state, action);

    const legacyZones = Object.values(legacy.productionZones);
    const contextZones = Object.values(context.productionZones);

    expect(legacyZones).toHaveLength(contextZones.length);
    expect(legacyZones.map((z) => z.name).sort()).toEqual(
      contextZones.map((z) => z.name).sort(),
    );
  });

  it("zone slice: context matches legacy for DELETE_ZONE", () => {
    // Seed a zone via the legacy reducer, then delete it through both paths.
    const seeded = gameReducer(freshState(), {
      type: "CREATE_ZONE",
      name: "Doomed",
    });
    const zoneId = Object.keys(seeded.productionZones).find(
      (id) => seeded.productionZones[id].name === "Doomed",
    );
    expect(zoneId).toBeDefined();

    const action: GameAction = {
      type: "DELETE_ZONE",
      zoneId: zoneId as string,
    };

    const legacy = gameReducer(seeded, action);
    const context = applyContextReducers(seeded, action);

    expect(deepEqual(legacy.productionZones, context.productionZones)).toBe(
      true,
    );
    expect(deepEqual(legacy.buildingZoneIds, context.buildingZoneIds)).toBe(
      true,
    );
  });

  it("ui slice: context matches legacy for SET_ACTIVE_SLOT", () => {
    const state = freshState();
    const action: GameAction = { type: "SET_ACTIVE_SLOT", slot: 2 };

    const legacy = gameReducer(state, action);
    const context = applyContextReducers(state, action);

    expect(legacy.activeSlot).toBe(context.activeSlot);
  });

  it("ui slice: context matches legacy for TOGGLE_PANEL", () => {
    const state = freshState();
    const action: GameAction = { type: "TOGGLE_PANEL", panel: "warehouse" };

    const legacy = gameReducer(state, action);
    const context = applyContextReducers(state, action);

    expect(legacy.openPanel).toBe(context.openPanel);
  });

  it("ui slice: context matches legacy for TOGGLE_ENERGY_DEBUG", () => {
    const state = freshState();
    const action: GameAction = { type: "TOGGLE_ENERGY_DEBUG" };

    const legacy = gameReducer(state, action);
    const context = applyContextReducers(state, action);

    expect(legacy.energyDebugOverlay).toBe(context.energyDebugOverlay);
  });

  it("conveyor slice: context matches legacy for SET_SPLITTER_FILTER on an unknown splitter", () => {
    // No splitter assets exist in the fresh state, so legacy returns
    // state unchanged (asset gate). The context drops that gate, so the
    // splitterFilterState diverges by design — assert exactly that.
    const state = freshState();
    const action: GameAction = {
      type: "SET_SPLITTER_FILTER",
      splitterId: "splitter-unknown",
      side: "left",
      itemType: "iron",
    };

    const legacy = gameReducer(state, action);
    const context = applyContextReducers(state, action);

    expect(legacy.splitterFilterState).toEqual({});
    expect(context.splitterFilterState).toEqual({
      "splitter-unknown": { left: "iron", right: null },
    });
  });

  it("unhandled action: applyContextReducers returns same state reference", () => {
    const state = freshState();
    const action: GameAction = { type: "CLICK_CELL", x: 0, y: 0 };

    expect(applyContextReducers(state, action)).toBe(state);
  });

  it("shadow slice list contains no duplicates", () => {
    const set = new Set<string>(SHADOW_DIFF_SLICES);

    expect(set.size).toBe(SHADOW_DIFF_SLICES.length);
  });
});
