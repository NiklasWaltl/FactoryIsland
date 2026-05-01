import type { GameState } from "../store/types";
import type { DevSceneId, SceneDefinition } from "./scene-types";
import { buildSceneState } from "./scene-builder/build-scene-state";
import { debugSceneLayout } from "./scenes/debug-scene.layout";
import { emptySceneLayout } from "./scenes/empty-scene.layout";

export type DevScene = DevSceneId;

export const SCENES: Record<DevSceneId, SceneDefinition> = {
  debug: debugSceneLayout,
  logistics: debugSceneLayout,
  power: debugSceneLayout,
  assembler: debugSceneLayout,
  empty: emptySceneLayout,
};

export const applyDevScene = (
  state: GameState,
  sceneId: DevScene = "debug",
): GameState => {
  const scene = SCENES[sceneId] ?? SCENES.debug;
  return buildSceneState(scene, state);
};