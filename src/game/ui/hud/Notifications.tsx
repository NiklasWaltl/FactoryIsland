import React from "react";
import type { GameNotification } from "../../store/types";
import { RESOURCE_EMOJIS } from "../../store/constants/resources";

interface NotificationsProps {
  notifications: GameNotification[];
}

export const Notifications: React.FC<NotificationsProps> = React.memo(
  ({ notifications }) => {
    const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(
      () => new Set(),
    );

    React.useEffect(() => {
      setDismissedIds((previous) => {
        const liveIds = new Set(notifications.map((n) => n.id));
        const next = new Set([...previous].filter((id) => liveIds.has(id)));
        return next.size === previous.size ? previous : next;
      });
    }, [notifications]);

    const visibleNotifications = React.useMemo(
      () => notifications.filter((n) => !dismissedIds.has(n.id)),
      [notifications, dismissedIds],
    );

    const dismiss = React.useCallback((id: string) => {
      setDismissedIds((previous) => {
        if (previous.has(id)) return previous;
        const next = new Set(previous);
        next.add(id);
        return next;
      });
    }, []);

    if (visibleNotifications.length === 0) return null;

    return (
      <div className="fi-notifications">
        {visibleNotifications.map((n) => (
          <div
            key={n.id}
            className={`fi-notification ${n.kind === "error" ? "fi-notification--error" : ""}`}
          >
            <span className="fi-notification-emoji">
              {n.kind === "error"
                ? "⚠️"
                : (RESOURCE_EMOJIS[n.resource] ?? "📦")}
            </span>
            <span>
              {n.kind === "error"
                ? n.displayName
                : `+${n.amount} ${n.displayName}`}
            </span>
            {n.kind === "error" && (
              <button
                type="button"
                className="fi-notification-dismiss"
                onClick={() => dismiss(n.id)}
                aria-label="Meldung schließen"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    );
  },
);

Notifications.displayName = "Notifications";
