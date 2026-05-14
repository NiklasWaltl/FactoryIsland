import type { GameAction } from "../game-actions";
import type { AutoMinerContextState, BoundedContext } from "./types";

export const AUTO_MINER_HANDLED_ACTION_TYPES =
  [] as const satisfies readonly GameAction["type"][];

export const autoMinerContext: BoundedContext<AutoMinerContextState> = {
  reduce() {
    return null;
  },
  handledActionTypes: AUTO_MINER_HANDLED_ACTION_TYPES,
};
