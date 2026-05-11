import type { GameAction } from "../../game-actions";
import type { ConveyorContextState } from "../types";
import {
  CONVEYOR_HANDLED_ACTION_TYPES,
  conveyorContext,
} from "../conveyor-context";

function createConveyorState(): ConveyorContextState {
  return {
    conveyors: {},
    splitterFilterState: {},
  } satisfies ConveyorContextState;
}

function expectHandled(
  result: ConveyorContextState | null,
): ConveyorContextState {
  expect(result).not.toBeNull();
  if (result === null) throw new Error("Expected conveyor action handled");
  return result;
}

describe("conveyorContext", () => {
  describe("reduce", () => {
    it("returns null for unrelated actions", () => {
      const state = createConveyorState();
      const action = { type: "DRONE_TICK" } satisfies GameAction;

      expect(conveyorContext.reduce(state, action)).toBeNull();
    });

    it("SET_SPLITTER_FILTER stores a per-side filter for the splitter", () => {
      const state = createConveyorState();
      const action = {
        type: "SET_SPLITTER_FILTER",
        splitterId: "splitter-1",
        side: "left",
        itemType: "iron",
      } satisfies GameAction;

      const result = expectHandled(conveyorContext.reduce(state, action));

      expect(result.splitterFilterState["splitter-1"]).toEqual({
        left: "iron",
        right: null,
      });
    });

    it("SET_SPLITTER_FILTER is a no-op when the filter is unchanged", () => {
      const state: ConveyorContextState = {
        conveyors: {},
        splitterFilterState: {
          "splitter-1": { left: "iron", right: null },
        },
      };
      const action = {
        type: "SET_SPLITTER_FILTER",
        splitterId: "splitter-1",
        side: "left",
        itemType: "iron",
      } satisfies GameAction;

      expect(conveyorContext.reduce(state, action)).toBe(state);
    });

    it("SET_SPLITTER_FILTER can clear an existing filter", () => {
      const state: ConveyorContextState = {
        conveyors: {},
        splitterFilterState: {
          "splitter-1": { left: "iron", right: null },
        },
      };
      const action = {
        type: "SET_SPLITTER_FILTER",
        splitterId: "splitter-1",
        side: "left",
        itemType: null,
      } satisfies GameAction;

      const result = expectHandled(conveyorContext.reduce(state, action));

      expect(result.splitterFilterState["splitter-1"]?.left).toBeNull();
    });

    it("LOGISTICS_TICK keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createConveyorState();
      const action = { type: "LOGISTICS_TICK" } satisfies GameAction;

      expect(conveyorContext.reduce(state, action)).toBe(state);
    });
  });

  describe("handledActionTypes", () => {
    it("contains no duplicates", () => {
      const uniqueTypes = new Set(conveyorContext.handledActionTypes);

      expect(uniqueTypes.size).toBe(conveyorContext.handledActionTypes.length);
    });

    it("all listed types are valid GameAction type strings", () => {
      const validTypes =
        CONVEYOR_HANDLED_ACTION_TYPES satisfies readonly GameAction["type"][];

      expect(conveyorContext.handledActionTypes).toEqual(validTypes);
    });
  });
});
