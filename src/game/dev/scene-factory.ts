import type { GameState } from "../store/types";
import type { DevSceneId, SceneDefinition } from "./scene-types";
import { buildSceneState } from "./scene-builder/build-scene-state";
import { assemblerSceneLayout } from "./scenes/assembler-scene.layout";
import { debugSceneLayout } from "./scenes/debug-scene.layout";
import { emptySceneLayout } from "./scenes/empty-scene.layout";
import { logisticsSceneLayout } from "./scenes/logistics-scene.layout";
import { powerSceneLayout } from "./scenes/power-scene.layout";

export type DevScene = DevSceneId;

export const SCENES: Record<DevSceneId, SceneDefinition> = {
  debug: debugSceneLayout,
  logistics: logisticsSceneLayout,
  power: powerSceneLayout,
  assembler: assemblerSceneLayout,
  empty: emptySceneLayout,
};

export const applyDevScene = (
  state: GameState,
  sceneId: DevScene = "debug",
): GameState => {
  const scene = SCENES[sceneId] ?? SCENES.debug;
  return buildSceneState(scene, state);
};
