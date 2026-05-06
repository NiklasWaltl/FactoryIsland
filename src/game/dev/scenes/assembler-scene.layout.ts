import type { SceneDefinition } from "../scene-types";
import { debugSceneLayout } from "./debug-scene.layout";

export const assemblerSceneLayout: SceneDefinition = {
  ...debugSceneLayout,
  id: "assembler",
  label: "Assembler dev scene",
};
