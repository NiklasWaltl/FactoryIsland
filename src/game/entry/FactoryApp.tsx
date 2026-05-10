import React, { useEffect, useState, useMemo } from "react";
import { useHmrState } from "./useHmrState";
import { DebugOverlay } from "./DebugOverlay";
import { useGamePersistence } from "./useGamePersistence";
import type { GameMode } from "../store/types";
import type {
  BuildUIStateSlice,
  HotbarStateSlice,
  HudStateSlice,
  ShipStatusSlice,
} from "../store/types/ui-slice-types";
import { DOCK_WAREHOUSE_ID } from "../store/bootstrap/apply-dock-warehouse-layout";
import { useGameTicks } from "./use-game-ticks";
import { ModeSelect } from "../ui/menus/ModeSelect";
import { Grid } from "../grid/Grid";
import { Hotbar } from "../ui/hud/Hotbar";
import { PanelRouter } from "./PanelRouter";
import { ShipStatusBar } from "../ui/hud/ShipStatusBar";
import { BuildMenu } from "../ui/menus/BuildMenu";
import { Notifications } from "../ui/hud/Notifications";
import { AutoDeliveryFeed } from "../ui/hud/AutoDeliveryFeed";
import { ProductionStatusFeed } from "../ui/hud/ProductionStatusFeed";
import { ResourceBar } from "../ui/hud/ResourceBar";
import "../ui/styles/factory-game.css";

// Debug system (tree-shaken in production)
import { recordHmrModule } from "../debug";

const SAVE_KEY = "factory-island-save";

/* Error boundary to prevent white-screen crashes */
class GameErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset?: () => void },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 40,
            color: "#fff",
            background: "#1a1a2e",
            textAlign: "center",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <h2>Etwas ist schiefgelaufen</h2>
          <p style={{ color: "#aaa", maxWidth: 500 }}>
            {this.state.error?.message}
          </p>
          <button
            style={{
              marginTop: 16,
              padding: "8px 24px",
              fontSize: 16,
              cursor: "pointer",
            }}
            onClick={() => {
              this.setState({ hasError: false, error: null });
              this.props.onReset?.();
            }}
          >
            Erneut versuchen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* Inner game component that gets remounted per mode via key */
const GameInner: React.FC<{ mode: GameMode }> = ({ mode }) => {
  const { state, dispatch, handleMock } = useGamePersistence(mode);

  // HMR status tracking
  const hmrState = useHmrState();

  // Keyboard shortcuts for hotbar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in input fields
      if (
        (e.target as HTMLElement)?.tagName === "INPUT" ||
        (e.target as HTMLElement)?.tagName === "TEXTAREA"
      )
        return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        const idx = num - 1;
        if (idx < state.hotbarSlots.length) {
          dispatch({ type: "SET_ACTIVE_SLOT", slot: idx });
        }
      }
      if (e.key === "Escape") {
        if (state.buildMode) {
          dispatch({ type: "TOGGLE_BUILD_MODE" });
        } else {
          dispatch({ type: "CLOSE_PANEL" });
        }
      }
      if (e.key === "b" || e.key === "B") {
        dispatch({ type: "TOGGLE_BUILD_MODE" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state.hotbarSlots.length, state.buildMode]);

  useGameTicks(state, dispatch);

  // Reflect build-mode flag on the root container so HUD layers (rechte
  // Statusfeeds) per CSS-Variable nach links rutschen, wenn das BuildMenu
  // die rechte Spalte beansprucht. Siehe factory-game.css.
  useEffect(() => {
    const root = document.querySelector<HTMLDivElement>(".fi-root");
    if (!root) return;
    root.dataset.buildMode = state.buildMode ? "on" : "off";
    return () => {
      root.dataset.buildMode = "off";
    };
  }, [state.buildMode]);

  const hudSlice = useMemo<HudStateSlice>(
    () => ({
      mode: state.mode,
      warehousesPlaced: state.warehousesPlaced,
      inventory: state.inventory,
      warehouseInventories: state.warehouseInventories,
      serviceHubs: state.serviceHubs,
      moduleFragments: state.moduleFragments,
    }),
    [
      state.mode,
      state.warehousesPlaced,
      state.inventory,
      state.warehouseInventories,
      state.serviceHubs,
      state.moduleFragments,
    ],
  );

  const buildUiSlice = useMemo<BuildUIStateSlice>(
    () => ({
      buildMode: state.buildMode,
      selectedBuildingType: state.selectedBuildingType,
      selectedFloorTile: state.selectedFloorTile,
      placedBuildings: state.placedBuildings,
      warehousesPlaced: state.warehousesPlaced,
      energyDebugOverlay: state.energyDebugOverlay,
      serviceHubs: state.serviceHubs,
      collectionNodes: state.collectionNodes,
      inventory: state.inventory,
      warehouseInventories: state.warehouseInventories,
      unlockedBuildings: state.unlockedBuildings,
    }),
    [
      state.buildMode,
      state.selectedBuildingType,
      state.selectedFloorTile,
      state.placedBuildings,
      state.warehousesPlaced,
      state.energyDebugOverlay,
      state.serviceHubs,
      state.collectionNodes,
      state.inventory,
      state.warehouseInventories,
      state.unlockedBuildings,
    ],
  );

  const hotbarSlice = useMemo<HotbarStateSlice>(
    () => ({
      hotbarSlots: state.hotbarSlots,
      activeSlot: state.activeSlot,
    }),
    [state.hotbarSlots, state.activeSlot],
  );

  const shipStatusSlice = useMemo<ShipStatusSlice>(
    () => ({
      ship: state.ship,
      dockInventory: state.warehouseInventories[DOCK_WAREHOUSE_ID],
    }),
    [state.ship, state.warehouseInventories],
  );

  return (
    <>
      <Grid state={state} dispatch={dispatch} />
      <ResourceBar state={hudSlice} />
      <ShipStatusBar state={shipStatusSlice} />
      <Notifications notifications={state.notifications} />
      <AutoDeliveryFeed log={state.autoDeliveryLog} />
      <ProductionStatusFeed state={state} />

      <PanelRouter state={state} dispatch={dispatch} />

      <Hotbar state={hotbarSlice} dispatch={dispatch} />

      {/* Build Mode toggle button */}
      <button
        className={`fi-build-toggle ${state.buildMode ? "fi-build-toggle--active" : ""}`}
        onClick={() => dispatch({ type: "TOGGLE_BUILD_MODE" })}
        title="Bau-Menü öffnen/schließen (B)"
      >
        🏗️ {state.buildMode ? "Bauen aktiv" : "Bauen"}
      </button>

      {/* Build Menu overlay */}
      {buildUiSlice.buildMode && (
        <BuildMenu state={buildUiSlice} dispatch={dispatch} />
      )}

      <DebugOverlay mode={mode} hmrState={hmrState} onMock={handleMock} />
    </>
  );
};

const FactoryGame: React.FC = () => {
  const [mode, setMode] = useState<GameMode | null>(null);

  if (mode === null) {
    return (
      <div className="fi-root">
        <ModeSelect onSelect={setMode} />
      </div>
    );
  }

  return (
    <div className="fi-root">
      <GameErrorBoundary
        onReset={() => {
          try {
            localStorage.removeItem(SAVE_KEY);
          } catch {
            // Best-effort reset: browser storage can be unavailable or blocked.
          }
        }}
      >
        <GameInner key={mode} mode={mode} />
      </GameErrorBoundary>
    </div>
  );
};

export default FactoryGame;

// HMR self-accept: preserve state across hot reloads
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    recordHmrModule("FactoryGame.tsx");
  });
}
