import {
  DEFAULT_DEV_SCENE,
  isDevSceneId,
  type DevSceneId,
} from "./scene-types";

export const getDevSceneFromUrl = (): DevSceneId => {
  const params = new URLSearchParams(window.location.search);
  const scene = params.get("scene");

  if (!scene) return DEFAULT_DEV_SCENE;
  if (isDevSceneId(scene)) return scene;

  // eslint-disable-next-line no-console
  console.warn(
    `[dev-scene] Unknown scene "${scene}", falling back to "${DEFAULT_DEV_SCENE}"`,
  );
  return DEFAULT_DEV_SCENE;
};

export const hasDevSceneUrlParam = (): boolean => {
  const params = new URLSearchParams(window.location.search);
  return params.has("scene");
};
