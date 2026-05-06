import type { SceneDefinition } from "../scene-types";
import { emptySceneLayout } from "./empty-scene.layout";

export const powerSceneLayout: SceneDefinition = {
  ...emptySceneLayout,
  id: "power",
  label: "Power dev scene",
};
