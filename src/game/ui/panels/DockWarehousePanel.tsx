import React, { useEffect, useRef } from "react";
import type { GameState } from "../../store/types";
import type { GameAction } from "../../store/game-actions";
import { DOCK_WAREHOUSE_ID } from "../../store/bootstrap/apply-dock-warehouse-layout";
import {
  getExpectedRewardRange,
  SHIP_REWARD_TABLE,
  type ExpectedRewardRange,
} from "../../ship/reward-table";

interface DockWarehousePanelProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "—";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatExpectedReward(preview: ExpectedRewardRange): string {
  const amount = `${preview.min}–${preview.max}`;
  return `${amount} ${preview.likely.label}`;
}

export const DockWarehousePanel: React.FC<DockWarehousePanelProps> = React.memo(
  ({ state, dispatch }) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const ship = state.ship;
    const inv = state.warehouseInventories[DOCK_WAREHOUSE_ID];

    useEffect(() => {
      const onDocumentMouseDown = (event: MouseEvent) => {
        const panelEl = panelRef.current;
        if (!panelEl) return;
        if (event.target instanceof Node && panelEl.contains(event.target))
          return;
        dispatch({ type: "CLOSE_PANEL" });
      };
      document.addEventListener("mousedown", onDocumentMouseDown);
      return () =>
        document.removeEventListener("mousedown", onDocumentMouseDown);
    }, [dispatch]);

    const now = Date.now();
    const quest = ship.activeQuest;
    const expectedReward = quest
      ? getExpectedRewardRange(quest, SHIP_REWARD_TABLE)
      : null;
    const questInv =
      quest && inv
        ? ((inv[quest.itemId as keyof typeof inv] as number) ?? 0)
        : 0;
    const questFilled = quest ? Math.min(questInv, quest.amount) : 0;

    const departsInMs = ship.departureAt ? ship.departureAt - now : 0;
    const returnsInMs = ship.returnsAt ? ship.returnsAt - now : 0;

    const qualityPct =
      quest && quest.amount > 0
        ? Math.round((questFilled / quest.amount) * 100)
        : 0;
    const isQuestFulfilled = quest ? questFilled >= quest.amount : false;
    const departureWarning =
      quest && !isQuestFulfilled
        ? "Warnung: Auftrag ist nicht vollstaendig erfuellt. Vorzeitige Abfahrt kann die Belohnung reduzieren; bei 0% gibt es keine Belohnung."
        : null;

    let qualityLabel = "Unzureichend";
    let qualityColor = "#fca5a5";
    if (qualityPct >= 200) {
      qualityLabel = "Ausgezeichnet (3×)";
      qualityColor = "#a78bfa";
    } else if (qualityPct >= 150) {
      qualityLabel = "Gut (2×)";
      qualityColor = "#86efac";
    } else if (qualityPct >= 100) {
      qualityLabel = "Erfüllt (1×)";
      qualityColor = "#7CFC00";
    } else if (qualityPct > 0) {
      qualityLabel = `Teilweise (${qualityPct}%)`;
      qualityColor = "#facc15";
    }

    return (
      <div
        ref={panelRef}
        className="fi-panel fi-floating-panel fi-dock-warehouse-panel"
        role="presentation"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="fi-dock-warehouse-header">
          <h2>⚓ Dock-Lagerhaus</h2>
          <button
            className="fi-btn fi-btn-sm"
            onClick={() => dispatch({ type: "CLOSE_PANEL" })}
            aria-label="Schließen"
          >
            X
          </button>
        </div>

        <button
          className="fi-btn fi-btn-sm fi-dock-warehouse-fragments-btn"
          onClick={() =>
            dispatch({ type: "TOGGLE_PANEL", panel: "fragment_trader" })
          }
        >
          Fragmente kaufen
        </button>

        <div className="fi-machine-grid">
          {/* Ship status */}
          <div className="fi-machine-row">
            <span>Schiff-Status</span>
            <strong>
              {ship.status === "docked"
                ? "🚢 Angedockt"
                : ship.status === "departing"
                  ? "⛵ Unterwegs"
                  : "🌊 Auf See"}
            </strong>
          </div>

          {/* Active quest */}
          {quest ? (
            <>
              <div className="fi-machine-row">
                <span>Aktueller Auftrag</span>
                <strong>
                  {quest.label} × {quest.amount}
                </strong>
              </div>
              <div className="fi-machine-row">
                <span>Geliefert</span>
                <strong style={{ color: qualityColor }}>
                  {questFilled} / {quest.amount}
                </strong>
              </div>
              <div className="fi-machine-row">
                <span>Qualität</span>
                <strong style={{ color: qualityColor }}>{qualityLabel}</strong>
              </div>
              {expectedReward && (
                <div className="fi-dock-warehouse-reward-row">
                  <span>{"Erwarteter Reward:"}</span>
                  <strong>{formatExpectedReward(expectedReward)}</strong>
                </div>
              )}
            </>
          ) : (
            <div className="fi-dock-warehouse-empty">
              {ship.status === "sailing"
                ? "Wartet auf Ankunft des Schiffs…"
                : "Kein aktiver Auftrag"}
            </div>
          )}

          {/* Next quest preview */}
          {ship.nextQuest && (
            <div className="fi-dock-warehouse-next-quest">
              Nächster Auftrag: {ship.nextQuest.label} × {ship.nextQuest.amount}
            </div>
          )}

          {/* Countdown */}
          {ship.status === "docked" && ship.departureAt && (
            <div className="fi-machine-row">
              <span>Abfahrt in</span>
              <strong style={{ color: "#facc15" }}>
                {formatCountdown(departsInMs)}
              </strong>
            </div>
          )}
          {ship.status === "sailing" && ship.returnsAt && (
            <div className="fi-machine-row">
              <span>Ankunft in</span>
              <strong style={{ color: "#7dd3fc" }}>
                {formatCountdown(returnsInMs)}
              </strong>
            </div>
          )}

          {/* Manual departure */}
          {ship.status === "docked" && (
            <>
              <button
                className="fi-btn fi-btn-sm fi-dock-warehouse-depart-btn"
                disabled={!quest}
                onClick={() => dispatch({ type: "SHIP_DEPART" })}
                title={
                  !quest
                    ? "Kein aktiver Auftrag vorhanden."
                    : !isQuestFulfilled
                      ? "Achtung: Auftrag nicht vollstaendig erfuellt. Belohnung kann reduziert sein."
                      : "Schiff jetzt ablegen lassen und Belohnung kassieren."
                }
              >
                ⛵ Schiff ablegen lassen
              </button>
              {departureWarning && (
                <div className="fi-dock-warehouse-depart-warning">
                  {departureWarning}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  },
);

DockWarehousePanel.displayName = "DockWarehousePanel";
