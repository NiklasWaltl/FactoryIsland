import type { GameAction } from "../game-actions";
import { addErrorNotification } from "../utils/notifications";
import type { BoundedContext, NotificationsContextState } from "./types";

export const NOTIFICATIONS_HANDLED_ACTION_TYPES = [
  "EXPIRE_NOTIFICATIONS",
  "ADD_ERROR_NOTIFICATION",
] as const satisfies readonly GameAction["type"][];

type NotificationsActionType =
  (typeof NOTIFICATIONS_HANDLED_ACTION_TYPES)[number];
type NotificationsAction = Extract<
  GameAction,
  { type: NotificationsActionType }
>;

const NOTIFICATIONS_ACTION_TYPE_SET: ReadonlySet<GameAction["type"]> = new Set(
  NOTIFICATIONS_HANDLED_ACTION_TYPES,
);

function isNotificationsAction(
  action: GameAction,
): action is NotificationsAction {
  return NOTIFICATIONS_ACTION_TYPE_SET.has(action.type);
}

function reduceNotifications(
  state: NotificationsContextState,
  action: NotificationsAction,
): NotificationsContextState {
  const actionType = action.type;

  switch (actionType) {
    case "EXPIRE_NOTIFICATIONS": {
      const now = Date.now();
      const alive = state.notifications.filter((n) => n.expiresAt > now);
      if (alive.length === state.notifications.length) return state;
      return { ...state, notifications: alive };
    }

    case "ADD_ERROR_NOTIFICATION": {
      const next: NotificationsContextState = {
        ...state,
        notifications: addErrorNotification(
          state.notifications,
          action.message,
        ),
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

    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

export const notificationsContext: BoundedContext<NotificationsContextState> = {
  reduce(state, action) {
    if (!isNotificationsAction(action)) return null;
    return reduceNotifications(state, action);
  },
  handledActionTypes: NOTIFICATIONS_HANDLED_ACTION_TYPES,
};
