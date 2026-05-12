import { useReducer, useEffect, useRef, useCallback } from "react";
import type React from "react";
import { gameReducer, gameReducerWithInvariants } from "../store/reducer";
import { createInitialState } from "../store/initial-state";
import type { GameMode, GameState } from "../store/types";
import type { GameAction } from "../store/game-actions";
import {
  loadAndHydrate,
  loadFromStorage,
  saveToStorage,
} from "../simulation/save";
import { applyDevScene, getDevSceneFromUrl, hasDevSceneUrlParam } from "../dev";
import {
  IS_DEV,
  applyMockToState,
  saveHmrState,
  loadHmrState,
  debugLog,
} from "../debug";
import type { MockAction } from "../debug";
import { addErrorNotification } from "../store/utils/notifications";

const SAVE_KEY = "factory-island-save";
const SAVE_RECOVERY_MESSAGE =
  "⚠️ Speicherstand hatte Fehler – automatisch repariert";

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

export function useGamePersistence(mode: GameMode): {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  handleMock: (action: MockAction["type"]) => void;
} {
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
      const loaded = loadFromStorage(SAVE_KEY, m);
      if (loaded.state) {
        return loaded.state;
      }
      if (loaded.recoveredFromCorruption) {
        const fresh = createFreshInitialState(m);
        return {
          ...fresh,
          notifications: addErrorNotification(
            fresh.notifications,
            SAVE_RECOVERY_MESSAGE,
            8000,
          ),
        };
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

  // DEV-only console bridge for manual reducer dispatch/state inspection.
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const zoneIdAlias = new Map<string, string>();

    const getStateWithZoneContext = () => {
      const current = stateRef.current;
      return {
        ...current,
        zoneContext: {
          productionZones: current.productionZones,
          buildingZoneIds: current.buildingZoneIds,
          buildingSourceWarehouseIds: current.buildingSourceWarehouseIds,
          routingIndexCache: current.routingIndexCache,
        },
      };
    };

    const normalizeDevAction = (action: unknown): GameAction => {
      const candidate = action as {
        type?: string;
        payload?: {
          id?: string;
          name?: string;
          zoneId?: string | null;
          buildingId?: string;
        };
      };
      if (!candidate || typeof candidate !== "object") {
        return action as GameAction;
      }
      const payload = candidate.payload;
      if (!payload || typeof payload !== "object") {
        return action as GameAction;
      }
      switch (candidate.type) {
        case "CREATE_ZONE":
          return {
            type: "CREATE_ZONE",
            name: payload.name,
          };
        case "DELETE_ZONE": {
          const requestedZoneId = payload.id ?? payload.zoneId ?? "";
          return {
            type: "DELETE_ZONE",
            zoneId: zoneIdAlias.get(requestedZoneId) ?? requestedZoneId,
          };
        }
        case "SET_BUILDING_ZONE": {
          const requestedZoneId = payload.zoneId ?? null;
          const resolvedZoneId =
            requestedZoneId === null
              ? null
              : (zoneIdAlias.get(requestedZoneId) ?? requestedZoneId);
          return {
            type: "SET_BUILDING_ZONE",
            buildingId: payload.buildingId ?? "",
            zoneId: resolvedZoneId,
          };
        }
        case "CLEAR_ALL_BUILDING_ZONES":
          return { type: "CLEAR_ALL_BUILDING_ZONES" };
        default:
          return action as GameAction;
      }
    };

    const applyOptimisticState = (action: GameAction) => {
      try {
        stateRef.current = gameReducerWithInvariants(stateRef.current, action);
      } catch {
        // Keep console bridge resilient; runtime state still updates through real dispatch.
      }
    };

    const devDispatch = (action: unknown) => {
      const candidate = action as {
        type?: string;
        payload?: {
          id?: string;
        };
      };
      const requestedZoneAlias =
        candidate?.type === "CREATE_ZONE" &&
        candidate.payload &&
        typeof candidate.payload.id === "string" &&
        candidate.payload.id.length > 0
          ? candidate.payload.id
          : null;

      const previousZoneIds = new Set(
        Object.keys(stateRef.current.productionZones),
      );
      const normalized = normalizeDevAction(action);
      applyOptimisticState(normalized);

      if (requestedZoneAlias) {
        const createdZoneId = Object.keys(
          stateRef.current.productionZones,
        ).find((zoneId) => !previousZoneIds.has(zoneId));
        if (createdZoneId) {
          zoneIdAlias.set(requestedZoneAlias, createdZoneId);
        }
      }

      dispatch(normalized);
    };

    const devWindow = window as any;
    devWindow.__store__ = {
      dispatch: devDispatch,
      getState: getStateWithZoneContext,
    };
    devWindow.dispatch = devDispatch;
    return () => {
      if (devWindow.dispatch === devDispatch) {
        delete devWindow.dispatch;
      }
      if (devWindow.__store__?.dispatch === devDispatch) {
        delete devWindow.__store__;
      }
    };
  }, [dispatch]);

  // Periodic localStorage save (every 10s + on unload)
  useEffect(() => {
    const save = () => {
      saveToStorage(SAVE_KEY, stateRef.current);
    };
    const id = setInterval(save, 10_000);
    window.addEventListener("beforeunload", save);
    return () => {
      clearInterval(id);
      window.removeEventListener("beforeunload", save);
    };
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

  return { state, dispatch, handleMock };
}
