import type { GameAction } from "../game-actions";
import type { GameState } from "../types";
import {
  addModuleFragmentCount,
  isFragmentTier,
} from "../helpers/module-fragments";

export function handleModuleFragmentAction(
  state: GameState,
  action: GameAction,
): GameState | null {
  switch (action.type) {
    case "ADD_MODULE_FRAGMENT": {
      const { tier } = action.payload;
      if (!isFragmentTier(tier)) return state;

      return {
        ...state,
        moduleFragments: addModuleFragmentCount(state.moduleFragments, tier),
      };
    }

    default:
      return null;
  }
}
