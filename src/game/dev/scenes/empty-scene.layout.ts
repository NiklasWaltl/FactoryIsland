import type { SceneDefinition } from "../scene-types";

export const emptySceneLayout: SceneDefinition = {
  id: "empty",
  label: "Empty dev scene",
  clearBaseWorld: true,
  baseStartLayout: "empty",
  assets: [],
  resources: [],
};
