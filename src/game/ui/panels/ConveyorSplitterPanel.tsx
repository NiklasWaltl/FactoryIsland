import React, { useEffect, useRef } from "react";
import type { GameAction } from "../../store/game-actions";
import type { ConveyorItem, GameState } from "../../store/types";
import {
  RESOURCE_EMOJIS,
  RESOURCE_LABELS,
} from "../../store/constants/resources";
import {
  getSplitterFilter,
  type SplitterOutputSide,
} from "../../store/slices/splitter-filter-state";

interface ConveyorSplitterPanelProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const CONVEYOR_FILTER_ITEMS: readonly ConveyorItem[] = [
  "stone",
  "iron",
  "copper",
  "ironIngot",
  "copperIngot",
  "metalPlate",
  "gear",
];

const FILTER_OPTIONS: readonly (ConveyorItem | null)[] = [
  null,
  ...CONVEYOR_FILTER_ITEMS,
];

const SIDE_CONFIG: readonly { side: SplitterOutputSide; label: string }[] = [
  { side: "left", label: "Links" },
  { side: "right", label: "Rechts" },
];

function getFilterLabel(item: ConveyorItem | null): string {
  return item === null ? "Alle" : (RESOURCE_LABELS[item] ?? item);
}

export const ConveyorSplitterPanel: React.FC<ConveyorSplitterPanelProps> =
  React.memo(({ state, dispatch }) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const splitterId = state.selectedSplitterId;
    const splitterAsset = splitterId ? state.assets[splitterId] : null;

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

    if (
      !splitterId ||
      !splitterAsset ||
      splitterAsset.type !== "conveyor_splitter"
    ) {
      return null;
    }

    return (
      <div
        ref={panelRef}
        className="fi-panel fi-conveyor-splitter-panel"
        onClick={(event) => event.stopPropagation()}
        style={{
          position: "absolute",
          top: 120,
          right: 16,
          zIndex: 40,
          width: 360,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0 }}>Foerderband-Splitter</h2>
          <button
            className="fi-btn fi-btn-sm"
            onClick={() => dispatch({ type: "CLOSE_PANEL" })}
            aria-label="Schliessen"
          >
            X
          </button>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {SIDE_CONFIG.map(({ side, label }) => {
            const currentFilter = getSplitterFilter(
              state.splitterFilterState,
              splitterId,
              side,
            );
            return (
              <section
                key={side}
                style={{
                  display: "grid",
                  gap: 8,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <strong>{label}</strong>
                  <span style={{ color: "#9ca3af", fontSize: 12 }}>
                    {getFilterLabel(currentFilter)}
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 6,
                  }}
                >
                  {FILTER_OPTIONS.map((item) => {
                    const selected = currentFilter === item;
                    return (
                      <button
                        key={item ?? "all"}
                        className="fi-btn fi-btn-sm"
                        onClick={() =>
                          dispatch({
                            type: "SET_SPLITTER_FILTER",
                            splitterId,
                            side,
                            itemType: item,
                          })
                        }
                        style={{
                          minHeight: 32,
                          padding: "5px 8px",
                          border: selected
                            ? "1px solid #7CFC00"
                            : "1px solid rgba(255,255,255,0.16)",
                          background: selected
                            ? "rgba(124,252,0,0.14)"
                            : "rgba(255,255,255,0.05)",
                          color: selected ? "#7CFC00" : "#e5e7eb",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={getFilterLabel(item)}
                      >
                        {item
                          ? `${RESOURCE_EMOJIS[item] ?? ""} ${getFilterLabel(item)}`
                          : "Alle"}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  });

ConveyorSplitterPanel.displayName = "ConveyorSplitterPanel";
