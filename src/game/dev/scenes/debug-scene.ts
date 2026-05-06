import type { GameState } from "../../store/types";
import { buildSceneState } from "../scene-builder/build-scene-state";
import { debugSceneLayout } from "./debug-scene.layout";

export const applyDebugScene = (state: GameState): GameState =>
  buildSceneState(debugSceneLayout, state);
