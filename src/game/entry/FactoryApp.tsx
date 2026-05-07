import React, {
  useReducer,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { gameReducer, gameReducerWithInvariants } from "../store/reducer";
import { createInitialState } from "../store/initial-state";
import type { GameMode, GameState } from "../store/types";
import type {
  BuildUIStateSlice,
  HotbarStateSlice,
  HudStateSlice,
  MapShopStateSlice,
  ShipStatusSlice,
} from "../store/types/ui-slice-types";
import { DOCK_WAREHOUSE_ID } from "../store/bootstrap/apply-dock-warehouse-layout";
import { serializeState, loadAndHydrate } from "../simulation/save";
import {
  applyDevScene,
  DevSceneSelector,
  getDevSceneFromUrl,
  hasDevSceneUrlParam,
} from "../dev";
import { useGameTicks } from "./use-game-ticks";
import { ModeSelect } from "../ui/menus/ModeSelect";
import { Grid } from "../grid/Grid";
import { Hotbar } from "../ui/hud/Hotbar";
import { MapShopPanel } from "../ui/panels/MapShopPanel";
import { WorkbenchPanel } from "../ui/panels/WorkbenchPanel";
import { WarehousePanel } from "../ui/panels/WarehousePanel";
import { SmithyPanel } from "../ui/panels/SmithyPanel";
import { GeneratorPanel } from "../ui/panels/GeneratorPanel";
import { BatteryPanel } from "../ui/panels/BatteryPanel";
import { PowerPolePanel } from "../ui/panels/PowerPolePanel";
import { AutoMinerPanel } from "../ui/panels/AutoMinerPanel";
import { AutoSmelterPanel } from "../ui/panels/AutoSmelterPanel";
import { AutoAssemblerPanel } from "../ui/panels/AutoAssemblerPanel";
import { ManualAssemblerPanel } from "../ui/panels/ManualAssemblerPanel";
import { ServiceHubPanel } from "../ui/panels/ServiceHubPanel";
import { ConveyorSplitterPanel } from "../ui/panels/ConveyorSplitterPanel";
import { DockWarehousePanel } from "../ui/panels/DockWarehousePanel";
import { FragmentTraderPanel } from "../ui/panels/FragmentTraderPanel";
import { ModulLabPanel } from "../ui/panels/ModulLabPanel";
import { ResearchLabPanel } from "../ui/panels/ResearchLabPanel";
import { ShipStatusBar } from "../ui/hud/ShipStatusBar";
import { BuildMenu } from "../ui/menus/BuildMenu";
import { Notifications } from "../ui/hud/Notifications";
import { AutoDeliveryFeed } from "../ui/hud/AutoDeliveryFeed";
import { ProductionStatusFeed } from "../ui/hud/ProductionStatusFeed";
import { ResourceBar } from "../ui/hud/ResourceBar";
import "../ui/styles/factory-game.css";

// Debug system (tree-shaken in production)
import {
  IS_DEV,
  DebugPanel,
  applyMockToState,
  saveHmrState,
  loadHmrState,
  recordHmrModule,
  getHmrModules,
  getHmrStatus,
  debugLog,
} from "../debug";
import type { MockAction } from "../debug";

const SAVE_KEY = "factory-island-save";

/**
 * Thin wrapper kept for backward compatibility with HMR path.
 * All migration logic now lives in `simulation/save.ts`.
 */
function normalizeLoadedState(raw: unknown, mode: GameMode): GameState {
  return loadAndHydrate(raw, mode);
}

function createFreshInitialState(mode: GameMode): GameState {
  const baseState = createInitialState(mode);
  if (import.meta.env.DEV && mode === "debug") {
    return applyDevScene(baseState, getDevSceneFromUrl());
  }
  return baseState;
}

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
  // Try to restore HMR state (dev), localStorage save (prod), or fresh state
  const [state, dispatch] = useReducer(
    import.meta.env.DEV ? gameReducerWithInvariants : gameReducer,
    mode,
    (m) => {
      if (import.meta.env.DEV && m === "debug" && hasDevSceneUrlParam()) {
        return createFreshInitialState(m);
      }
      if (IS_DEV) {
        const hmr = loadHmrState();
        if (hmr) return normalizeLoadedState(hmr, m);
      }
      try {
        const saved = localStorage.getItem(SAVE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.mode === m)
            return normalizeLoadedState(parsed, m);
        }
      } catch {
        /* corrupt save, ignore */
      }
      return createFreshInitialState(m);
    },
  );

  // Keep latest state available to effects/event callbacks, and persist HMR snapshots in DEV.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
    if (!IS_DEV) return;
    saveHmrState(state);
  }, [state]);

  // Periodic localStorage save (every 10s + on unload)
  useEffect(() => {
    const save = () => {
      try {
        localStorage.setItem(
          SAVE_KEY,
          JSON.stringify(serializeState(stateRef.current)),
        );
      } catch {
        /* quota */
      }
    };
    const id = setInterval(save, 10_000);
    window.addEventListener("beforeunload", save);
    return () => {
      clearInterval(id);
      window.removeEventListener("beforeunload", save);
    };
  }, []);

  // HMR status tracking
  const [hmrModules, setHmrModules] = useState<string[]>(() =>
    IS_DEV ? getHmrModules() : [],
  );
  const [hmrStatus, setHmrStatus] = useState<string>(() =>
    IS_DEV ? getHmrStatus() : "disabled",
  );

  useEffect(() => {
    if (!IS_DEV) return;
    const id = setInterval(() => {
      setHmrModules([...getHmrModules()]);
      setHmrStatus(getHmrStatus());
    }, 2000);
    return () => clearInterval(id);
  }, []);

  // Mock data handler - dispatches directly into the reducer
  const handleMock = useCallback(
    (action: MockAction["type"]) => {
      if (!IS_DEV) return;
      if (action === "DEBUG_RESET_STATE") {
        debugLog.mock("Full state reset");
        dispatch({
          type: "DEBUG_SET_STATE",
          state: createFreshInitialState(mode),
        });
        return;
      }
      const newState = applyMockToState(stateRef.current, action);
      dispatch({ type: "DEBUG_SET_STATE", state: newState });
    },
    [mode],
  );

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

  const mapShopSlice = useMemo<MapShopStateSlice>(
    () => ({
      coins: state.inventory.coins,
      unlockedBuildings: state.unlockedBuildings,
    }),
    [state.inventory.coins, state.unlockedBuildings],
  );

  return (
    <>
      <Grid state={state} dispatch={dispatch} />
      <ResourceBar state={hudSlice} />
      <ShipStatusBar state={shipStatusSlice} />
      <Notifications notifications={state.notifications} />
      <AutoDeliveryFeed log={state.autoDeliveryLog} />
      <ProductionStatusFeed state={state} />

      {state.openPanel === "map_shop" && (
        <MapShopPanel state={mapShopSlice} dispatch={dispatch} />
      )}
      {state.openPanel === "warehouse" && (
        <WarehousePanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "smithy" && (
        <SmithyPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "generator" && (
        <GeneratorPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "battery" && (
        <BatteryPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "power_pole" && (
        <PowerPolePanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "workbench" && (
        <WorkbenchPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "auto_miner" && (
        <AutoMinerPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "auto_smelter" && (
        <AutoSmelterPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "auto_assembler" && (
        <AutoAssemblerPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "manual_assembler" && (
        <ManualAssemblerPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "service_hub" && (
        <ServiceHubPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "conveyor_splitter" && (
        <ConveyorSplitterPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "dock_warehouse" && (
        <DockWarehousePanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "fragment_trader" && (
        <FragmentTraderPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "module_lab" && (
        <ModulLabPanel state={state} dispatch={dispatch} />
      )}
      {state.openPanel === "research_lab" && (
        <ResearchLabPanel
          state={{
            inventory: state.inventory,
            unlockedBuildings: state.unlockedBuildings,
          }}
          dispatch={dispatch}
        />
      )}

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

      {IS_DEV && state.mode === "debug" && (
        <>
          <DevSceneSelector mode={mode} />
          <div className="fi-debug-badge">DEBUG MODE</div>
          <DebugPanel
            onMock={handleMock}
            onResetState={() => handleMock("DEBUG_RESET_STATE")}
            hmrStatus={hmrStatus}
            hmrModules={hmrModules}
          />
        </>
      )}
    </>
  );
};

export const FactoryGame: React.FC = () => {
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
