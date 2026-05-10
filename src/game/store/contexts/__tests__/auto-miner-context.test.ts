import type { GameAction } from "../../game-actions";
import type { AutoMinerContextState } from "../types";
import {
  AUTO_MINER_HANDLED_ACTION_TYPES,
  autoMinerContext,
} from "../auto-miner-context";

function createAutoMinerState(): AutoMinerContextState {
  return {
    autoMiners: {
      "miner-1": {
        depositId: "deposit-1",
        resource: "iron",
        progress: 3,
      },
    },
  } satisfies AutoMinerContextState;
}

describe("autoMinerContext", () => {
  describe("reduce", () => {
    it("returns null for unrelated actions", () => {
      const state = createAutoMinerState();
      const action = { type: "DRONE_TICK" } satisfies GameAction;

      expect(autoMinerContext.reduce(state, action)).toBeNull();
    });

    it("LOGISTICS_TICK keeps the auto-miner slice unchanged during Phase 1", () => {
      const state = createAutoMinerState();
      const action = { type: "LOGISTICS_TICK" } satisfies GameAction;

      expect(autoMinerContext.reduce(state, action)).toBe(state);
    });
  });

  describe("handledActionTypes", () => {
    it("contains no duplicates", () => {
      const uniqueTypes = new Set(autoMinerContext.handledActionTypes);

      expect(uniqueTypes.size).toBe(autoMinerContext.handledActionTypes.length);
    });

    it("all listed types are valid GameAction type strings", () => {
      const validTypes =
        AUTO_MINER_HANDLED_ACTION_TYPES satisfies readonly GameAction["type"][];

      expect(autoMinerContext.handledActionTypes).toEqual(validTypes);
    });
  });
});
