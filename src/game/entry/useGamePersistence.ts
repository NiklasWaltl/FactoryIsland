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
