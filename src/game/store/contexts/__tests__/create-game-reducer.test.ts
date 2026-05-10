import { createInitialState } from "../../initial-state";
import type { GameAction } from "../../game-actions";
import type { GameState } from "../../types";
import { AUTO_MINER_HANDLED_ACTION_TYPES } from "../auto-miner-context";
import {
  applyContextReducers,
  createGameReducer,
} from "../create-game-reducer";
import { CRAFTING_HANDLED_ACTION_TYPES } from "../crafting-context";
import { DRONES_HANDLED_ACTION_TYPES } from "../drones-context";
import { INVENTORY_HANDLED_ACTION_TYPES } from "../inventory-context";

function createState(): GameState {
  return createInitialState("release");
}

describe("applyContextReducers", () => {
  it("returns the same state reference for unhandled actions", () => {
    const state = createState();
    const action = { type: "SET_ACTIVE_SLOT", slot: 1 } satisfies GameAction;

    expect(applyContextReducers(state, action)).toBe(state);
  });

  it("auto-miner context: LOGISTICS_TICK composes without mutating unchanged slices", () => {
    const state = createState();
    const action = { type: "LOGISTICS_TICK" } satisfies GameAction;

    const result = applyContextReducers(state, action);

    expect(result).toBe(state);
    expect(result.autoMiners).toBe(state.autoMiners);
    expect(result.crafting).toBe(state.crafting);
    expect(result.drones).toBe(state.drones);
    expect(result.network).toBe(state.network);
  });

  it("crafting context: SET_KEEP_STOCK_TARGET updates the crafting context slice only", () => {
    const state = createState();
    const action = {
      type: "SET_KEEP_STOCK_TARGET",
      workbenchId: "workbench-1",
      recipeId: "wood_pickaxe",
      amount: 3,
      enabled: true,
    } satisfies GameAction;

    const result = applyContextReducers(state, action);

    expect(result).not.toBe(state);
    expect(result.keepStockByWorkbench).not.toBe(state.keepStockByWorkbench);
    expect(result.keepStockByWorkbench["workbench-1"]).toEqual({
      wood_pickaxe: { enabled: true, amount: 3 },
    });
    expect(result.crafting).toBe(state.crafting);
    expect(result.recipeAutomationPolicies).toBe(
      state.recipeAutomationPolicies,
    );
    expect(result.drones).toBe(state.drones);
    expect(result.inventory).toBe(state.inventory);
    expect(result.network).toBe(state.network);
  });

  it("drones context: DRONE_SET_ROLE updates the drones slice only", () => {
    const state = createState();
    const action = {
      type: "DRONE_SET_ROLE",
      droneId: "starter",
      role: "construction",
    } satisfies GameAction;

    const result = applyContextReducers(state, action);

    expect(result).not.toBe(state);
    expect(result.drones).not.toBe(state.drones);
    expect(result.drones.starter.role).toBe("construction");
    expect(result.crafting).toBe(state.crafting);
    expect(result.keepStockByWorkbench).toBe(state.keepStockByWorkbench);
    expect(result.inventory).toBe(state.inventory);
    expect(result.network).toBe(state.network);
  });

  it("inventory context: NETWORK_COMMIT_RESERVATION updates network state only", () => {
    const state = createState();
    const action = {
      type: "NETWORK_COMMIT_RESERVATION",
      reservationId: "missing-reservation",
    } satisfies GameAction;

    const result = applyContextReducers(state, action);

    expect(result).not.toBe(state);
    expect(result.network).not.toBe(state.network);
    expect(result.network.lastError?.kind).toBe("UNKNOWN_RESERVATION");
    expect(result.inventory).toBe(state.inventory);
    expect(result.crafting).toBe(state.crafting);
    expect(result.keepStockByWorkbench).toBe(state.keepStockByWorkbench);
    expect(result.drones).toBe(state.drones);
  });

  it("createGameReducer composes multiple implemented contexts across dispatches", () => {
    const reducer = createGameReducer();
    const state = createState();

    const withDroneRole = reducer(state, {
      type: "DRONE_SET_ROLE",
      droneId: "starter",
      role: "supply",
    });
    const withKeepStock = reducer(withDroneRole, {
      type: "SET_KEEP_STOCK_TARGET",
      workbenchId: "workbench-1",
      recipeId: "wood_pickaxe",
      amount: 2,
      enabled: true,
    });

    expect(withKeepStock.drones.starter.role).toBe("supply");
    expect(withKeepStock.keepStockByWorkbench["workbench-1"]).toEqual({
      wood_pickaxe: { enabled: true, amount: 2 },
    });
    expect(withKeepStock.inventory).toBe(state.inventory);
    expect(withKeepStock.network).toBe(state.network);
  });

  it("no implemented context action is currently owned by more than one context", () => {
    const handledTypes = [
      ...AUTO_MINER_HANDLED_ACTION_TYPES,
      ...CRAFTING_HANDLED_ACTION_TYPES,
      ...DRONES_HANDLED_ACTION_TYPES,
      ...INVENTORY_HANDLED_ACTION_TYPES,
    ];
    const duplicateTypes = handledTypes.filter(
      (type, index) => handledTypes.indexOf(type) !== index,
    );

    expect(duplicateTypes).toEqual([]);
  });

  it("no context pollutes another context's state slice", () => {
    const state = createState();
    const action = {
      type: "SET_RECIPE_AUTOMATION_POLICY",
      recipeId: "wood_pickaxe",
      patch: { manualOnly: true },
    } satisfies GameAction;

    const result = applyContextReducers(state, action);

    expect(result.recipeAutomationPolicies).not.toBe(
      state.recipeAutomationPolicies,
    );
    expect(result.drones).toBe(state.drones);
    expect(result.inventory).toBe(state.inventory);
    expect(result.network).toBe(state.network);
    expect(result.autoMiners).toBe(state.autoMiners);
  });
});
