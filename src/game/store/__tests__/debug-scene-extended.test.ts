import { buildSceneState } from "../../dev/scene-builder/build-scene-state";
import { debugSceneLayout } from "../../dev/scenes/debug-scene.layout";
import { createInitialState } from "../initial-state";
import { gameReducer } from "../reducer";
import type { GameState } from "../types";

function buildDebugSceneState(): GameState {
  return buildSceneState(debugSceneLayout, createInitialState("debug"));
}

function assertNoNegativeInventory(state: GameState): void {
  for (const value of Object.values(state.inventory)) {
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
  }
}

function assertValidGameState(state: GameState): void {
  expect(state).toBeDefined();
  expect(state.assets).toBeDefined();
  expect(state.cellMap).toBeDefined();

  for (const assetId of Object.values(state.cellMap)) {
    expect(state.assets[assetId]).toBeDefined();
  }

  for (const warehouse of Object.values(state.assets).filter(
    (asset) => asset.type === "warehouse",
  )) {
    expect(state.warehouseInventories[warehouse.id]).toBeDefined();
  }

  assertNoNegativeInventory(state);
}

describe("Debug scene smoke tests", () => {
  it("starts without errors and produces a valid GameState", () => {
    let state: GameState | undefined;

    expect(() => {
      state = buildDebugSceneState();
    }).not.toThrow();

    assertValidGameState(state as GameState);
  });

  it("contains at least one conveyor and one warehouse", () => {
    const state = buildDebugSceneState();

    const conveyorCount = Object.values(state.assets).filter(
      (asset) => asset.type === "conveyor",
    ).length;
    const warehouseCount = Object.values(state.assets).filter(
      (asset) => asset.type === "warehouse",
    ).length;

    expect(conveyorCount).toBeGreaterThan(0);
    expect(warehouseCount).toBeGreaterThan(0);
  });

  it("runs a tick without exception or negative inventory values", () => {
    let state = buildDebugSceneState();

    expect(() => {
      state = gameReducer(state, { type: "LOGISTICS_TICK" });
    }).not.toThrow();

    assertNoNegativeInventory(state);
  });
});
