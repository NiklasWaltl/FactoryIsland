import type { GameState } from "../../../types";
import type { AddErrorNotificationAction } from "../types";
import { addErrorNotification } from "../../../utils/notifications";

export interface AddErrorNotificationContext {
  state: GameState;
  action: AddErrorNotificationAction;
}

export function runAddErrorNotificationPhase(
  ctx: AddErrorNotificationContext,
): GameState {
  const { state, action } = ctx;
  const next: GameState = {
    ...state,
    notifications: addErrorNotification(state.notifications, action.message),
  };
  if (action.sourceAction !== undefined && action.tick !== undefined) {
    next.lastTickError = {
      action: action.sourceAction,
      message: action.message,
      tick: action.tick,
    };
  }
  return next;
}
