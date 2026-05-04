import React, { useEffect, useState } from "react";
import type { GameState } from "../../store/types";
import type { ShipStatusSlice } from "../../store/types/ui-slice-types";
import { DOCK_WAREHOUSE_ID } from "../../store/bootstrap/apply-dock-warehouse-layout";

interface ShipStatusBarProps {
  state: ShipStatusSlice;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "—";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const ShipStatusBar: React.FC<ShipStatusBarProps> = React.memo(
  ({ state }) => {
    const [, setNowTick] = useState(0);

    useEffect(() => {
      const id = setInterval(() => setNowTick((tick) => tick + 1), 250);
      return () => clearInterval(id);
    }, []);

    const ship = state.ship;
    const now = Date.now();
    const departureAt = ship.departureAt;

    let statusText: string;
    let statusColor: string;
    let countdown: string | null = null;

    switch (ship.status) {
      case "docked":
        statusText = "🚢 Angedockt";
        statusColor = "#86efac";
        if (departureAt !== null) {
          countdown = `Abfahrt: ${formatCountdown(departureAt - now)}`;
        }
        break;
      case "departing":
        statusText = "⛵ Unterwegs";
        statusColor = "#facc15";
        if (ship.returnsAt) {
          countdown = `Rückkehr: ${formatCountdown(ship.returnsAt - now)}`;
        }
        break;
      case "sailing":
      default:
        statusText = ship.rewardPending ? "⛵ Kehrt zurück" : "🌊 Auf See";
        statusColor = ship.rewardPending ? "#a78bfa" : "#7dd3fc";
        if (ship.returnsAt) {
          const label = ship.rewardPending ? "Ankunft" : "Ankunft";
          countdown = `${label}: ${formatCountdown(ship.returnsAt - now)}`;
        }
        break;
    }

    const quest = ship.activeQuest ?? ship.nextQuest;
    const dockInventory =
      state.dockInventory ??
      (
        state as ShipStatusSlice &
          Partial<Pick<GameState, "warehouseInventories">>
      ).warehouseInventories?.[DOCK_WAREHOUSE_ID];
    const dockQuestProgress =
      ship.status === "docked" && ship.activeQuest
        ? (() => {
            const required = ship.activeQuest.amount;
            const deliveredRaw = dockInventory
              ? ((dockInventory[
                  ship.activeQuest.itemId as keyof typeof dockInventory
                ] as number) ?? 0)
              : 0;
            const delivered = Math.min(required, Math.max(0, deliveredRaw));
            const pct = required > 0 ? Math.round((delivered / required) * 100) : 0;
            return { delivered, required, pct };
          })()
        : null;

    return (
      <div
        className="fi-ship-status-bar"
        style={{
          position: "absolute",
          top: 8,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 30,
          background: "rgba(10,20,40,0.85)",
          border: "1px solid rgba(30,128,144,0.5)",
          borderRadius: 8,
          padding: "6px 14px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 13,
          pointerEvents: "none",
          backdropFilter: "blur(4px)",
        }}
      >
        <span style={{ color: statusColor, fontWeight: 600 }}>{statusText}</span>
        {countdown && (
          <span style={{ color: "#9ca3af" }}>{countdown}</span>
        )}
        {quest && (
          <span
            style={{
              color: "#c4b5fd",
              borderLeft: "1px solid rgba(255,255,255,0.15)",
              paddingLeft: 12,
            }}
          >
            📋 {quest.label} ×{quest.amount}
            {dockQuestProgress && (
              <span style={{ marginLeft: 8, color: "#facc15" }}>
                Fortschritt: {dockQuestProgress.delivered}/
                {dockQuestProgress.required} ({dockQuestProgress.pct}%)
              </span>
            )}
          </span>
        )}
      </div>
    );
  },
);
