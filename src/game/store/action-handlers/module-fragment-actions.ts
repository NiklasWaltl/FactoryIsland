import type { GameAction } from "../game-actions";
import type { GameState } from "../types";
import { collectDockWarehouseFragment } from "../helpers/module-fragments";

export function handleModuleFragmentAction(
  state: GameState,
  action: GameAction,
): GameState | null {
  switch (action.type) {
    case "COLLECT_FRAGMENT":
      return collectDockWarehouseFragment(state);

    default:
      return null;
  }
}
