import type { GameAction } from "../../game-actions";
import type { NotificationsContextState } from "../types";
import {
  NOTIFICATIONS_HANDLED_ACTION_TYPES,
  notificationsContext,
} from "../notifications-context";

function createNotificationsState(
  overrides: Partial<NotificationsContextState> = {},
): NotificationsContextState {
  return {
    notifications: [],
    ...overrides,
  } satisfies NotificationsContextState;
}

function expectHandled(
  result: NotificationsContextState | null,
): NotificationsContextState {
  expect(result).not.toBeNull();
  if (result === null) throw new Error("Expected notification action handled");
  return result;
}

describe("notificationsContext", () => {
  describe("reduce", () => {
    it("returns null for unrelated actions", () => {
      const state = createNotificationsState();
      const action = { type: "DRONE_TICK" } satisfies GameAction;

      expect(notificationsContext.reduce(state, action)).toBeNull();
    });

    it("EXPIRE_NOTIFICATIONS removes expired notifications", () => {
      const now = Date.now();
      const state = createNotificationsState({
        notifications: [
          {
            id: "expired",
            resource: "wood",
            displayName: "Expired",
            amount: 1,
            expiresAt: now - 1,
          },
          {
            id: "alive",
            resource: "wood",
            displayName: "Alive",
            amount: 1,
            expiresAt: now + 10_000,
          },
        ],
      });
      const action = { type: "EXPIRE_NOTIFICATIONS" } satisfies GameAction;

      const result = expectHandled(notificationsContext.reduce(state, action));

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.id).toBe("alive");
    });

    it("EXPIRE_NOTIFICATIONS keeps the same slice when nothing expired", () => {
      const state = createNotificationsState({
        notifications: [
          {
            id: "alive",
            resource: "wood",
            displayName: "Alive",
            amount: 1,
            expiresAt: Date.now() + 10_000,
          },
        ],
      });
      const action = { type: "EXPIRE_NOTIFICATIONS" } satisfies GameAction;

      expect(notificationsContext.reduce(state, action)).toBe(state);
    });

    it("ADD_ERROR_NOTIFICATION adds an error notification", () => {
      const state = createNotificationsState();
      const action = {
        type: "ADD_ERROR_NOTIFICATION",
        message: "Something failed",
      } satisfies GameAction;

      const result = expectHandled(notificationsContext.reduce(state, action));

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.resource).toBe("error");
      expect(result.lastTickError).toBeUndefined();
    });

    it("ADD_ERROR_NOTIFICATION records lastTickError when source data is present", () => {
      const state = createNotificationsState();
      const action = {
        type: "ADD_ERROR_NOTIFICATION",
        message: "Tick failed",
        sourceAction: "LOGISTICS_TICK",
        tick: 12,
      } satisfies GameAction;

      const result = expectHandled(notificationsContext.reduce(state, action));

      expect(result.notifications.length).toBeGreaterThan(0);
      expect(result.lastTickError).toEqual({
        action: "LOGISTICS_TICK",
        message: "Tick failed",
        tick: 12,
      });
    });
  });

  describe("handledActionTypes", () => {
    it("contains no duplicates", () => {
      const uniqueTypes = new Set(notificationsContext.handledActionTypes);

      expect(uniqueTypes.size).toBe(
        notificationsContext.handledActionTypes.length,
      );
    });

    it("all listed types are valid GameAction type strings", () => {
      const validTypes =
        NOTIFICATIONS_HANDLED_ACTION_TYPES satisfies readonly GameAction["type"][];

      expect(notificationsContext.handledActionTypes).toEqual(validTypes);
    });
  });
});
